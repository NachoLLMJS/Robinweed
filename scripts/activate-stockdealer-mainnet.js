import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, keccak256, parseUnits, toUtf8Bytes } from 'ethers';
import { validateActivationConfig } from './lib/activationConfig.js';

const CHAIN_ID = 4663;
const ENV_PATH = process.env.STOCKDEALER_MAINNET_ENV ?? 'C:\\Users\\nacho\\Desktop\\STOCKDEALER_MAINNET_DEPLOY.env';
const ACTIVATION_PATH = process.env.STOCKDEALER_ACTIVATION_CONFIG ?? 'C:\\Users\\nacho\\Desktop\\STOCKDEALER_MAINNET_ACTIVATION.json';
const FOUNDATION_PATH = resolve('deployments/robinhood-mainnet-foundation.json');
const SAFE_BATCH_PATH = resolve('deployments/safe-activation-batch.json');
const QUOTER_V2 = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';
const STOCKS = Object.freeze({ AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d' });
const ERC20_ABI=['function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)','function burn(uint256)'];
const QUOTER_ABI=['function quoteExactInput(bytes,uint256) returns(uint256,uint160[] memory,uint32[] memory,uint256)'];
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const tickerBytes=symbol=>`0x${Buffer.from(symbol).toString('hex').padEnd(64,'0')}`;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const encode=(iface,method,args)=>iface.encodeFunctionData(method,args);
const executeFile=promisify(execFile);
async function ensureFreshBuild(){await executeFile(process.execPath,[resolve('node_modules/hardhat/dist/src/cli.js'),'compile','--force'],{cwd:resolve('.')});}
function maskImmutableReferences(bytecode,immutableReferences={}){const bytes=Buffer.from(bytecode.slice(2),'hex');for(const references of Object.values(immutableReferences))for(const {start,length}of references)bytes.fill(0,start,start+length);return`0x${bytes.toString('hex')}`;}
function assertCurrentRuntime(name,runtimeCode,artifactValue){if(runtimeCode==='0x'||runtimeCode.length!==artifactValue.deployedBytecode.length||maskImmutableReferences(runtimeCode,artifactValue.immutableReferences).toLowerCase()!==artifactValue.deployedBytecode.toLowerCase())throw new Error(`DEPLOYED_RUNTIME_ARTIFACT_MISMATCH:${name}`);}

async function artifact(source,name){return JSON.parse(await readFile(resolve(`artifacts/contracts/${source}.sol/${name}.json`),'utf8'));}
async function atomicWrite(path,value){await mkdir(dirname(path),{recursive:true});const temporary=`${path}.tmp`;await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`);await rename(temporary,path);}
async function simulateSafeBatch(provider,admin,transactions){
  let result;
  try{result=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls:transactions.map(transaction=>({from:admin,to:transaction.to,data:transaction.data,value:'0x0'}))}],traceTransfers:false,validation:true},'latest']);}
  catch{throw new Error('SAFE_BATCH_SIMULATION_UNAVAILABLE');}
  const calls=result?.[0]?.calls;
  if(!Array.isArray(calls)||calls.length!==transactions.length||calls.some(call=>call?.status!=='0x1'))throw new Error('SAFE_BATCH_SIMULATION_FAILED');
}
async function simulatePositiveBurn(provider,token,router,burnProbeHolder){
  const amount=1n,tokenAddress=await token.getAddress(),routerAddress=await router.getAddress();
  const call=(from,method,args=[])=>({from,to:tokenAddress,data:token.interface.encodeFunctionData(method,args),value:'0x0'});
  let result;
  try{result=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls:[call(burnProbeHolder,'balanceOf',[burnProbeHolder]),call(burnProbeHolder,'balanceOf',[routerAddress]),call(burnProbeHolder,'totalSupply'),call(burnProbeHolder,'transfer',[routerAddress,amount]),call(routerAddress,'burn',[amount]),call(burnProbeHolder,'balanceOf',[burnProbeHolder]),call(burnProbeHolder,'balanceOf',[routerAddress]),call(burnProbeHolder,'totalSupply')]}],traceTransfers:false,validation:false},'latest']);}
  catch{throw new Error('POSITIVE_BURN_SIMULATION_UNAVAILABLE');}
  const calls=result?.[0]?.calls;
  if(!Array.isArray(calls)||calls.length!==8||calls.some(entry=>entry?.status!=='0x1'))throw new Error('POSITIVE_BURN_INVARIANT_FAILED');
  const decoded=(index,method)=>token.interface.decodeFunctionResult(method,calls[index].returnData)[0];
  const holderBefore=decoded(0,'balanceOf'),routerBefore=decoded(1,'balanceOf'),supplyBefore=decoded(2,'totalSupply');
  const holderAfter=decoded(5,'balanceOf'),routerAfter=decoded(6,'balanceOf'),supplyAfter=decoded(7,'totalSupply');
  if(holderBefore<amount||holderAfter!==holderBefore-amount||routerAfter!==routerBefore||supplyAfter!==supplyBefore-amount)throw new Error('POSITIVE_BURN_INVARIANT_FAILED');
}

async function main(){
  const env=parseEnv(await readFile(ENV_PATH,'utf8'));
  if(!env.ROBINHOOD_MAINNET_RPC_URL||!env.ADMIN_MULTISIG_ADDRESS)throw new Error('MAINNET_RPC_AND_MULTISIG_REQUIRED');
  const activation=validateActivationConfig(JSON.parse(await readFile(ACTIVATION_PATH,'utf8')));
  await ensureFreshBuild();
  const foundation=JSON.parse(await readFile(FOUNDATION_PATH,'utf8'));
  if(foundation.chainId!==CHAIN_ID||foundation.status!=='FOUNDATION_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED'||!foundation.codeHashes)throw new Error('FOUNDATION_NOT_VERIFIABLE');
  const admin=getAddress(env.ADMIN_MULTISIG_ADDRESS);
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,CHAIN_ID,{staticNetwork:true});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const routerArtifact=await artifact('StockdealerEconomyRouter','StockdealerEconomyRouter');
  const adapterArtifact=await artifact('StockdealerUniswapV3Adapter','StockdealerUniswapV3Adapter');
  const coreArtifact=await artifact('StockdealerGameCore','StockdealerGameCore');
  const vaultArtifact=await artifact('StockdealerRewardVault','StockdealerRewardVault');
  const artifacts={EconomyRouter:routerArtifact,UniswapV3Adapter:adapterArtifact,GameCore:coreArtifact};
  const router=new Contract(foundation.contracts.EconomyRouter,routerArtifact.abi,provider);
  const adapter=new Contract(foundation.contracts.UniswapV3Adapter,adapterArtifact.abi,provider);
  const core=new Contract(foundation.contracts.GameCore,coreArtifact.abi,provider);
  for(const [name,address] of Object.entries(foundation.contracts)){
    const code=await provider.getCode(address);
    if(code==='0x'||keccak256(code).toLowerCase()!==foundation.codeHashes[name]?.toLowerCase())throw new Error(`DEPLOYED_CODE_MISMATCH:${name}`);
    const artifactValue=name.startsWith('Vault_')?vaultArtifact:artifacts[name];
    assertCurrentRuntime(name,code,artifactValue);
    const abi=artifactValue.abi;
    const contract=new Contract(address,abi,provider);
    if(getAddress(await contract.owner())!==admin||getAddress(await contract.pendingOwner())!==ZeroAddress)throw new Error(`MULTISIG_OWNERSHIP_NOT_ACCEPTED:${name}`);
  }
  if(!(await router.paused())||!(await core.purchasesPaused())||!(await core.gameplayPaused())||!(await core.claimsPaused())||await adapter.configurationFrozen())throw new Error('FOUNDATION_STATE_UNSAFE');
  const token=new Contract(activation.tokenAddress,ERC20_ABI,provider);
  const tokenCode=await provider.getCode(activation.tokenAddress);
  if(tokenCode==='0x'||keccak256(tokenCode).toLowerCase()!==activation.expectedTokenCodeHash.toLowerCase()||await token.symbol()!==activation.expectedTokenSymbol||await token.totalSupply()<=0n)throw new Error('TOKEN_VERIFICATION_FAILED');
  const decimals=Number(await token.decimals());
  const seedPrice=parseUnits(activation.seedPackPriceTokens,decimals);
  if(seedPrice%5n!==0n)throw new Error('SEED_PRICE_NOT_DIVISIBLE_BY_FIVE');
  await simulatePositiveBurn(provider,token,router,activation.burnProbeHolder);
  const quoter=new Contract(QUOTER_V2,QUOTER_ABI,provider);
  for(const symbol of activation.symbols){
    const path=activation.paths[symbol];
    if(getAddress(`0x${path.slice(2,42)}`)!==activation.tokenAddress||getAddress(`0x${path.slice(-40)}`)!==getAddress(STOCKS[symbol]))throw new Error(`PATH_ENDPOINT_MISMATCH:${symbol}`);
    const route=await router.routes(tickerBytes(symbol));
    if(!route.enabled||getAddress(route.rewardToken)!==getAddress(STOCKS[symbol])||getAddress(route.rewardVault)!==getAddress(foundation.contracts[`Vault_${symbol}`])||getAddress(route.adapter)!==getAddress(await adapter.getAddress()))throw new Error(`INITIAL_ROUTE_MISMATCH:${symbol}`);
    if((await adapter.pathFor(activation.tokenAddress,STOCKS[symbol]))!=='0x')throw new Error(`INITIAL_PATH_NOT_EMPTY:${symbol}`);
    const sku=await core.seedSkus(tickerBytes(symbol));
    if(sku.configured||sku.packPrice!==0n||sku.seedsPerPack!==0n||getAddress(sku.rewardVault)!==ZeroAddress)throw new Error(`INITIAL_SEED_SKU_NOT_EMPTY:${symbol}`);
    if((await quoter.quoteExactInput.staticCall(path,seedPrice*6n/10n))[0]<=0n)throw new Error(`ZERO_LIVE_QUOTE:${symbol}`);
  }
  const [initialBasketTickers,initialBasketWeights]=await core.houseBasket();
  if(initialBasketTickers.length!==0||initialBasketWeights.length!==0)throw new Error('INITIAL_BASKET_NOT_EMPTY');
  for(const house of activation.houses){
    if(parseUnits(house.priceTokens,decimals)%5n!==0n)throw new Error(`HOUSE_PRICE_NOT_DIVISIBLE_BY_FIVE:${house.id}`);
    const current=await core.houses(house.onchainId);
    if(current.configured||current.price!==0n||current.capacity!==0n||getAddress(await core.houseOwner(house.onchainId))!==ZeroAddress)throw new Error(`INITIAL_HOUSE_NOT_EMPTY:${house.id}`);
  }
  const creationHashes={router:keccak256(routerArtifact.bytecode),adapter:keccak256(adapterArtifact.bytecode),core:keccak256(coreArtifact.bytecode),vault:keccak256(vaultArtifact.bytecode)};
  const planDigest=keccak256(toUtf8Bytes(JSON.stringify(stable({activation,foundation:{contracts:foundation.contracts,codeHashes:foundation.codeHashes},creationHashes}))));
  const transactions=[];
  const add=(to,iface,method,args=[])=>transactions.push({to:getAddress(to),value:'0',data:encode(iface,method,args),contractMethod:null,contractInputsValues:null});
  add(await router.getAddress(),router.interface,'configureCurrency',[activation.tokenAddress]);
  for(const symbol of activation.symbols)add(await adapter.getAddress(),adapter.interface,'configurePath',[activation.tokenAddress,STOCKS[symbol],activation.paths[symbol]]);
  for(const symbol of activation.symbols)add(await core.getAddress(),core.interface,'configureSeedSku',[tickerBytes(symbol),seedPrice,activation.seedsPerPack,foundation.contracts[`Vault_${symbol}`]]);
  add(await core.getAddress(),core.interface,'configureHouseBasket',[activation.houseBasket.map(item=>tickerBytes(item.symbol)),activation.houseBasket.map(item=>item.weightBps)]);
  for(const house of activation.houses)add(await core.getAddress(),core.interface,'configureHouse',[house.onchainId,parseUnits(house.priceTokens,decimals),house.capacity]);
  add(await adapter.getAddress(),adapter.interface,'freezeConfiguration');
  add(await core.getAddress(),core.interface,'enableClaims');
  add(await core.getAddress(),core.interface,'enableGameplay');
  add(await router.getAddress(),router.interface,'activate');
  add(await core.getAddress(),core.interface,'enablePurchases');
  await simulateSafeBatch(provider,admin,transactions);
  await atomicWrite(SAFE_BATCH_PATH,{version:'1.0',chainId:String(CHAIN_ID),createdAt:Date.now(),meta:{name:`STOCKDEALER activation ${planDigest}`,description:'Atomic multisig activation; purchases are enabled last',txBuilderVersion:'1.18.0',createdFromSafeAddress:admin,createdFromOwnerAddress:'',checksum:null},transactions});
  console.info(`PREFLIGHT COMPLETE · SAFE BATCH GENERATED · NO TRANSACTIONS SENT · ${planDigest}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'ACTIVATION_PREFLIGHT_FAILED');process.exitCode=1;});
