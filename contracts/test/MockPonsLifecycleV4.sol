// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPonsFactoryLifecycleV4 {
    struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }
    LaunchedToken private launch;
    address public poolManager;
    address public memeHook;
    function setInfrastructure(address manager, address hook) external { poolManager=manager; memeHook=hook; }
    function setLaunch(address token,address curve,address pairToken,uint8 phase) external { launch=LaunchedToken(token,curve,msg.sender,msg.sender,pairToken,1,0,200,0,false,phase,0,0,0,true); }
    function getLaunchedToken(address) external view returns(LaunchedToken memory){ return launch; }
}

contract MockPonsCurveLifecycleV4 {
    address public token;
    address public pairToken;
    bool public graduated;
    bool public readyToGraduate;
    uint256 public output;
    constructor(address token_,address pairToken_){token=token_;pairToken=pairToken_;}
    function setState(bool graduated_,bool ready_) external { graduated=graduated_;readyToGraduate=ready_; }
    function setOutput(uint256 value) external { output=value; }
    function sell(uint256 amountIn,uint256,address recipient) external returns(uint256){ IERC20(token).transferFrom(msg.sender,address(this),amountIn); IERC20(pairToken).transfer(recipient,output); return output; }
}

contract MockPermit2LifecycleV4 {
    mapping(address=>mapping(address=>mapping(address=>uint160))) public limits;
    function approve(address token,address spender,uint160 amount,uint48) external { limits[msg.sender][token][spender]=amount; }
    function pull(address owner,address token,address to,uint160 amount) external { require(limits[owner][token][msg.sender]>=amount); limits[owner][token][msg.sender]-=amount; IERC20(token).transferFrom(owner,to,amount); }
}

interface IMintableLifecycleV4 { function mint(address,uint256) external; }
contract MockUniversalRouterLifecycleV4 {
    MockPermit2LifecycleV4 public immutable permit2;
    address public input;
    address public output;
    uint160 public amountIn;
    uint256 public amountOut;
    constructor(address permit2_){permit2=MockPermit2LifecycleV4(permit2_);}
    function configure(address input_,address output_,uint160 amountIn_,uint256 amountOut_) external {input=input_;output=output_;amountIn=amountIn_;amountOut=amountOut_;}
    function execute(bytes calldata commands,bytes[] calldata inputs,uint256 deadline) external payable {
        require(commands.length==1&&commands[0]==0x10&&inputs.length==1&&block.timestamp<=deadline);
        (bytes memory actions,bytes[] memory params)=abi.decode(inputs[0],(bytes,bytes[]));
        require(actions.length==3&&actions[0]==0x06&&actions[1]==0x0c&&actions[2]==0x0f&&params.length==3);
        (address settleCurrency,uint256 settleMaximum)=abi.decode(params[1],(address,uint256));
        (address takeCurrency,uint256 takeMinimum)=abi.decode(params[2],(address,uint256));
        require(settleCurrency==input&&settleMaximum==type(uint256).max&&takeCurrency==output&&takeMinimum>0);
        permit2.pull(msg.sender,input,address(this),amountIn);
        if(output==address(0)){ (bool ok,)=msg.sender.call{value:amountOut}(""); require(ok); }
        else IMintableLifecycleV4(output).mint(msg.sender,amountOut);
    }
    receive() external payable {}
}

contract MockV3PoolLifecycleV4 { function liquidity() external pure returns(uint128){return 1;} }
contract MockV3FactoryLifecycleV4 {
    address public immutable pool=address(new MockV3PoolLifecycleV4());
    function getPool(address,address,uint24) external view returns(address){return pool;}
}
contract MockV3RouterLifecycleV4 {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }
    address public immutable factory;
    constructor(address factory_){factory=factory_;}
    function exactInput(ExactInputParams calldata params) external payable returns(uint256 amountOut){
        require(msg.value==params.amountIn&&params.amountIn>=params.amountOutMinimum);
        address output; bytes calldata path=params.path;
        assembly { output := shr(96,calldataload(add(path.offset,sub(path.length,20)))) }
        amountOut=params.amountIn;
        IMintableLifecycleV4(output).mint(params.recipient,amountOut);
    }
}

interface ILifecycleAdapterV4 { function swapExactInput(address,address,uint256,uint256,uint256,address) external returns(uint256); }
contract MockLifecycleCallerV4 {
    function callSwap(address adapter,address tokenIn,address tokenOut,uint256 amount,uint256 minimum,address recipient) external returns(uint256){ IERC20(tokenIn).approve(adapter,amount); return ILifecycleAdapterV4(adapter).swapExactInput(tokenIn,tokenOut,amount,minimum,block.timestamp+300,recipient); }
}
