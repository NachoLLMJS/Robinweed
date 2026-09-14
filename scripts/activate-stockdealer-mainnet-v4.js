import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { externalConfigPath } from './lib/localPaths.js';
import { AbiCoder, Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, keccak256, parseUnits, toUtf8Bytes } from 'ethers';
import { validatePonsActivationConfig } from './lib/activationConfigV2.js';
import { assertNoNewResidue } from './lib/economicInvariant.js';
import { activationPlanDigest } from './lib/activationPlanDigest.js';

const CHAIN_ID = 4663;
const MAX_PACKS_PER_PURCHASE = 100n;
const PONS_V2_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const ENV_PATH = process.env.STOCKDEALER_MAINNET_ENV ?? externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const ACTIVATION_PATH = process.env.STOCKDEALER_ACTIVATION_CONFIG ?? externalConfigPath('STOCKDEALER_MAINNET_V4_ACTIVATION.json');
const FOUNDATION_PATH = resolve('deployments/robinhood-mainnet-foundation-v4.json');
const SAFE_BATCH_PATH = resolve('deployments/safe-activation-v4-batch.json');
const FORBIDDEN_PROVISIONAL_TOKEN = '0x8998706EbF337575f05F294036eBfc3D1dE01290';
const QUOTER_V2 = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';
const OFFICIAL_SWAP_ROUTER_02 = '0xCaf681a66D020601342297493863E78C959E5cb2';
const OFFICIAL_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const OFFICIAL_POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951';
const OFFICIAL_MEME_HOOK = '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044';
const OFFICIAL_UNIVERSAL_ROUTER = '0x8876789976dEcBfCbBbe364623C63652db8C0904';
const OFFICIAL_PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const OFFICIAL_V3_FACTORY = '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA';
const STOCKS = Object.freeze({ AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d' });
const ERC20_ABI=['function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function transfer(address,uint256) returns(bool)','function burn(uint256)'];
const QUOTER_ABI=['function quoteExactInput(bytes,uint256) returns(uint256,uint160[] memory,uint32[] memory,uint256)'];
const CURVE_ABI=['function token() view returns(address)','function pairToken() view returns(address)','function graduated() view returns(bool)','function readyToGraduate() view returns(bool)'];
const PONS_FACTORY_ABI=['function getLaunchedToken(address) view returns((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))','function poolManager() view returns(address)','function memeHook() view returns(address)'];
const SAFE_ABI=['function VERSION() view returns(string)','function getOwners() view returns(address[])','function getThreshold() view returns(uint256)','function nonce() view returns(uint256)','function getModulesPaginated(address,uint256) view returns(address[],address)'];
const SAFE_FACTORY_ABI=['event ProxyCreation(address indexed proxy,address singleton)'];
const SAFE_SENTINEL='0x0000000000000000000000000000000000000001';
const SAFE_GUARD_STORAGE_SLOT='0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c7';
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
async function simulateTargetCallSequence(provider,blockTag,admin,transactions){
  const blockStateCalls=[];
  for(let index=0;index<transactions.length;index+=8)blockStateCalls.push({calls:transactions.slice(index,index+8).map(transaction=>({from:admin,to:transaction.to,data:transaction.data,value:'0x0'}))});
  let result;
  try{result=await provider.send('eth_simulateV1',[{blockStateCalls,traceTransfers:false,validation:false},blockTag]);}
  catch{throw new Error('TARGET_CALL_SEQUENCE_SIMULATION_UNAVAILABLE');}
  const calls=Array.isArray(result)?result.flatMap(block=>block?.calls??[]):null;
  if(!Array.isArray(calls)||calls.length!==transactions.length||calls.some(call=>call?.status!=='0x1'))throw new Error('TARGET_CALL_SEQUENCE_SIMULATION_FAILED');
}
async function simulatePositiveBurn(provider,blockTag,token,router,burnProbeHolder){
  const amount=1n,tokenAddress=await token.getAddress(),routerAddress=await router.getAddress();
  const call=(from,method,args=[])=>({from,to:tokenAddress,data:token.interface.encodeFunctionData(method,args),value:'0x0'});
  let result;
  try{result=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls:[call(burnProbeHolder,'balanceOf',[burnProbeHolder]),call(burnProbeHolder,'balanceOf',[routerAddress]),call(burnProbeHolder,'totalSupply'),call(burnProbeHolder,'transfer',[routerAddress,amount]),call(routerAddress,'burn',[amount]),call(burnProbeHolder,'balanceOf',[burnProbeHolder]),call(burnProbeHolder,'balanceOf',[routerAddress]),call(burnProbeHolder,'totalSupply')]}],traceTransfers:false,validation:false},blockTag]);}
  catch{throw new Error('POSITIVE_BURN_SIMULATION_UNAVAILABLE');}
  const calls=result?.[0]?.calls;
  if(!Array.isArray(calls)||calls.length!==8||calls.some(entry=>entry?.status!=='0x1'))throw new Error('POSITIVE_BURN_INVARIANT_FAILED');
  const decoded=(index,method)=>token.interface.decodeFunctionResult(method,calls[index].returnData)[0];
  const holderBefore=decoded(0,'balanceOf'),routerBefore=decoded(1,'balanceOf'),supplyBefore=decoded(2,'totalSupply');
  const holderAfter=decoded(5,'balanceOf'),routerAfter=decoded(6,'balanceOf'),supplyAfter=decoded(7,'totalSupply');
  if(holderBefore<amount||holderAfter!==holderBefore-amount||routerAfter!==routerBefore||supplyAfter!==supplyBefore-amount)throw new Error('POSITIVE_BURN_INVARIANT_FAILED');
}
async function verifySafe(provider,admin,env,blockTag){
  const safeCode=await provider.getCode(admin,blockTag);
  if(safeCode==='0x')throw new Error('ADMIN_SAFE_CODE_MISSING');
  if(!/^0x[0-9a-fA-F]{64}$/.test(env.ADMIN_SAFE_CODE_HASH??''))throw new Error('ADMIN_SAFE_CODE_HASH_REQUIRED');
  if(keccak256(safeCode).toLowerCase()!==env.ADMIN_SAFE_CODE_HASH.toLowerCase())throw new Error('ADMIN_SAFE_CODE_HASH_MISMATCH');
  const singleton=getAddress(env.ADMIN_SAFE_SINGLETON_ADDRESS),factory=getAddress(env.ADMIN_SAFE_FACTORY_ADDRESS);
  for(const [value,label] of [[env.ADMIN_SAFE_SINGLETON_CODE_HASH,'ADMIN_SAFE_SINGLETON_CODE_HASH_REQUIRED'],[env.ADMIN_SAFE_FACTORY_CODE_HASH,'ADMIN_SAFE_FACTORY_CODE_HASH_REQUIRED'],[env.ADMIN_SAFE_DEPLOYMENT_TX_HASH,'ADMIN_SAFE_DEPLOYMENT_TX_HASH_REQUIRED']])if(!/^0x[0-9a-fA-F]{64}$/.test(value??''))throw new Error(label);
  if((env.ADMIN_SAFE_GUARD_STORAGE_SLOT??'').toLowerCase()!==SAFE_GUARD_STORAGE_SLOT)throw new Error('ADMIN_SAFE_GUARD_STORAGE_SLOT_MISMATCH');
  const singletonCode=await provider.getCode(singleton,blockTag),factoryCode=await provider.getCode(factory,blockTag);
  if(singletonCode==='0x'||keccak256(singletonCode).toLowerCase()!==env.ADMIN_SAFE_SINGLETON_CODE_HASH.toLowerCase())throw new Error('ADMIN_SAFE_SINGLETON_CODE_HASH_MISMATCH');
  if(factoryCode==='0x'||keccak256(factoryCode).toLowerCase()!==env.ADMIN_SAFE_FACTORY_CODE_HASH.toLowerCase())throw new Error('ADMIN_SAFE_FACTORY_CODE_HASH_MISMATCH');
  if(getAddress(`0x${(await provider.getStorage(admin,0n,blockTag)).slice(-40)}`)!==singleton)throw new Error('ADMIN_SAFE_SINGLETON_MISMATCH');
  const deploymentTx=await provider.getTransaction(env.ADMIN_SAFE_DEPLOYMENT_TX_HASH),deploymentReceipt=await provider.getTransactionReceipt(env.ADMIN_SAFE_DEPLOYMENT_TX_HASH);
  if(!deploymentTx||getAddress(deploymentTx.to??ZeroAddress)!==factory||!deploymentReceipt||deploymentReceipt.status!==1)throw new Error('ADMIN_SAFE_DEPLOYMENT_PROVENANCE_INVALID');
  const factoryInterface=new Interface(SAFE_FACTORY_ABI);let provenanceMatched=false;
  for(const log of deploymentReceipt.logs)if(getAddress(log.address)===factory){try{const parsed=factoryInterface.parseLog(log);if(parsed&&getAddress(parsed.args.proxy)===admin&&getAddress(parsed.args.singleton)===singleton)provenanceMatched=true;}catch{}}
  if(!provenanceMatched)throw new Error('ADMIN_SAFE_PROXY_CREATION_EVENT_MISSING');
  if(!Object.hasOwn(env,'ADMIN_SAFE_MODULES')||!/^0x[0-9a-fA-F]{40}$/.test(env.ADMIN_SAFE_GUARD_ADDRESS??''))throw new Error('ADMIN_SAFE_EXTENSION_EXPECTATIONS_REQUIRED');
  const expectedOwners=(env.ADMIN_SAFE_OWNERS??'').split(',').filter(Boolean).map(getAddress).sort(),expectedModules=(env.ADMIN_SAFE_MODULES??'').split(',').filter(Boolean).map(getAddress).sort();
  const expectedThreshold=Number(env.ADMIN_SAFE_THRESHOLD),expectedGuard=getAddress(env.ADMIN_SAFE_GUARD_ADDRESS??ZeroAddress);
  if(!env.ADMIN_SAFE_VERSION||expectedOwners.length===0||!Number.isSafeInteger(expectedThreshold)||expectedThreshold<1||expectedThreshold>expectedOwners.length)throw new Error('ADMIN_SAFE_EXPECTATIONS_REQUIRED');
  const safe=new Contract(admin,SAFE_ABI,provider);let owners,threshold,nonce,version,modules,next;
  try{owners=(await safe.getOwners({blockTag})).map(getAddress).sort();threshold=Number(await safe.getThreshold({blockTag}));nonce=await safe.nonce({blockTag});version=await safe.VERSION({blockTag});[modules,next]=await safe.getModulesPaginated(SAFE_SENTINEL,100n,{blockTag});modules=modules.map(getAddress).sort();}catch{throw new Error('ADMIN_SAFE_INTERFACE_INVALID');}
  if(threshold!==expectedThreshold||owners.length!==expectedOwners.length||owners.some((owner,index)=>owner!==expectedOwners[index]))throw new Error('ADMIN_SAFE_CONFIGURATION_MISMATCH');
  if(version!==env.ADMIN_SAFE_VERSION||getAddress(next)!==SAFE_SENTINEL||modules.length!==expectedModules.length||modules.some((module,index)=>module!==expectedModules[index]))throw new Error('ADMIN_SAFE_EXTENSION_CONFIGURATION_MISMATCH');
  if(getAddress(`0x${(await provider.getStorage(admin,BigInt(SAFE_GUARD_STORAGE_SLOT),blockTag)).slice(-40)}`)!==expectedGuard)throw new Error('ADMIN_SAFE_GUARD_MISMATCH');
  return Object.freeze({address:admin,proxyCodeHash:keccak256(safeCode),singleton,singletonCodeHash:keccak256(singletonCode),factory,factoryCodeHash:keccak256(factoryCode),deploymentTxHash:deploymentTx.hash,version,owners,threshold,modules,guard:expectedGuard,nonce:nonce.toString()});
}
async function simulateEconomicRoute({provider,blockTag,admin,activationCall,token,router,adapter,target,routeData,holder,receiver,amountIn,minimumOut}){
  const tokenAddress=await token.getAddress(),routerAddress=await router.getAddress(),adapterAddress=await adapter.getAddress();
  const targetToken=new Contract(target,ERC20_ABI,provider);
  const [curveAddress,pairAddress]=AbiCoder.defaultAbiCoder().decode(['address','address','bytes'],routeData);
  const nativePair=getAddress(pairAddress)===ZeroAddress;
  const pairToken=nativePair?null:new Contract(pairAddress,ERC20_ABI,provider);
  const calls=[
    {from:routerAddress,to:tokenAddress,data:token.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'},
    {from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('nativeBalance',[]),value:'0x0'},
    {from:routerAddress,to:target,data:targetToken.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'},
    nativePair?{from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('nativeBalance',[]),value:'0x0'}:{from:routerAddress,to:pairAddress,data:pairToken.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'},
    activationCall,
    {from:holder,to:tokenAddress,data:token.interface.encodeFunctionData('transfer',[routerAddress,amountIn]),value:'0x0'},
    {from:routerAddress,to:tokenAddress,data:token.interface.encodeFunctionData('approve',[adapterAddress,amountIn]),value:'0x0'},
    {from:routerAddress,to:target,data:targetToken.interface.encodeFunctionData('balanceOf',[receiver]),value:'0x0'},
    {from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('swapExactInput',[tokenAddress,target,amountIn,minimumOut,2n**255n,receiver]),value:'0x0'},
    {from:routerAddress,to:target,data:targetToken.interface.encodeFunctionData('balanceOf',[receiver]),value:'0x0'},
    {from:routerAddress,to:tokenAddress,data:token.interface.encodeFunctionData('allowance',[routerAddress,adapterAddress]),value:'0x0'},
    {from:routerAddress,to:tokenAddress,data:token.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'},
    {from:routerAddress,to:tokenAddress,data:token.interface.encodeFunctionData('allowance',[adapterAddress,curveAddress]),value:'0x0'},
    {from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('nativeBalance',[]),value:'0x0'},
    nativePair?{from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('nativeBalance',[]),value:'0x0'}:{from:routerAddress,to:pairAddress,data:pairToken.interface.encodeFunctionData('allowance',[adapterAddress,OFFICIAL_SWAP_ROUTER_02]),value:'0x0'},
    nativePair?{from:routerAddress,to:adapterAddress,data:adapter.interface.encodeFunctionData('nativeBalance',[]),value:'0x0'}:{from:routerAddress,to:pairAddress,data:pairToken.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'},
    {from:routerAddress,to:target,data:targetToken.interface.encodeFunctionData('balanceOf',[adapterAddress]),value:'0x0'}
  ];
  let result,lastError;
  for(let attempt=1;attempt<=3;attempt+=1){try{result=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls}],traceTransfers:false,validation:false},blockTag]);break;}catch(error){lastError=error;if(attempt<3)await new Promise(resolveDelay=>setTimeout(resolveDelay,attempt*1000));}}
  if(!result)throw new Error(`ECONOMIC_ROUTE_SIMULATION_UNAVAILABLE:${target}:${lastError?.code??'RPC'}`);
  const rows=result?.[0]?.calls;
  if(!Array.isArray(rows)||rows.length!==calls.length||rows.some(row=>row?.status!=='0x1'))throw new Error(`ECONOMIC_ROUTE_SIMULATION_FAILED:${target}`);
  const preInput=token.interface.decodeFunctionResult('balanceOf',rows[0].returnData)[0];
  const preNative=adapter.interface.decodeFunctionResult('nativeBalance',rows[1].returnData)[0];
  const preTarget=targetToken.interface.decodeFunctionResult('balanceOf',rows[2].returnData)[0];
  const prePair=nativePair?0n:pairToken.interface.decodeFunctionResult('balanceOf',rows[3].returnData)[0];
  const before=targetToken.interface.decodeFunctionResult('balanceOf',rows[7].returnData)[0],after=targetToken.interface.decodeFunctionResult('balanceOf',rows[9].returnData)[0];
  const allowance=token.interface.decodeFunctionResult('allowance',rows[10].returnData)[0],postInput=token.interface.decodeFunctionResult('balanceOf',rows[11].returnData)[0];
  const curveAllowance=token.interface.decodeFunctionResult('allowance',rows[12].returnData)[0];
  const postNative=adapter.interface.decodeFunctionResult('nativeBalance',rows[13].returnData)[0];
  const pairAllowance=nativePair?0n:pairToken.interface.decodeFunctionResult('allowance',rows[14].returnData)[0];
  const postPair=nativePair?0n:pairToken.interface.decodeFunctionResult('balanceOf',rows[15].returnData)[0];
  const postTarget=targetToken.interface.decodeFunctionResult('balanceOf',rows[16].returnData)[0];
  assertNoNewResidue(
    {input:preInput,pair:prePair,target:preTarget,native:preNative},
    {input:postInput,pair:postPair,target:postTarget,native:postNative}
  );
  if(after<=before||allowance!==0n||curveAllowance!==0n||pairAllowance!==0n)throw new Error(`ECONOMIC_ROUTE_INVARIANT_FAILED:${target}`);
  return after-before;
}

async function main(){
  const env=parseEnv(await readFile(ENV_PATH,'utf8'));
  if(!env.ROBINHOOD_MAINNET_RPC_URL||!env.ADMIN_MULTISIG_ADDRESS)throw new Error('MAINNET_RPC_AND_MULTISIG_REQUIRED');
  const activation=validatePonsActivationConfig(JSON.parse(await readFile(ACTIVATION_PATH,'utf8')));
  if(activation.rehearsalOnly)throw new Error('REHEARSAL_CONFIG_NOT_BROADCASTABLE');
  if(activation.trialMainnet&&!process.argv.includes('--authorize-flyco-live-trial'))throw new Error('FLYCO_LIVE_TRIAL_NOT_AUTHORIZED');
  if(getAddress(activation.tokenAddress)===getAddress(FORBIDDEN_PROVISIONAL_TOKEN))throw new Error('PROVISIONAL_FLYCO_FORBIDDEN_FOR_V4');
  await ensureFreshBuild();
  const foundation=JSON.parse(await readFile(FOUNDATION_PATH,'utf8'));
  if(foundation.chainId!==CHAIN_ID||foundation.status!=='FOUNDATION_V4_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED'||!foundation.codeHashes)throw new Error('FOUNDATION_NOT_VERIFIABLE');
  const admin=getAddress(env.ADMIN_MULTISIG_ADDRESS);
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,CHAIN_ID,{staticNetwork:true});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const head=await provider.getBlockNumber(),confirmationDepth=Math.max(1,Number(env.MIN_CONFIRMATIONS??12));
  const pinnedBlock=await provider.getBlock(Math.max(0,head-confirmationDepth));
  if(!pinnedBlock?.hash)throw new Error('PINNED_BLOCK_UNAVAILABLE');
  const blockNumber=pinnedBlock.number,blockTag=`0x${blockNumber.toString(16)}`;
  const safeAttestation=await verifySafe(provider,admin,env,blockNumber);
  const controllerArtifact=await artifact('StockdealerFoundationControllerV4','StockdealerFoundationControllerV4');
  const routerArtifact=await artifact('StockdealerEconomyRouter','StockdealerEconomyRouter');
  const adapterArtifact=await artifact('StockdealerPonsLifecycleAdapterV4','StockdealerPonsLifecycleAdapterV4');
  const coreArtifact=await artifact('StockdealerGameCoreV4','StockdealerGameCoreV4');
  const vaultArtifact=await artifact('StockdealerRewardVault','StockdealerRewardVault');
  const artifacts={FoundationController:controllerArtifact,EconomyRouter:routerArtifact,PonsAdapter:adapterArtifact,GameCore:coreArtifact};
  const controller=new Contract(foundation.contracts.FoundationController,controllerArtifact.abi,provider);
  const router=new Contract(foundation.contracts.EconomyRouter,routerArtifact.abi,provider);
  const adapter=new Contract(foundation.contracts.PonsAdapter,adapterArtifact.abi,provider);
  const core=new Contract(foundation.contracts.GameCore,coreArtifact.abi,provider);
  for(const [name,address] of Object.entries(foundation.contracts)){
    const code=await provider.getCode(address,blockNumber);
    if(code==='0x'||keccak256(code).toLowerCase()!==foundation.codeHashes[name]?.toLowerCase())throw new Error(`DEPLOYED_CODE_MISMATCH:${name}`);
    const artifactValue=name.startsWith('Vault_')?vaultArtifact:artifacts[name];
    assertCurrentRuntime(name,code,artifactValue);
    const abi=artifactValue.abi;
    const contract=new Contract(address,abi,provider);
    const expectedOwner=name==='FoundationController'?admin:getAddress(foundation.contracts.FoundationController);
    if(getAddress(await contract.owner({blockTag:blockNumber}))!==expectedOwner||getAddress(await contract.pendingOwner({blockTag:blockNumber}))!==ZeroAddress)throw new Error(`FOUNDATION_OWNERSHIP_INVALID:${name}`);
  }
  if(!(await controller.foundationConfigured({blockTag:blockNumber}))||await controller.activated({blockTag:blockNumber})||await controller.stockdealerToken({blockTag:blockNumber})!==ZeroAddress||!(await router.paused({blockTag:blockNumber}))||!(await core.purchasesPaused({blockTag:blockNumber}))||!(await core.gameplayPaused({blockTag:blockNumber}))||!(await core.claimsPaused({blockTag:blockNumber}))||await adapter.configurationFrozen({blockTag:blockNumber}))throw new Error('FOUNDATION_STATE_UNSAFE');
  if(getAddress(await adapter.ponsFactory({blockTag:blockNumber}))!==getAddress(PONS_V2_FACTORY)||getAddress(await adapter.universalRouter({blockTag:blockNumber}))!==getAddress(OFFICIAL_UNIVERSAL_ROUTER)||getAddress(await adapter.permit2({blockTag:blockNumber}))!==getAddress(OFFICIAL_PERMIT2)||getAddress(await adapter.v3Router({blockTag:blockNumber}))!==getAddress(OFFICIAL_SWAP_ROUTER_02)||getAddress(await adapter.v3Factory({blockTag:blockNumber}))!==getAddress(OFFICIAL_V3_FACTORY)||getAddress(await adapter.weth({blockTag:blockNumber}))!==getAddress(OFFICIAL_WETH))throw new Error('ADAPTER_INFRASTRUCTURE_MISMATCH');
  const token=new Contract(activation.tokenAddress,ERC20_ABI,provider);
  const tokenCode=await provider.getCode(activation.tokenAddress,blockNumber);
  if(tokenCode==='0x'||keccak256(tokenCode).toLowerCase()!==activation.expectedTokenCodeHash.toLowerCase()||await token.symbol({blockTag:blockNumber})!==activation.expectedTokenSymbol||await token.totalSupply({blockTag:blockNumber})<=0n)throw new Error('TOKEN_VERIFICATION_FAILED');
  const ponsFactory=new Contract(PONS_V2_FACTORY,PONS_FACTORY_ABI,provider);
  if(getAddress(await ponsFactory.poolManager({blockTag:blockNumber}))!==getAddress(OFFICIAL_POOL_MANAGER)||getAddress(await ponsFactory.memeHook({blockTag:blockNumber}))!==getAddress(OFFICIAL_MEME_HOOK))throw new Error('PONS_INFRASTRUCTURE_MISMATCH');
  const launch=await ponsFactory.getLaunchedToken(activation.tokenAddress,{blockTag:blockNumber});
  if(!launch.exists||getAddress(launch.token)!==activation.tokenAddress||Number(launch.phase)!==0)throw new Error('PONS_FACTORY_TOKEN_AUTHENTICATION_FAILED');
  const decimals=Number(await token.decimals({blockTag:blockNumber}));
  const seedPrice=parseUnits(activation.seedPackPriceTokens,decimals);
  if(seedPrice%5n!==0n)throw new Error('SEED_PRICE_NOT_DIVISIBLE_BY_FIVE');
  await simulatePositiveBurn(provider,blockTag,token,router,activation.burnProbeHolder);
  const quoter=new Contract(QUOTER_V2,QUOTER_ABI,provider);
  for(const symbol of activation.symbols){
    const routeConfig=activation.routes[symbol];
    const curve=new Contract(routeConfig.curve,CURVE_ABI,provider);
    if(routeConfig.curve!==getAddress(launch.curve)||routeConfig.pairToken!==getAddress(launch.pairToken)||getAddress(await curve.token({blockTag:blockNumber}))!==activation.tokenAddress||getAddress(await curve.pairToken({blockTag:blockNumber}))!==routeConfig.pairToken||await curve.graduated({blockTag:blockNumber})||await curve.readyToGraduate({blockTag:blockNumber}))throw new Error(`PONS_CURVE_NOT_ACTIVE:${symbol}`);
    const expectedPathInput=routeConfig.pairToken===ZeroAddress?getAddress(OFFICIAL_WETH):routeConfig.pairToken;
    if(routeConfig.downstreamPath!=='0x'&&(getAddress(`0x${routeConfig.downstreamPath.slice(2,42)}`)!==expectedPathInput||getAddress(`0x${routeConfig.downstreamPath.slice(-40)}`)!==getAddress(STOCKS[symbol])))throw new Error(`PATH_ENDPOINT_MISMATCH:${symbol}`);
    if(routeConfig.downstreamPath==='0x'&&routeConfig.pairToken!==getAddress(STOCKS[symbol]))throw new Error(`DIRECT_PAIR_MISMATCH:${symbol}`);
    const route=await router.routes(tickerBytes(symbol),{blockTag:blockNumber});
    if(!route.enabled||getAddress(route.rewardToken)!==getAddress(STOCKS[symbol])||getAddress(route.rewardVault)!==getAddress(foundation.contracts[`Vault_${symbol}`])||getAddress(route.adapter)!==getAddress(await adapter.getAddress()))throw new Error(`INITIAL_ROUTE_MISMATCH:${symbol}`);
    if((await adapter.pathFor(activation.tokenAddress,STOCKS[symbol],{blockTag:blockNumber}))!=='0x')throw new Error(`INITIAL_PATH_NOT_EMPTY:${symbol}`);
    const sku=await core.seedSkus(tickerBytes(symbol),{blockTag:blockNumber});
    if(sku.configured||sku.packPrice!==0n||sku.seedsPerPack!==0n||getAddress(sku.rewardVault)!==ZeroAddress)throw new Error(`INITIAL_SEED_SKU_NOT_EMPTY:${symbol}`);
    if(routeConfig.downstreamPath!=='0x'){
      const pairDecimals=routeConfig.pairToken===ZeroAddress?18:Number(await new Contract(routeConfig.pairToken,ERC20_ABI,provider).decimals({blockTag:blockNumber}));
      if((await quoter.quoteExactInput.staticCall(routeConfig.downstreamPath,10n**BigInt(pairDecimals),{blockTag:blockNumber}))[0]<=0n)throw new Error(`ZERO_LIVE_QUOTE:${symbol}`);
    }
  }
  const [initialBasketTickers,initialBasketWeights]=await core.houseBasket({blockTag:blockNumber});
  if(initialBasketTickers.length!==0||initialBasketWeights.length!==0)throw new Error('INITIAL_BASKET_NOT_EMPTY');
  for(const house of activation.houses){
    if(parseUnits(house.priceTokens,decimals)%5n!==0n)throw new Error(`HOUSE_PRICE_NOT_DIVISIBLE_BY_FIVE:${house.id}`);
    const current=await core.houses(house.onchainId,{blockTag:blockNumber});
    if(current.configured||current.price!==0n||current.capacity!==0n||getAddress(await core.houseOwner(house.onchainId,{blockTag:blockNumber}))!==ZeroAddress)throw new Error(`INITIAL_HOUSE_NOT_EMPTY:${house.id}`);
  }
  if(activation.houses.length!==35)throw new Error('V4_REQUIRES_EXACTLY_35_HOUSES');
  const basketWeights=Object.fromEntries(activation.houseBasket.map(item=>[item.ticker,BigInt(item.weightBps)]));
  const controllerActivation={
    token:activation.tokenAddress,
    routeData:Object.keys(STOCKS).map(symbol=>activation.paths[symbol]),
    seedPackPrice:seedPrice,
    seedsPerPack:activation.seedsPerPack,
    basketWeightsBps:Object.keys(STOCKS).map(symbol=>Number(basketWeights[symbol])),
    houses:activation.houses.map(house=>({houseId:house.onchainId,price:parseUnits(house.priceTokens,decimals),capacity:house.capacity}))
  };
  const activationData=controller.interface.encodeFunctionData('activateStockdealerEconomy',[controllerActivation]);
  const activationCall={from:admin,to:await controller.getAddress(),data:activationData,value:'0x0'};
  const transactions=[{to:getAddress(await controller.getAddress()),value:'0',data:activationData,contractMethod:null,contractInputsValues:null}];
  await simulateTargetCallSequence(provider,blockTag,admin,transactions);
  const maximumCurrencyInputBySymbol=Object.fromEntries(activation.symbols.map(symbol=>[symbol,seedPrice*MAX_PACKS_PER_PURCHASE*60n/100n]));
  for(const house of activation.houses){
    const rewardShare=parseUnits(house.priceTokens,decimals)*60n/100n;
    for(const symbol of activation.symbols){
      const routed=rewardShare*basketWeights[symbol]/10000n;
      if(routed>maximumCurrencyInputBySymbol[symbol])maximumCurrencyInputBySymbol[symbol]=routed;
    }
  }
  const economicPreflight={block:pinnedBlock.number,blockHash:pinnedBlock.hash,routes:{}};
  for(const symbol of activation.symbols){
    const parameters={provider,blockTag,admin,activationCall,token,router,adapter,target:STOCKS[symbol],routeData:activation.paths[symbol],holder:activation.burnProbeHolder,receiver:foundation.contracts[`Vault_${symbol}`],amountIn:maximumCurrencyInputBySymbol[symbol]};
    const discoveredOut=await simulateEconomicRoute({...parameters,minimumOut:1n});
    if(discoveredOut<100n)throw new Error(`ECONOMIC_ROUTE_OUTPUT_TOO_SMALL:${symbol}`);
    const minimumOut=(discoveredOut*99n+99n)/100n;
    const boundedOut=await simulateEconomicRoute({...parameters,minimumOut});
    economicPreflight.routes[symbol]={amountIn:maximumCurrencyInputBySymbol[symbol].toString(),discoveredOut:discoveredOut.toString(),minimumOut:minimumOut.toString(),boundedOut:boundedOut.toString()};
  }
  const creationHashes={controller:keccak256(controllerArtifact.bytecode),router:keccak256(routerArtifact.bytecode),adapter:keccak256(adapterArtifact.bytecode),core:keccak256(coreArtifact.bytecode),vault:keccak256(vaultArtifact.bytecode)};
  const targetSequenceSimulation='single-call-complete';
  const foundationAttestation={planDigest:foundation.planDigest,deploymentTxHash:foundation.deploymentTxHash,blockNumber:foundation.blockNumber,blockHash:foundation.blockHash,contracts:foundation.contracts,codeHashes:foundation.codeHashes};
  const batch={version:'1.0',chainId:String(CHAIN_ID),createdAt:Date.now(),meta:{description:'One atomic Safe call configures the final token, seven paths, seven seed SKUs, basket, 35 house prices and enables purchases last.',txBuilderVersion:'1.18.0',createdFromSafeAddress:admin,createdFromOwnerAddress:'',safeAttestation,targetSequenceSimulation},activation,foundationAttestation,creationHashes,economicPreflight,transactions};
  const planDigest=activationPlanDigest(batch);
  batch.meta.name=`STOCKDEALER V4 activation ${planDigest}`;
  batch.meta.checksum=planDigest;
  if((await new Contract(admin,SAFE_ABI,provider).nonce()).toString()!==safeAttestation.nonce||await controller.activated())throw new Error('ACTIVATION_STATE_CHANGED_DURING_PREFLIGHT');
  await atomicWrite(SAFE_BATCH_PATH,batch);
  console.info(`V4 PREFLIGHT COMPLETE · ONE-CALL SAFE BATCH GENERATED · NO TRANSACTIONS SENT · ${planDigest}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'ACTIVATION_PREFLIGHT_FAILED');process.exitCode=1;});
