import { readFile } from 'node:fs/promises';
import { JsonRpcProvider, Contract, getAddress, ZeroAddress, solidityPacked, formatUnits, keccak256 } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';

const ENV_PATH = externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const CURRENCY = getAddress(process.env.STOCKDEALER_TOKEN_ADDRESS ?? '0x8998706ebf337575f05f294036ebfc3d1de01290');
const PONS_FACTORY = getAddress('0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e');
const FACTORY = getAddress('0x1f7d7550B1b028f7571E69A784071F0205FD2EfA');
const QUOTER = getAddress('0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7');
const WETH = getAddress('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73');
const USDG = getAddress('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168');
const STOCKS = {
  AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',
  MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74', MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',
  NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
  TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d'
};
for (const k of Object.keys(STOCKS)) STOCKS[k]=getAddress(STOCKS[k]);
const fees=[100,500,3000,10000];
const envText=await readFile(ENV_PATH,'utf8');
const env=Object.fromEntries(envText.split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true});
const ponsFactory=new Contract(PONS_FACTORY,['function getLaunchedToken(address) view returns((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))'],provider);
const launch=await ponsFactory.getLaunchedToken(CURRENCY);
if(!launch.exists||getAddress(launch.token)!==CURRENCY)throw new Error('TOKEN_NOT_LAUNCHED_BY_PONS_V2');
if(Number(launch.phase)!==0)throw new Error('PONS_TOKEN_NOT_ON_ACTIVE_CURVE');
const PAIR=getAddress(launch.pairToken),CURVE=getAddress(launch.curve);
const factory=new Contract(FACTORY,['function getPool(address,address,uint24) view returns(address)'],provider);
const quoter=new Contract(QUOTER,['function quoteExactInput(bytes,uint256) returns(uint256,uint160[] memory,uint32[] memory,uint256)'],provider);
const erc20=['function symbol() view returns(string)','function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)'];
const poolAbi=['function liquidity() view returns(uint128)','function token0() view returns(address)','function token1() view returns(address)','function fee() view returns(uint24)'];
const tokens={WETH,USDG,...STOCKS};
if(!Object.values(tokens).some(address=>address.toLowerCase()===PAIR.toLowerCase()))tokens.PAIR=PAIR;
const meta={};
for(const [symbol,address] of Object.entries(tokens)){
  const c=new Contract(address,erc20,provider);
  meta[address.toLowerCase()]={label:symbol,address,decimals:Number(await c.decimals())};
}
const entries=Object.entries(tokens);
const edges=[];
for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) for(const fee of fees){
  const [aLabel,a]=entries[i], [bLabel,b]=entries[j];
  const pool=await factory.getPool(a,b,fee);
  if(pool===ZeroAddress) continue;
  const pc=new Contract(pool,poolAbi,provider);
  const liquidity=await pc.liquidity();
  if(liquidity===0n) continue;
  const ca=new Contract(a,erc20,provider), cb=new Contract(b,erc20,provider);
  const [ba,bb]=await Promise.all([ca.balanceOf(pool),cb.balanceOf(pool)]);
  edges.push({a,b,fee,pool:getAddress(pool),liquidity:liquidity.toString(),balances:{[aLabel]:formatUnits(ba,meta[a.toLowerCase()].decimals),[bLabel]:formatUnits(bb,meta[b.toLowerCase()].decimals)}});
}
const adjacency=new Map();
for(const e of edges){
  if(!adjacency.has(e.a.toLowerCase()))adjacency.set(e.a.toLowerCase(),[]);
  if(!adjacency.has(e.b.toLowerCase()))adjacency.set(e.b.toLowerCase(),[]);
  adjacency.get(e.a.toLowerCase()).push({to:e.b,fee:e.fee,pool:e.pool});
  adjacency.get(e.b.toLowerCase()).push({to:e.a,fee:e.fee,pool:e.pool});
}
function encodePath(nodes,routeFees){
  const types=['address'];const vals=[nodes[0]];
  for(let i=0;i<routeFees.length;i++){types.push('uint24','address');vals.push(routeFees[i],nodes[i+1]);}
  return solidityPacked(types,vals);
}
function pathsTo(target,maxHops=4){
 const out=[];
 function walk(nodes,fs){
  const cur=nodes.at(-1);
  if(cur.toLowerCase()===target.toLowerCase()){out.push({nodes:[...nodes],fees:[...fs]});return;}
  if(fs.length>=maxHops)return;
  for(const e of adjacency.get(cur.toLowerCase())??[]){
   if(nodes.some(n=>n.toLowerCase()===e.to.toLowerCase()))continue;
   const isTarget=e.to.toLowerCase()===target.toLowerCase();
   const isApprovedBridge=[USDG,WETH].some(bridge=>bridge.toLowerCase()===e.to.toLowerCase());
   if(!isTarget&&!isApprovedBridge)continue;
   walk([...nodes,e.to],[...fs,e.fee]);
  }
 }
 walk([PAIR],[]);return out;
}
const amountIn=10n**BigInt(meta[PAIR.toLowerCase()].decimals);
const routes={};
for(const [symbol,target] of Object.entries(STOCKS)){
 const candidates=[];
 for(const p of pathsTo(target,4)){
  const path=encodePath(p.nodes,p.fees);
  try{
   const q=await quoter.quoteExactInput.staticCall(path,amountIn);
   candidates.push({path,labels:p.nodes.map(n=>meta[n.toLowerCase()].label),fees:p.fees,amountOut:q[0].toString(),amountOutUi:formatUnits(q[0],meta[target.toLowerCase()].decimals),gasEstimate:q[3].toString()});
  }catch{}
 }
 candidates.sort((a,b)=>a.fees.length-b.fees.length||(BigInt(a.amountOut)>BigInt(b.amountOut)?-1:1));
 routes[symbol]=candidates.slice(0,3);
}
const block=await provider.getBlockNumber();
const currencyContract=new Contract(CURRENCY,erc20,provider);
console.log(JSON.stringify({block,currency:CURRENCY,currencySymbol:await currencyContract.symbol(),currencyCodeHash:keccak256(await provider.getCode(CURRENCY)),pons:{factory:PONS_FACTORY,curve:CURVE,pairToken:PAIR,poolFee:Number(launch.poolFee),phase:Number(launch.phase)},amountInUi:formatUnits(amountIn,meta[PAIR.toLowerCase()].decimals),allLiquidPoolCount:edges.length,routes},null,2));
