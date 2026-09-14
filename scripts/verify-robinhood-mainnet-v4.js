import { readFile, rename, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, encodeBytes32String, getAddress, getCreate2Address, keccak256, toUtf8Bytes } from 'ethers';
import { fileURLToPath } from 'node:url';
import { externalConfigPath } from './lib/localPaths.js';
import { assertPackedBatch } from './lib/safeMultisend.js';
import { attestSafe, SAFE_GUARD_STORAGE_SLOT } from './lib/safeAttestation.js';

const ROOT=new URL('../',import.meta.url);
const PLAN_URL=new URL('deployments/stockdealer-mainnet-foundation-v4-plan.json',ROOT);
const JOURNAL_URL=new URL('deployments/robinhood-mainnet-foundation-v4.json',ROOT);
const DEFAULT_ENV=externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const PONS_FACTORY='0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const UNIVERSAL_ROUTER='0x8876789976dEcBfCbBbe364623C63652db8C0904';
const PERMIT2='0x000000000022D473030F116dDEE9F6B43aC78BA3';
const V3_ROUTER='0xCaf681a66D020601342297493863E78C959E5cb2';
const V3_FACTORY='0x1f7d7550B1b028f7571E69A784071F0205FD2EfA';
const WETH='0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const STOCKS=Object.freeze({AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d'});
const SAFE_EVENTS=new Interface(['event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)']);
const SAFE_ABI=['function VERSION() view returns(string)','function getOwners() view returns(address[])','function getThreshold() view returns(uint256)','function nonce() view returns(uint256)','function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns(bool)','function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns(bytes32)'];
const MULTISEND_ABI=['function multiSend(bytes transactions)'];
const execFileAsync=promisify(execFile);
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const load=async url=>JSON.parse(await readFile(url,'utf8'));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const artifact=async(file,name)=>JSON.parse(await readFile(new URL(`artifacts/contracts/${file}.sol/${name}.json`,ROOT),'utf8'));
const atomicWrite=async(url,value)=>{const path=fileURLToPath(url),tmp=`${path}.tmp`;await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`);await rename(tmp,path);};
const ensureFreshBuild=async()=>execFileAsync(process.execPath,[fileURLToPath(new URL('node_modules/hardhat/dist/src/cli.js',ROOT)),'compile','--force'],{cwd:fileURLToPath(ROOT),windowsHide:true});
function maskImmutableReferences(bytecode,immutableReferences={}){const bytes=Buffer.from(bytecode.slice(2),'hex');for(const references of Object.values(immutableReferences))for(const {start,length}of references)bytes.fill(0,start,start+length);return`0x${bytes.toString('hex')}`;}
function assertRuntime(label,runtime,artifactValue){if(runtime==='0x'||runtime.length!==artifactValue.deployedBytecode.length||maskImmutableReferences(runtime,artifactValue.immutableReferences).toLowerCase()!==artifactValue.deployedBytecode.toLowerCase())throw new Error(`DEPLOYED_ARTIFACT_RUNTIME_MISMATCH:${label}`);}
async function main(){
  const txHash=process.argv.find(value=>/^0x[0-9a-fA-F]{64}$/.test(value));
  if(!txHash)throw new Error('SAFE_EXECUTION_TX_HASH_REQUIRED');
  await ensureFreshBuild();
  const env=parseEnv(await readFile(process.env.STOCKDEALER_MAINNET_ENV??DEFAULT_ENV,'utf8'));
  const plan=await load(PLAN_URL);
  const batch=await load(new URL('deployments/stockdealer-mainnet-foundation-v4-safe-batch.json',ROOT));
  if(plan.chainId!==4663||plan.status!=='UNSIGNED_SAFE_BATCH_SIMULATED'||batch.chainId!=='4663'||batch.meta?.checksum!==plan.planDigest)throw new Error('INVALID_V4_PLAN');
  const expectedDigest=keccak256(toUtf8Bytes(JSON.stringify(stable({baseDigest:plan.baseDigest,safeAttestation:plan.safe,pinnedBlock:plan.pinnedBlock,addresses:plan.contracts,transactions:batch.transactions}))));
  if(expectedDigest!==plan.planDigest)throw new Error('V4_PLAN_DIGEST_MISMATCH');
  const labels=['FoundationController','EconomyRouter','PonsAdapter',...Object.keys(STOCKS).map(symbol=>`Vault_${symbol}`),'GameCore'];
  if(batch.transactions.length!==labels.length+1||plan.deployments?.length!==labels.length)throw new Error('V4_DEPLOYMENT_BATCH_SHAPE_INVALID');
  for(const [index,label] of labels.entries()){
    const deployment=plan.deployments[index],transaction=batch.transactions[index];
    if(deployment.label!==label||getAddress(transaction.to)!==getAddress(plan.create2Proxy.address)||transaction.value!=='0'||!/^0x[0-9a-fA-F]+$/.test(transaction.data))throw new Error(`V4_DEPLOYMENT_CALL_INVALID:${label}`);
    const salt=transaction.data.slice(0,66),initCode=`0x${transaction.data.slice(66)}`;
    const predicted=getCreate2Address(plan.create2Proxy.address,salt,keccak256(initCode));
    if(salt!==deployment.salt||keccak256(initCode)!==deployment.initCodeHash||getAddress(predicted)!==getAddress(deployment.address)||getAddress(predicted)!==getAddress(plan.contracts[label]))throw new Error(`V4_CREATE2_COMMITMENT_INVALID:${label}`);
  }
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true,batchMaxCount:1});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const pinned=await provider.getBlock(plan.pinnedBlock.number);
  if(!pinned||pinned.hash.toLowerCase()!==plan.pinnedBlock.hash.toLowerCase())throw new Error('V4_PINNED_BLOCK_NOT_CANONICAL');
  const safe=new Contract(plan.safe.address,SAFE_ABI,provider);
  // The official RPC prunes historical state-code metadata. The pinned block hash
  // remains canonical, while the exact pre-state is bound by the Safe tx hash/nonce
  // and the complete Safe attestation is repeated at the canonical receipt block.
  const receipt=await provider.getTransactionReceipt(txHash),transaction=await provider.getTransaction(txHash);
  if(!receipt||receipt.status!==1||!transaction||getAddress(transaction.to??ZeroAddress)!==getAddress(plan.safe.address))throw new Error('SAFE_EXECUTION_RECEIPT_INVALID');
  const minimumConfirmations=Math.max(1,Number(env.MIN_CONFIRMATIONS??12));
  const head=await provider.getBlockNumber();
  if(head-receipt.blockNumber+1<minimumConfirmations)throw new Error('SAFE_EXECUTION_NOT_FINALIZED');
  const canonical=await provider.getBlock(receipt.blockNumber);
  if(!canonical||canonical.hash.toLowerCase()!==receipt.blockHash.toLowerCase())throw new Error('SAFE_EXECUTION_NOT_CANONICAL');
  const successes=receipt.logs.filter(log=>getAddress(log.address)===getAddress(plan.safe.address)).flatMap(log=>{try{const parsed=SAFE_EVENTS.parseLog(log);return parsed?.name==='ExecutionSuccess'?[parsed]:[];}catch{return[];}});
  if(successes.length!==1)throw new Error('SAFE_EXECUTION_SUCCESS_EVENT_MISSING');

  const artifacts={FoundationController:await artifact('StockdealerFoundationControllerV4','StockdealerFoundationControllerV4'),EconomyRouter:await artifact('StockdealerEconomyRouter','StockdealerEconomyRouter'),PonsAdapter:await artifact('StockdealerPonsLifecycleAdapterV4','StockdealerPonsLifecycleAdapterV4'),GameCore:await artifact('StockdealerGameCoreV4','StockdealerGameCoreV4'),Vault:await artifact('StockdealerRewardVault','StockdealerRewardVault')};
  for(const [index,label] of labels.entries()){
    const initCode=`0x${batch.transactions[index].data.slice(66)}`,artifactValue=label.startsWith('Vault_')?artifacts.Vault:artifacts[label];
    if(!initCode.toLowerCase().startsWith(artifactValue.bytecode.toLowerCase()))throw new Error(`V4_CREATION_ARTIFACT_MISMATCH:${label}`);
  }
  const safeInterface=new Interface(SAFE_ABI),multiSendInterface=new Interface(MULTISEND_ABI);
  let outer;try{outer=safeInterface.decodeFunctionData('execTransaction',transaction.data);}catch{throw new Error('SAFE_EXECUTION_CALLDATA_INVALID');}
  const [multiSendAddress,outerValue,multiSendData,operation,safeTxGas,baseGas,gasPrice,gasToken,refundReceiver]=outer;
  if(getAddress(multiSendAddress)!==getAddress(plan.safe.multiSend.address)||outerValue!==0n||Number(operation)!==1)throw new Error('SAFE_MULTISEND_ENVELOPE_INVALID');
  const multiSendCode=await provider.getCode(multiSendAddress,receipt.blockNumber);
  if(multiSendCode==='0x'||keccak256(multiSendCode).toLowerCase()!==plan.safe.multiSend.codeHash.toLowerCase())throw new Error('SAFE_MULTISEND_CODE_MISMATCH');
  let packed;try{[packed]=multiSendInterface.decodeFunctionData('multiSend',multiSendData);}catch{throw new Error('SAFE_MULTISEND_CALLDATA_INVALID');}
  assertPackedBatch(packed,batch.transactions);
  const expectedSafeTxHash=await safe.getTransactionHash(multiSendAddress,outerValue,multiSendData,operation,safeTxGas,baseGas,gasPrice,gasToken,refundReceiver,BigInt(plan.safe.nonce),{blockTag:receipt.blockNumber});
  if(expectedSafeTxHash.toLowerCase()!==successes[0].args.txHash.toLowerCase())throw new Error('SAFE_TRANSACTION_HASH_MISMATCH');
  const postSafe=await attestSafe(provider,plan.safe.address,env,receipt.blockNumber);
  const withoutNonce=({nonce,...rest})=>rest;
  if(JSON.stringify(stable(withoutNonce(postSafe)))!==JSON.stringify(stable(withoutNonce(plan.safe)))||BigInt(postSafe.nonce)!==BigInt(plan.safe.nonce)+1n)throw new Error('SAFE_POSTEXEC_ATTESTATION_MISMATCH');
  const configure=batch.transactions.at(-1),configureInterface=new Interface(artifacts.FoundationController.abi);
  const configured=configureInterface.decodeFunctionData('configureFoundation',configure.data);
  if(getAddress(configure.to)!==getAddress(plan.contracts.FoundationController)||configure.value!=='0'||getAddress(configured[0])!==getAddress(plan.contracts.EconomyRouter)||getAddress(configured[1])!==getAddress(plan.contracts.PonsAdapter)||getAddress(configured[2])!==getAddress(plan.contracts.GameCore)||configured[3].length!==7||configured[4].length!==7||configured[5].length!==7)throw new Error('V4_FOUNDATION_CONFIGURATION_CALL_INVALID');
  for(const [index,symbol] of Object.keys(STOCKS).entries())if(configured[3][index]!==encodeBytes32String(symbol)||getAddress(configured[4][index])!==getAddress(STOCKS[symbol])||getAddress(configured[5][index])!==getAddress(plan.contracts[`Vault_${symbol}`]))throw new Error(`V4_FOUNDATION_CONFIGURATION_MISMATCH:${symbol}`);
  const codeHashes={},steps={};
  for(const [label,address] of Object.entries(plan.contracts)){
    const [before,current]=await Promise.all([provider.getCode(address,receipt.blockNumber-1),provider.getCode(address,receipt.blockNumber)]);
    if(before!=='0x'||current==='0x')throw new Error(`CONTRACT_CREATION_BLOCK_MISMATCH:${label}`);
    const artifactValue=label.startsWith('Vault_')?artifacts.Vault:artifacts[label];
    assertRuntime(label,current,artifactValue);
    codeHashes[label]=keccak256(current);
    steps[label]={status:'completed',hash:txHash,blockNumber:receipt.blockNumber,address:getAddress(address),runtimeCodeHash:codeHashes[label]};
  }
  const c=plan.contracts,controller=new Contract(c.FoundationController,artifacts.FoundationController.abi,provider),router=new Contract(c.EconomyRouter,artifacts.EconomyRouter.abi,provider),adapter=new Contract(c.PonsAdapter,artifacts.PonsAdapter.abi,provider),core=new Contract(c.GameCore,artifacts.GameCore.abi,provider);
  if(getAddress(await controller.owner())!==getAddress(plan.safe.address)||getAddress(await controller.pendingOwner())!==ZeroAddress||getAddress(await controller.ponsFactory())!==getAddress(PONS_FACTORY)||!(await controller.foundationConfigured())||await controller.activated()||await controller.stockdealerToken()!==ZeroAddress||Number(await controller.tickerCount())!==7)throw new Error('CONTROLLER_POSTDEPLOY_AUDIT_FAILED');
  if(getAddress(await router.owner())!==getAddress(c.FoundationController)||getAddress(await router.gameCore())!==getAddress(c.GameCore)||await router.currency()!==ZeroAddress||!(await router.paused()))throw new Error('ROUTER_POSTDEPLOY_AUDIT_FAILED');
  if(getAddress(await adapter.owner())!==getAddress(c.FoundationController)||getAddress(await adapter.economyRouter())!==getAddress(c.EconomyRouter)||getAddress(await adapter.ponsFactory())!==getAddress(PONS_FACTORY)||getAddress(await adapter.universalRouter())!==getAddress(UNIVERSAL_ROUTER)||getAddress(await adapter.permit2())!==getAddress(PERMIT2)||getAddress(await adapter.v3Router())!==getAddress(V3_ROUTER)||getAddress(await adapter.v3Factory())!==getAddress(V3_FACTORY)||getAddress(await adapter.weth())!==getAddress(WETH)||await adapter.configurationFrozen())throw new Error('ADAPTER_POSTDEPLOY_AUDIT_FAILED');
  if(getAddress(await core.owner())!==getAddress(c.FoundationController)||getAddress(await core.economyRouter())!==getAddress(c.EconomyRouter)||!(await core.purchasesPaused())||!(await core.gameplayPaused())||!(await core.claimsPaused()))throw new Error('CORE_POSTDEPLOY_AUDIT_FAILED');
  const symbols=['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'];
  for(const [index,symbol] of symbols.entries()){const vault=new Contract(c[`Vault_${symbol}`],artifacts.Vault.abi,provider),route=await router.routes(encodeBytes32String(symbol)),registered=await controller.tickerAt(index);if(getAddress(await vault.owner())!==getAddress(c.FoundationController)||getAddress(await vault.gameCore())!==getAddress(c.GameCore)||getAddress(await vault.asset())!==getAddress(STOCKS[symbol])||registered.ticker!==encodeBytes32String(symbol)||getAddress(registered.rewardToken)!==getAddress(STOCKS[symbol])||getAddress(registered.rewardVault)!==getAddress(c[`Vault_${symbol}`])||!route.enabled||getAddress(route.rewardToken)!==getAddress(STOCKS[symbol])||getAddress(route.rewardVault)!==getAddress(c[`Vault_${symbol}`])||getAddress(route.adapter)!==getAddress(c.PonsAdapter))throw new Error(`VAULT_ROUTE_POSTDEPLOY_AUDIT_FAILED:${symbol}`);}
  await atomicWrite(JOURNAL_URL,{version:4,chainId:4663,status:'FOUNDATION_V4_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED',planDigest:plan.planDigest,safeAttestation:plan.safe,deploymentTxHash:txHash,safeTxHash:successes[0].args.txHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,contracts:c,codeHashes,steps,verifiedAt:new Date().toISOString()});
  console.info(`FOUNDATION_V4_VERIFIED_PAUSED ${plan.planDigest} block=${receipt.blockNumber}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V4_POSTDEPLOY_VERIFICATION_FAILED');process.exitCode=1;});
