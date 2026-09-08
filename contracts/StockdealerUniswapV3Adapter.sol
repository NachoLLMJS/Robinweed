// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISwapRouter02 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

contract StockdealerUniswapV3Adapter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    address public constant OFFICIAL_SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address public immutable economyRouter;
    bool public configurationFrozen;
    mapping(bytes32 pair => bytes path) private paths;

    error WrongChain();
    error InvalidContract();
    error InvalidPath();
    error ConfigurationIsFrozen();
    error ConfigurationNotFrozen();
    error UnauthorizedRouter();
    error DeadlineExpired();

    event PathConfigured(address indexed tokenIn, address indexed tokenOut, bytes path);
    event ConfigurationFrozen();

    constructor(address initialOwner, address economyRouter_) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if (economyRouter_.code.length == 0 || OFFICIAL_SWAP_ROUTER_02.code.length == 0) revert InvalidContract();
        economyRouter = economyRouter_;
    }

    function configurePath(address tokenIn, address tokenOut, bytes calldata path) external onlyOwner {
        if (configurationFrozen) revert ConfigurationIsFrozen();
        if (tokenIn.code.length == 0 || tokenOut.code.length == 0 || path.length < 43 || (path.length - 20) % 23 != 0) revert InvalidPath();
        address first;
        address last;
        assembly {
            first := shr(96, calldataload(path.offset))
            last := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        if (first != tokenIn || last != tokenOut) revert InvalidPath();
        paths[_pair(tokenIn, tokenOut)] = path;
        emit PathConfigured(tokenIn, tokenOut, path);
    }

    function freezeConfiguration() external onlyOwner {
        configurationFrozen = true;
        emit ConfigurationFrozen();
    }

    function pathFor(address tokenIn, address tokenOut) external view returns (bytes memory) {
        return paths[_pair(tokenIn, tokenOut)];
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
        bytes memory path = paths[_pair(tokenIn, tokenOut)];
        if (path.length == 0 || recipient == address(0) || amountIn == 0) revert InvalidPath();
        IERC20 input = IERC20(tokenIn);
        input.safeTransferFrom(msg.sender, address(this), amountIn);
        input.forceApprove(OFFICIAL_SWAP_ROUTER_02, amountIn);
        amountOut = ISwapRouter02(OFFICIAL_SWAP_ROUTER_02).exactInput(ISwapRouter02.ExactInputParams({
            path: path,
            recipient: recipient,
            amountIn: amountIn,
            amountOutMinimum: minimumOut
        }));
        input.forceApprove(OFFICIAL_SWAP_ROUTER_02, 0);
    }

    function _pair(address tokenIn, address tokenOut) private pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, tokenOut));
    }
}
