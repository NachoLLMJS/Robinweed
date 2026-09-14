// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPonsLifecycleFactoryV4 {
    struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }
    function getLaunchedToken(address token) external view returns (LaunchedToken memory);
    function poolManager() external view returns (address);
    function memeHook() external view returns (address);
}
interface IPonsLifecycleCurveV4 {
    function token() external view returns(address);
    function pairToken() external view returns(address);
    function graduated() external view returns(bool);
    function readyToGraduate() external view returns(bool);
    function sell(uint256 amountIn,uint256 minimumOut,address recipient) external returns(uint256 amountOut);
}
interface IPermit2LifecycleV4 {
    function approve(address token,address spender,uint160 amount,uint48 expiration) external;
}
interface IUniversalRouterLifecycleV4 {
    function execute(bytes calldata commands,bytes[] calldata inputs,uint256 deadline) external payable;
}
interface IV3RouterLifecycleV4 {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns(uint256 amountOut);
    function factory() external view returns(address);
}
interface IV3FactoryLifecycleV4 { function getPool(address,address,uint24) external view returns(address); }
interface IV3PoolLifecycleV4 { function liquidity() external view returns(uint128); }

contract StockdealerPonsLifecycleAdapterV4 is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID=4663;
    uint8 private constant PHASE_CURVE=0;
    uint8 private constant PHASE_SWEPT=1;
    uint8 private constant PHASE_POOL_CREATED=2;
    bytes1 private constant COMMAND_V4_SWAP=0x10;
    bytes1 private constant ACTION_SWAP_EXACT_IN_SINGLE=0x06;
    bytes1 private constant ACTION_SETTLE_ALL=0x0c;
    bytes1 private constant ACTION_TAKE_ALL=0x0f;

    struct RouteData { address curve; address pairToken; bytes activePath; }
    struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }
    struct ExactInputSingleParams { PoolKey poolKey; bool zeroForOne; uint128 amountIn; uint128 amountOutMinimum; uint256 minHopPriceX36; bytes hookData; }

    address public immutable economyRouter;
    IPonsLifecycleFactoryV4 public immutable ponsFactory;
    address public immutable universalRouter;
    address public immutable permit2;
    address public immutable v3Router;
    address public immutable v3Factory;
    address public immutable weth;
    bool public configurationFrozen;
    mapping(bytes32=>bytes) private routeDataByPair;

    error WrongChain(); error InvalidContract(); error InvalidPath(); error ConfigurationIsFrozen(); error ConfigurationNotFrozen();
    error UnauthorizedRouter(); error DeadlineExpired(); error CurveTransitioning(); error LaunchRescued(); error MinimumOutputNotMet(); error AmountTooLarge();
    event PathConfigured(address indexed tokenIn,address indexed tokenOut,bytes routeData);
    event ConfigurationFrozen();

    constructor(address initialOwner,address economyRouter_,address ponsFactory_,address universalRouter_,address permit2_,address v3Router_,address v3Factory_,address weth_) Ownable(initialOwner) {
        if(block.chainid!=ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if(economyRouter_.code.length==0||ponsFactory_.code.length==0||universalRouter_.code.length==0||permit2_.code.length==0||v3Router_.code.length==0||v3Factory_.code.length==0) revert InvalidContract();
        if(IV3RouterLifecycleV4(v3Router_).factory()!=v3Factory_) revert InvalidContract();
        economyRouter=economyRouter_;ponsFactory=IPonsLifecycleFactoryV4(ponsFactory_);universalRouter=universalRouter_;permit2=permit2_;v3Router=v3Router_;v3Factory=v3Factory_;weth=weth_;
    }

    receive() external payable {}

    function configurePath(address tokenIn,address tokenOut,bytes calldata routeData) external onlyOwner {
        if(configurationFrozen) revert ConfigurationIsFrozen();
        if(tokenIn.code.length==0||tokenOut.code.length==0||routeData.length==0) revert InvalidPath();
        RouteData memory route=_decodeRoute(routeData);
        _validateRoute(tokenIn,tokenOut,route);
        routeDataByPair[_pair(tokenIn,tokenOut)]=routeData;
        emit PathConfigured(tokenIn,tokenOut,routeData);
    }
    function freezeConfiguration() external onlyOwner { configurationFrozen=true; emit ConfigurationFrozen(); }
    function pathFor(address tokenIn,address tokenOut) external view returns(bytes memory){return routeDataByPair[_pair(tokenIn,tokenOut)];}
    function nativeBalance() external view returns(uint256){ return address(this).balance; }

    function swapExactInput(address tokenIn,address tokenOut,uint256 amountIn,uint256 minimumOut,uint256 deadline,address recipient) external nonReentrant returns(uint256 amountOut){
        if(msg.sender!=economyRouter) revert UnauthorizedRouter();
        if(!configurationFrozen) revert ConfigurationNotFrozen();
        if(block.timestamp>deadline) revert DeadlineExpired();
        if(recipient==address(0)||amountIn==0) revert InvalidPath();
        bytes memory encoded=routeDataByPair[_pair(tokenIn,tokenOut)];
        if(encoded.length==0) revert InvalidPath();
        RouteData memory route=_decodeRoute(encoded);
        IPonsLifecycleFactoryV4.LaunchedToken memory launch=_validatedLaunch(tokenIn,route);
        IERC20 input=IERC20(tokenIn);
        input.safeTransferFrom(msg.sender,address(this),amountIn);
        uint256 pairOut;
        if(launch.phase==PHASE_CURVE){
            IPonsLifecycleCurveV4 curve=IPonsLifecycleCurveV4(route.curve);
            if(curve.graduated()||curve.readyToGraduate()) revert CurveTransitioning();
            uint256 beforeBalance=_balance(route.pairToken);
            input.forceApprove(route.curve,amountIn);
            curve.sell(amountIn,0,address(this));
            input.forceApprove(route.curve,0);
            pairOut=_balance(route.pairToken)-beforeBalance;
        } else if(launch.phase==PHASE_SWEPT){
            revert CurveTransitioning();
        } else if(launch.phase==PHASE_POOL_CREATED){
            pairOut=_swapV4(input,tokenIn,route.pairToken,launch.poolFee,launch.tickSpacing,amountIn,route.activePath.length==0?minimumOut:1,deadline);
        } else {
            revert LaunchRescued();
        }
        if(pairOut==0) revert MinimumOutputNotMet();
        amountOut=_routePairOutput(route,tokenOut,pairOut,minimumOut,recipient);
    }

    function _swapV4(IERC20 input,address tokenIn,address pairToken,uint24 fee,int24 tickSpacing,uint256 amountIn,uint256 v4Minimum,uint256 deadline) private returns(uint256 pairOut){
        if(amountIn>type(uint128).max||amountIn>type(uint160).max||v4Minimum>type(uint128).max||deadline>type(uint48).max) revert AmountTooLarge();
        uint256 beforeBalance=_balance(pairToken);
        bytes[] memory inputs=_v4Inputs(tokenIn,pairToken,fee,tickSpacing,uint128(amountIn),uint128(v4Minimum));
        input.forceApprove(permit2,amountIn);
        IPermit2LifecycleV4(permit2).approve(tokenIn,universalRouter,uint160(amountIn),uint48(deadline));
        IUniversalRouterLifecycleV4(universalRouter).execute(abi.encodePacked(COMMAND_V4_SWAP),inputs,deadline);
        IPermit2LifecycleV4(permit2).approve(tokenIn,universalRouter,0,uint48(block.timestamp));
        input.forceApprove(permit2,0);
        pairOut=_balance(pairToken)-beforeBalance;
    }

    function _v4Inputs(address tokenIn,address pairToken,uint24 fee,int24 tickSpacing,uint128 amountIn,uint128 minimumOut) private view returns(bytes[] memory inputs){
        (address currency0,address currency1)=tokenIn<pairToken?(tokenIn,pairToken):(pairToken,tokenIn);
        PoolKey memory key=PoolKey(currency0,currency1,fee,tickSpacing,ponsFactory.memeHook());
        ExactInputSingleParams memory swapParams=ExactInputSingleParams(key,tokenIn==currency0,amountIn,minimumOut,0,bytes(""));
        bytes[] memory actionsParams=new bytes[](3);
        actionsParams[0]=abi.encode(swapParams);
        actionsParams[1]=abi.encode(tokenIn,type(uint256).max);
        actionsParams[2]=abi.encode(pairToken,uint256(minimumOut));
        inputs=new bytes[](1);
        inputs[0]=abi.encode(abi.encodePacked(ACTION_SWAP_EXACT_IN_SINGLE,ACTION_SETTLE_ALL,ACTION_TAKE_ALL),actionsParams);
    }

    function _routePairOutput(RouteData memory route,address tokenOut,uint256 pairOut,uint256 minimumOut,address recipient) private returns(uint256 amountOut){
        if(route.activePath.length==0){
            if(route.pairToken!=tokenOut||pairOut<minimumOut) revert MinimumOutputNotMet();
            IERC20(tokenOut).safeTransfer(recipient,pairOut);
            return pairOut;
        }
        if(route.pairToken==address(0)){
            amountOut=IV3RouterLifecycleV4(v3Router).exactInput{value:pairOut}(IV3RouterLifecycleV4.ExactInputParams(route.activePath,recipient,pairOut,minimumOut));
        }else{
            IERC20(route.pairToken).forceApprove(v3Router,pairOut);
            amountOut=IV3RouterLifecycleV4(v3Router).exactInput(IV3RouterLifecycleV4.ExactInputParams(route.activePath,recipient,pairOut,minimumOut));
            IERC20(route.pairToken).forceApprove(v3Router,0);
        }
    }

    function _validatedLaunch(address tokenIn,RouteData memory route) private view returns(IPonsLifecycleFactoryV4.LaunchedToken memory launch){
        launch=ponsFactory.getLaunchedToken(tokenIn);
        if(!launch.exists||launch.token!=tokenIn||launch.curve!=route.curve||launch.pairToken!=route.pairToken||route.curve.code.length==0) revert InvalidPath();
        IPonsLifecycleCurveV4 curve=IPonsLifecycleCurveV4(route.curve);
        if(curve.token()!=tokenIn||curve.pairToken()!=route.pairToken) revert InvalidPath();
    }
    function _validateRoute(address tokenIn,address tokenOut,RouteData memory route) private view {
        IPonsLifecycleFactoryV4.LaunchedToken memory launch=_validatedLaunch(tokenIn,route);
        if(launch.phase!=PHASE_CURVE) revert InvalidPath();
        if(route.activePath.length==0){if(route.pairToken!=tokenOut||route.pairToken==address(0)) revert InvalidPath();}
        else _validateV3Path(route.activePath,route.pairToken==address(0)?weth:route.pairToken,tokenOut);
    }
    function _validateV3Path(bytes memory path,address expectedFirst,address expectedLast) private view {
        if(expectedFirst.code.length==0||path.length<43||(path.length-20)%23!=0) revert InvalidPath();
        address first;address last; assembly { first:=shr(96,mload(add(path,32))) last:=shr(96,mload(add(add(path,32),sub(mload(path),20)))) }
        if(first!=expectedFirst||last!=expectedLast) revert InvalidPath();
        for(uint256 cursor;cursor+43<=path.length;cursor+=23){address a;address b;uint24 fee;assembly{a:=shr(96,mload(add(add(path,32),cursor))) fee:=shr(232,mload(add(add(path,52),cursor))) b:=shr(96,mload(add(add(path,55),cursor)))} address pool=IV3FactoryLifecycleV4(v3Factory).getPool(a,b,fee);if(pool.code.length==0||IV3PoolLifecycleV4(pool).liquidity()==0)revert InvalidPath();}
    }
    function _balance(address asset) private view returns(uint256){return asset==address(0)?address(this).balance:IERC20(asset).balanceOf(address(this));}
    function _decodeRoute(bytes memory encoded) private pure returns(RouteData memory route){(route.curve,route.pairToken,route.activePath)=abi.decode(encoded,(address,address,bytes));}
    function _pair(address a,address b) private pure returns(bytes32){return keccak256(abi.encode(a,b));}
}
