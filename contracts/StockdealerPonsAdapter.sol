// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStockdealerPonsCurve {
    function token() external view returns (address);
    function pairToken() external view returns (address);
    function graduated() external view returns (bool);
    function readyToGraduate() external view returns (bool);
    function sell(uint256 amountIn, uint256 minimumOut, address recipient) external returns (uint256 amountOut);
}

interface IStockdealerPonsV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function factory() external view returns (address);
}

interface IStockdealerPonsV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IStockdealerPonsV3Pool {
    function liquidity() external view returns (uint128);
}

contract StockdealerPonsAdapter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RouteData {
        address curve;
        address pairToken;
        bytes activePath;
    }

    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    address public constant OFFICIAL_SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address public constant OFFICIAL_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;

    address public immutable economyRouter;
    bool public configurationFrozen;
    mapping(bytes32 pair => bytes routeData) private routeDataByPair;
    mapping(bytes32 pair => bool active) public graduatedPathActive;
    mapping(bytes32 pair => bytes path) private graduatedPathByPair;

    error WrongChain();
    error InvalidContract();
    error InvalidPath();
    error ConfigurationIsFrozen();
    error ConfigurationNotFrozen();
    error UnauthorizedRouter();
    error DeadlineExpired();
    error CurveGraduated();
    error CurveTransitioning();
    error CurveNotGraduated();
    error MinimumOutputNotMet();

    event PathConfigured(address indexed tokenIn, address indexed tokenOut, bytes routeData);
    event ConfigurationFrozen();
    event GraduatedPathActivated(address indexed tokenIn, address indexed tokenOut);

    constructor(address initialOwner, address economyRouter_) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if (economyRouter_.code.length == 0 || OFFICIAL_SWAP_ROUTER_02.code.length == 0 || OFFICIAL_V3_FACTORY.code.length == 0) revert InvalidContract();
        if (IStockdealerPonsV3Router(OFFICIAL_SWAP_ROUTER_02).factory() != OFFICIAL_V3_FACTORY) revert InvalidContract();
        economyRouter = economyRouter_;
    }

    function configurePath(address tokenIn, address tokenOut, bytes calldata routeData) external onlyOwner {
        if (configurationFrozen) revert ConfigurationIsFrozen();
        if (tokenIn.code.length == 0 || tokenOut.code.length == 0 || routeData.length == 0) revert InvalidPath();
        RouteData memory route = _decodeRoute(routeData);
        _validateRoute(tokenIn, tokenOut, route);
        routeDataByPair[_pair(tokenIn, tokenOut)] = routeData;
        emit PathConfigured(tokenIn, tokenOut, routeData);
    }

    function freezeConfiguration() external onlyOwner {
        configurationFrozen = true;
        emit ConfigurationFrozen();
    }

    function pathFor(address tokenIn, address tokenOut) external view returns (bytes memory) {
        return routeDataByPair[_pair(tokenIn, tokenOut)];
    }

    function graduatedPathFor(address tokenIn, address tokenOut) external view returns (bytes memory) {
        return graduatedPathByPair[_pair(tokenIn, tokenOut)];
    }

    function activateGraduatedPath(address tokenIn, address tokenOut, bytes calldata graduatedPath) external onlyOwner {
        if (!configurationFrozen) revert ConfigurationNotFrozen();
        bytes32 pair = _pair(tokenIn, tokenOut);
        if (graduatedPathActive[pair]) revert ConfigurationIsFrozen();
        bytes memory routeData = routeDataByPair[pair];
        if (routeData.length == 0) revert InvalidPath();
        RouteData memory route = _decodeRoute(routeData);
        if (!IStockdealerPonsCurve(route.curve).graduated()) revert CurveNotGraduated();
        _validateV3Path(graduatedPath, tokenIn, tokenOut);
        graduatedPathByPair[pair] = graduatedPath;
        graduatedPathActive[pair] = true;
        emit GraduatedPathActivated(tokenIn, tokenOut);
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minimumOut,
        uint256 deadline,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (msg.sender != economyRouter) revert UnauthorizedRouter();
        if (!configurationFrozen) revert ConfigurationNotFrozen();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (recipient == address(0) || amountIn == 0) revert InvalidPath();

        bytes memory routeData = routeDataByPair[_pair(tokenIn, tokenOut)];
        if (routeData.length == 0) revert InvalidPath();
        RouteData memory route = _decodeRoute(routeData);
        _validateRoute(tokenIn, tokenOut, route);
        IStockdealerPonsCurve curve = IStockdealerPonsCurve(route.curve);

        IERC20 input = IERC20(tokenIn);
        input.safeTransferFrom(msg.sender, address(this), amountIn);
        if (curve.graduated()) {
            if (!graduatedPathActive[_pair(tokenIn, tokenOut)]) revert CurveGraduated();
            return _swapGraduated(input, graduatedPathByPair[_pair(tokenIn, tokenOut)], amountIn, minimumOut, recipient);
        }
        if (curve.readyToGraduate()) revert CurveTransitioning();
        input.forceApprove(route.curve, amountIn);
        uint256 pairBefore = IERC20(route.pairToken).balanceOf(address(this));
        curve.sell(amountIn, 0, address(this));
        uint256 pairOut = IERC20(route.pairToken).balanceOf(address(this)) - pairBefore;
        input.forceApprove(route.curve, 0);
        if (pairOut == 0) revert MinimumOutputNotMet();

        if (route.activePath.length == 0) {
            if (pairOut < minimumOut) revert MinimumOutputNotMet();
            IERC20(route.pairToken).safeTransfer(recipient, pairOut);
            return pairOut;
        }

        IERC20(route.pairToken).forceApprove(OFFICIAL_SWAP_ROUTER_02, pairOut);
        amountOut = IStockdealerPonsV3Router(OFFICIAL_SWAP_ROUTER_02).exactInput(
            IStockdealerPonsV3Router.ExactInputParams({
                path: route.activePath,
                recipient: recipient,
                amountIn: pairOut,
                amountOutMinimum: minimumOut
            })
        );
        IERC20(route.pairToken).forceApprove(OFFICIAL_SWAP_ROUTER_02, 0);
    }

    function _swapGraduated(IERC20 input, bytes memory path, uint256 amountIn, uint256 minimumOut, address recipient)
        private returns (uint256 amountOut)
    {
        input.forceApprove(OFFICIAL_SWAP_ROUTER_02, amountIn);
        amountOut = IStockdealerPonsV3Router(OFFICIAL_SWAP_ROUTER_02).exactInput(
            IStockdealerPonsV3Router.ExactInputParams({path: path, recipient: recipient, amountIn: amountIn, amountOutMinimum: minimumOut})
        );
        input.forceApprove(OFFICIAL_SWAP_ROUTER_02, 0);
    }

    function _decodeRoute(bytes memory encoded) private pure returns (RouteData memory route) {
        (route.curve, route.pairToken, route.activePath) = abi.decode(encoded, (address, address, bytes));
    }

    function _validateRoute(
        address tokenIn,
        address tokenOut,
        RouteData memory route
    ) private view {
        if (route.curve.code.length == 0 || route.pairToken.code.length == 0) revert InvalidPath();
        IStockdealerPonsCurve curve = IStockdealerPonsCurve(route.curve);
        if (curve.token() != tokenIn || curve.pairToken() != route.pairToken) revert InvalidPath();
        if (route.activePath.length == 0) {
            if (route.pairToken != tokenOut) revert InvalidPath();
        } else {
            _validateV3Path(route.activePath, route.pairToken, tokenOut);
        }

    }

    function _validateV3Path(bytes memory path, address expectedFirst, address expectedLast) private view {
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert InvalidPath();
        address first;
        address last;
        assembly {
            first := shr(96, mload(add(path, 32)))
            last := shr(96, mload(add(add(path, 32), sub(mload(path), 20))))
        }
        if (first != expectedFirst || last != expectedLast) revert InvalidPath();
        for (uint256 cursor = 0; cursor + 43 <= path.length; cursor += 23) {
            address tokenA;
            address tokenB;
            uint24 fee;
            assembly {
                tokenA := shr(96, mload(add(add(path, 32), cursor)))
                fee := shr(232, mload(add(add(path, 52), cursor)))
                tokenB := shr(96, mload(add(add(path, 55), cursor)))
            }
            address pool = IStockdealerPonsV3Factory(OFFICIAL_V3_FACTORY).getPool(tokenA, tokenB, fee);
            if (pool.code.length == 0 || IStockdealerPonsV3Pool(pool).liquidity() == 0) revert InvalidPath();
        }
    }

    function _pair(address tokenIn, address tokenOut) private pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, tokenOut));
    }
}
