import { execFile } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { AbiCoder, Contract, ContractFactory, Interface, JsonRpcProvider, getAddress, getCreate2Address, encodeBytes32String, keccak256, toUtf8Bytes } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';
import { attestSafe } from './lib/safeAttestation.js';

const execFileAsync=promisify(execFile);
const CHAIN_ID=4663;
const ROOT=new URL('../',import.meta.url);
const DEFAULT_ENV=externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const OUTPUT=new URL('deployments/stockdealer-mainnet-foundation-v4-safe-batch.json',ROOT);
const PLAN=new URL('deployments/stockdealer-mainnet-foundation-v4-plan.json',ROOT);
const CREATE2_PROXY='0x4e59b44847b379578588920cA78FbF26c0B4956C';
const CREATE2_PROXY_HASH='0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989';
const PONS_FACTORY='0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const UNIVERSAL_ROUTER='0x8876789976dEcBfCbBbe364623C63652db8C0904';
const PERMIT2='0x000000000022D473030F116dDEE9F6B43aC78BA3';
const POOL_MANAGER='0x8366a39CC670B4001A1121B8F6A443A643e40951';
const MEME_HOOK='0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044';
const V3_ROUTER='0xCaf681a66D020601342297493863E78C959E5cb2';
const V3_FACTORY='0x1f7d7550B1b028f7571E69A784071F0205FD2EfA';
const WETH='0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const STOCKS=Object.freeze({AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d'});
const INFRA_HASHES=Object.freeze({
  [PONS_FACTORY]:'0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84',
  [UNIVERSAL_ROUTER]:'0x2ce6aaaf9f4151f5e1cbf774668772f17f532ae11b15e9284fd0a072a8b0fbde',
  [PERMIT2]:'0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca',
  [POOL_MANAGER]:'0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626',
  [MEME_HOOK]:'0xc21b1e6c1b45403e81a581f22ed6d9c747997af1cfdac1b1dc9f4b1d346a10db',
  [V3_ROUTER]:'0x6f36c378e272c6324c48f045182bcb54bd8ad654cf9ebd42e8893d52c4cb25dc',
  [V3_FACTORY]:'0xec72b1abd1f2faee020cfea9c646bd8994f9fb389054f6e574f103a895091739',
  [WETH]:'0x5706be52f64875fee65a2cec0d80e47a23d8793cbe85d214b48445e2d05f5353'
});

const coder=AbiCoder.defaultAbiCoder();
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const ticker=encodeBytes32String;
const atomicWrite=async(url,value)=>{const path=fileURLToPath(url),tmp=`${path}.tmp`;await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`);await rename(tmp,path);};
const artifact=async(file,name)=>JSON.parse(await readFile(new URL(`artifacts/contracts/${file}.sol/${name}.json`,ROOT),'utf8'));
const initCode=async(artifactValue,args)=>(await new ContractFactory(artifactValue.abi,artifactValue.bytecode).getDeployTransaction(...args)).data;
const saltFor=(label,baseDigest)=>keccak256(toUtf8Bytes(`STOCKDEALER_FOUNDATION_V4:${baseDigest}:${label}`));
const createCall=(salt,code)=>({to:getAddress(CREATE2_PROXY),value:'0',data:`${salt}${code.slice(2)}`,contractMethod:null,contractInputsValues:null});

async function main(){
  await execFileAsync(process.execPath,[fileURLToPath(new URL('node_modules/hardhat/dist/src/cli.js',ROOT)),'compile','--force'],{cwd:fileURLToPath(ROOT)});
  const env=parseEnv(await readFile(process.env.STOCKDEALER_MAINNET_ENV??DEFAULT_ENV,'utf8'));
  if(!env.ROBINHOOD_MAINNET_RPC_URL||!env.ADMIN_MULTISIG_ADDRESS)throw new Error('MISSING_MAINNET_CONFIGURATION');
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,CHAIN_ID,{staticNetwork:true,batchMaxCount:1});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const confirmationDepth=Math.max(1,Number(env.MIN_CONFIRMATIONS??12));
  const head=await provider.getBlockNumber();
  const pinnedBlock=await provider.getBlock(Math.max(0,head-confirmationDepth));
  if(!pinnedBlock?.hash)throw new Error('PINNED_BLOCK_UNAVAILABLE');
  const blockTag=pinnedBlock.number;
  const safeAddress=getAddress(env.ADMIN_MULTISIG_ADDRESS);
  const safeAttestation=await attestSafe(provider,safeAddress,env,blockTag);
  const safe=new Contract(safeAddress,['function nonce() view returns(uint256)'],provider);
  const proxyCode=await provider.getCode(CREATE2_PROXY,blockTag);
  if(proxyCode==='0x'||keccak256(proxyCode).toLowerCase()!==CREATE2_PROXY_HASH)throw new Error('CREATE2_PROXY_ATTESTATION_FAILED');
  for(const [address,expected] of Object.entries(INFRA_HASHES)){const code=await provider.getCode(address,blockTag);if(code==='0x'||keccak256(code).toLowerCase()!==expected)throw new Error(`OFFICIAL_INFRASTRUCTURE_MISMATCH:${address}`);}
  for(const address of Object.values(STOCKS))if((await provider.getCode(address,blockTag))==='0x')throw new Error(`CANONICAL_STOCK_MISSING:${address}`);
  const pons=new Contract(PONS_FACTORY,['function poolManager() view returns(address)','function memeHook() view returns(address)'],provider);
  if(getAddress(await pons.poolManager({blockTag}))!==getAddress(POOL_MANAGER)||getAddress(await pons.memeHook({blockTag}))!==getAddress(MEME_HOOK))throw new Error('PONS_INFRASTRUCTURE_GETTER_MISMATCH');
  const v3=new Contract(V3_ROUTER,['function factory() view returns(address)','function WETH9() view returns(address)'],provider);
  if(getAddress(await v3.factory({blockTag}))!==getAddress(V3_FACTORY)||getAddress(await v3.WETH9({blockTag}))!==getAddress(WETH))throw new Error('V3_INFRASTRUCTURE_GETTER_MISMATCH');

  const artifacts={controller:await artifact('StockdealerFoundationControllerV4','StockdealerFoundationControllerV4'),router:await artifact('StockdealerEconomyRouter','StockdealerEconomyRouter'),adapter:await artifact('StockdealerPonsLifecycleAdapterV4','StockdealerPonsLifecycleAdapterV4'),vault:await artifact('StockdealerRewardVault','StockdealerRewardVault'),core:await artifact('StockdealerGameCoreV4','StockdealerGameCoreV4')};
  const baseDigest=keccak256(toUtf8Bytes(JSON.stringify(stable({chainId:CHAIN_ID,safe:safeAddress,create2Proxy:CREATE2_PROXY,infrastructure:INFRA_HASHES,stocks:STOCKS,creationHashes:Object.fromEntries(Object.entries(artifacts).map(([name,value])=>[name,keccak256(value.bytecode)]))}))));
  const deployments=[];
  const add=async(label,artifactValue,args)=>{const code=await initCode(artifactValue,args);const salt=saltFor(label,baseDigest);const address=getCreate2Address(CREATE2_PROXY,salt,keccak256(code));if((await provider.getCode(address,blockTag))!=='0x')throw new Error(`PREDICTED_ADDRESS_ALREADY_USED:${label}`);deployments.push({label,address,salt,initCode:code,artifact:nameFor(artifactValue)});return address;};
  const nameFor=value=>value.contractName;
  const controller=await add('FoundationController',artifacts.controller,[safeAddress,PONS_FACTORY]);
  const router=await add('EconomyRouter',artifacts.router,[controller]);
  const adapter=await add('PonsAdapter',artifacts.adapter,[controller,router,PONS_FACTORY,UNIVERSAL_ROUTER,PERMIT2,V3_ROUTER,V3_FACTORY,WETH]);
  const vaults={};for(const [symbol,tokenAddress] of Object.entries(STOCKS))vaults[symbol]=await add(`Vault_${symbol}`,artifacts.vault,[controller,tokenAddress]);
  const core=await add('GameCore',artifacts.core,[controller,router]);
  const controllerInterface=new Interface(artifacts.controller.abi);
  const configureData=controllerInterface.encodeFunctionData('configureFoundation',[router,adapter,core,Object.keys(STOCKS).map(ticker),Object.values(STOCKS),Object.keys(STOCKS).map(symbol=>vaults[symbol])]);
  const deploymentCalls=deployments.map(item=>createCall(item.salt,item.initCode));
  const configureTransaction={to:controller,value:'0',data:configureData,contractMethod:null,contractInputsValues:null};
  const transactions=[...deploymentCalls,configureTransaction];
  const ownershipInterface=new Interface(['function owner() view returns(address)']);
  const adapterInterface=new Interface(artifacts.adapter.abi);
  const diagnosticTransactions=[
    {label:'Controller.owner',to:controller,data:ownershipInterface.encodeFunctionData('owner',[])},
    {label:'Controller.ponsFactory',to:controller,data:controllerInterface.encodeFunctionData('ponsFactory',[])},
    {label:'Router.owner',to:router,data:ownershipInterface.encodeFunctionData('owner',[])},
    {label:'Adapter.owner',to:adapter,data:ownershipInterface.encodeFunctionData('owner',[])},
    {label:'Adapter.ponsFactory',to:adapter,data:adapterInterface.encodeFunctionData('ponsFactory',[])},
    {label:'GameCore.owner',to:core,data:ownershipInterface.encodeFunctionData('owner',[])},
    ...Object.entries(vaults).map(([symbol,address])=>({label:`Vault_${symbol}.owner`,to:address,data:ownershipInterface.encodeFunctionData('owner',[])}))
  ];
  const simulatedTransactions=[...deploymentCalls,...diagnosticTransactions.map(({to,data})=>({to,data,value:'0'})),configureTransaction];
  const simulationLabels=[...deployments.map(item=>item.label),...diagnosticTransactions.map(item=>item.label),'ConfigureFoundation'];
  const simulationCalls=simulatedTransactions.map(tx=>({from:safeAddress,to:tx.to,data:tx.data,value:'0x0',gas:'0x1c9c380'}));
  const simulated=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls:simulationCalls}],traceTransfers:false,validation:false},`0x${blockTag.toString(16)}`]);
  const rows=simulated?.[0]?.calls;
  const failed=Array.isArray(rows)?rows.findIndex(row=>row.status!=='0x1'):-1;
  if(!Array.isArray(rows)||rows.length!==simulatedTransactions.length||failed!==-1){const label=failed>=0?simulationLabels[failed]:'SIMULATION_SHAPE';const row=failed>=0?rows[failed]:null;throw new Error(`V4_SAFE_DEPLOYMENT_SIMULATION_FAILED:${label}:${row?.status??'missing'}:${(row?.returnData??'0x').slice(0,138)}`);}
  for(const [index,item] of diagnosticTransactions.entries()){
    const data=rows[deployments.length+index].returnData;
    const value=item.label.endsWith('ponsFactory')?getAddress(coder.decode(['address'],data)[0]):getAddress(ownershipInterface.decodeFunctionResult('owner',data)[0]);
    const expected=item.label==='Controller.owner'?safeAddress:item.label.endsWith('ponsFactory')?getAddress(PONS_FACTORY):getAddress(controller);
    if(value!==expected)throw new Error(`V4_SIMULATED_IDENTITY_MISMATCH:${item.label}`);
  }
  const executionRows=[...rows.slice(0,deployments.length),rows.at(-1)];
  const totalGas=executionRows.reduce((sum,row)=>sum+BigInt(row.gasUsed??0),0n);
  if(totalGas*120n/100n>pinnedBlock.gasLimit)throw new Error(`V4_SAFE_BATCH_EXCEEDS_BLOCK_GAS:${totalGas}:${pinnedBlock.gasLimit}`);
  const pinnedBlockAttestation={number:pinnedBlock.number,hash:pinnedBlock.hash};
  const addresses=Object.fromEntries(deployments.map(item=>[item.label,item.address]));
  const planDigest=keccak256(toUtf8Bytes(JSON.stringify(stable({baseDigest,safeAttestation,pinnedBlock:pinnedBlockAttestation,addresses,transactions}))));
  if((await safe.nonce()).toString()!==safeAttestation.nonce)throw new Error('SAFE_NONCE_CHANGED_DURING_PREPARATION');
  for(const {label,address} of deployments)if((await provider.getCode(address))!=='0x')throw new Error(`PREDICTED_ADDRESS_CHANGED_DURING_PREPARATION:${label}`);
  const meta={name:`STOCKDEALER Foundation V4 paused ${planDigest}`,description:'Unsigned atomic Safe batch: deterministic V4 deployment and paused foundation configuration. No token activation.',txBuilderVersion:'1.18.0',createdFromSafeAddress:safeAddress,createdFromOwnerAddress:'',checksum:planDigest};
  await atomicWrite(OUTPUT,{version:'1.0',chainId:String(CHAIN_ID),createdAt:Date.now(),meta,transactions});
  await atomicWrite(PLAN,{version:4,chainId:CHAIN_ID,status:'UNSIGNED_SAFE_BATCH_SIMULATED',planDigest,baseDigest,safe:safeAttestation,pinnedBlock:pinnedBlockAttestation,create2Proxy:{address:CREATE2_PROXY,codeHash:CREATE2_PROXY_HASH},contracts:addresses,deployments:deployments.map(({label,address,salt,initCode,artifact})=>({label,address,salt,initCodeHash:keccak256(initCode),artifact})),totalSimulatedGas:totalGas.toString(),blockGasLimit:pinnedBlock.gasLimit.toString(),batchFile:fileURLToPath(OUTPUT)});
  console.info(`V4_SAFE_BATCH_READY ${planDigest} contracts=${deployments.length} calls=${transactions.length} gas=${totalGas}/${pinnedBlock.gasLimit} block=${pinnedBlock.number}`);
}

main().catch(error=>{console.error(error instanceof Error?error.message:'V4_SAFE_BATCH_PREPARATION_FAILED');process.exitCode=1;});
