import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { AbiCoder, Interface, JsonRpcProvider, concat, getAddress, getCreateAddress, keccak256 } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';

const ENV_PATH=externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const CONFIG_PATH=externalConfigPath('STOCKDEALER_FLYCO_REHEARSAL_ONLY.json');
const TOKEN='0x8998706ebf337575f05f294036ebfc3d1de01290';
const CURVE='0x06407991dBA173B03b800795c539f13a3652De8f';
const CALLER='0x8fa742B55c01B9dbE563dC77eB53a3ba614a0914';
const SWAP_ROUTER='0xCaf681a66D020601342297493863E78C959E5cb2';
const STOCKS={AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d'};
const requestedSymbol=process.env.STOCKDEALER_REHEARSAL_SYMBOL;
if(requestedSymbol&&!STOCKS[requestedSymbol])throw new Error('INVALID_REHEARSAL_SYMBOL');
const selectedStocks=requestedSymbol?{[requestedSymbol]:STOCKS[requestedSymbol]}:STOCKS;
const executeFile=promisify(execFile);
await executeFile(process.execPath,[resolve('node_modules/hardhat/dist/src/cli.js'),'compile','--force'],{cwd:resolve('.')});
const envText=await readFile(ENV_PATH,'utf8');
const env=Object.fromEntries(envText.split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
const config=JSON.parse(await readFile(CONFIG_PATH,'utf8'));
if(config.rehearsalOnly!==true)throw new Error('REHEARSAL_ONLY_CONFIG_REQUIRED');
const artifact=JSON.parse(await readFile('artifacts/contracts/StockdealerPonsAdapter.sol/StockdealerPonsAdapter.json','utf8'));
const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true});
const block=await provider.getBlock('latest');
const blockTag=`0x${block.number.toString(16)}`;
const deployer=getAddress(env.EXPECTED_DEPLOYER_ADDRESS);
const nonce=await provider.getTransactionCount(deployer,blockTag);
const adapter=getCreateAddress({from:deployer,nonce});
const adapterIface=new Interface(artifact.abi);
const erc20=new Interface(['function transfer(address,uint256) returns(bool)','function approve(address,uint256) returns(bool)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
const amount=449173266680728645481369n;
const receiver=deployer;
const deadline=BigInt(block.timestamp+3600);

function buildCalls(minimumOutBySymbol){
  const constructorArgs=AbiCoder.defaultAbiCoder().encode(['address','address'],[deployer,CALLER]);
  const calls=[{from:deployer,data:concat([artifact.bytecode,constructorArgs]),value:'0x0'}];
  for(const [symbol,target] of Object.entries(selectedStocks))calls.push({from:deployer,to:adapter,data:adapterIface.encodeFunctionData('configurePath',[TOKEN,target,config.paths[symbol]]),value:'0x0'});
  calls.push({from:deployer,to:adapter,data:adapterIface.encodeFunctionData('freezeConfiguration',[]),value:'0x0'});
  const indexes={};
  for(const [symbol,target] of Object.entries(selectedStocks)){
    const [,pairToken]=AbiCoder.defaultAbiCoder().decode(['address','address','bytes'],config.paths[symbol]);
    calls.push({from:CURVE,to:TOKEN,data:erc20.encodeFunctionData('transfer',[CALLER,amount]),value:'0x0'});
    calls.push({from:CALLER,to:TOKEN,data:erc20.encodeFunctionData('approve',[adapter,amount]),value:'0x0'});
    const before=calls.push({from:CALLER,to:target,data:erc20.encodeFunctionData('balanceOf',[receiver]),value:'0x0'})-1;
    const swap=calls.push({from:CALLER,to:adapter,data:adapterIface.encodeFunctionData('swapExactInput',[TOKEN,target,amount,minimumOutBySymbol[symbol]??1n,deadline,receiver]),value:'0x0'})-1;
    const after=calls.push({from:CALLER,to:target,data:erc20.encodeFunctionData('balanceOf',[receiver]),value:'0x0'})-1;
    const checks=[];
    for(const [token,method,args] of [[TOKEN,'balanceOf',[adapter]],[pairToken,'balanceOf',[adapter]],[target,'balanceOf',[adapter]],[TOKEN,'allowance',[CALLER,adapter]],[TOKEN,'allowance',[adapter,CURVE]],[pairToken,'allowance',[adapter,SWAP_ROUTER]]])checks.push(calls.push({from:CALLER,to:token,data:erc20.encodeFunctionData(method,args),value:'0x0'})-1);
    indexes[symbol]={before,swap,after,checks};
  }
  return {calls,indexes};
}

async function simulate(minimumOutBySymbol){
  const {calls,indexes}=buildCalls(minimumOutBySymbol);
  // validation:false is required only because this no-broadcast rehearsal impersonates funded mainnet accounts.
  const result=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls}],validation:false},blockTag]);
  const rows=result[0].calls;
  const failedIndex=rows.findIndex(row=>row.status!=='0x1');
  if(failedIndex!==-1)throw new Error(`SIMULATION_FAILED:${failedIndex}:${rows[failedIndex].returnData??''}`);
  const outputs={};
  for(const [symbol,index] of Object.entries(indexes)){
    const before=erc20.decodeFunctionResult('balanceOf',rows[index.before].returnData)[0];
    const after=erc20.decodeFunctionResult('balanceOf',rows[index.after].returnData)[0];
    const residue=index.checks.map(callIndex=>erc20.decodeFunctionResult(callIndex===index.checks[3]||callIndex===index.checks[4]||callIndex===index.checks[5]?'allowance':'balanceOf',rows[callIndex].returnData)[0]);
    if(residue.some(value=>value!==0n))throw new Error(`ADAPTER_RESIDUE_DETECTED:${symbol}`);
    const amountOut=after-before;
    if(amountOut<=0n)throw new Error(`SIMULATION_ZERO_OUTPUT:${symbol}`);
    if(minimumOutBySymbol[symbol]!==undefined&&amountOut<minimumOutBySymbol[symbol])throw new Error(`SIMULATION_MINIMUM_OUTPUT_NOT_MET:${symbol}`);
    outputs[symbol]={amountOut,gasUsed:rows[index.swap].gasUsed};
  }
  return {calls,outputs};
}

const discovery=await simulate({});
const minimumOutBySymbol=Object.fromEntries(Object.entries(discovery.outputs).map(([symbol,row])=>[symbol,(row.amountOut*99n+99n)/100n]));
const bounded=await simulate(minimumOutBySymbol);
console.log(JSON.stringify({block:block.number,blockHash:block.hash,adapterWouldDeployAt:adapter,artifactCreationBytecodeHash:keccak256(artifact.bytecode),validationMode:'impersonated-rehearsal-only',allStatusesSuccessful:true,minimumOutBySymbol:Object.fromEntries(Object.entries(minimumOutBySymbol).map(([k,v])=>[k,v.toString()])),outputs:Object.fromEntries(Object.entries(bounded.outputs).map(([symbol,row])=>[symbol,{amountOut:row.amountOut.toString(),gasUsed:row.gasUsed}]))},null,2));
