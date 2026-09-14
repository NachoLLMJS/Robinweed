import { readFile, writeFile } from 'node:fs/promises';
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, getAddress, keccak256 } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';
import { assertActivationPlanDigest, stable } from './lib/activationPlanDigest.js';
import { attestSafe } from './lib/safeAttestation.js';

const root=new URL('../',import.meta.url);
const envPath=process.env.STOCKDEALER_MAINNET_ENV??externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const SAFE_ABI=['function nonce() view returns(uint256)','function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)','function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns(bool)'];

async function main(){
  if(!process.argv.includes('--broadcast'))throw new Error('EXPLICIT_ACTIVATION_BROADCAST_FLAG_REQUIRED');
  const [env,batch,foundation,controllerArtifact,routerArtifact,adapterArtifact,coreArtifact,vaultArtifact]=await Promise.all([
    readFile(envPath,'utf8').then(parseEnv),load('deployments/safe-activation-v4-batch.json'),load('deployments/robinhood-mainnet-foundation-v4.json'),
    load('artifacts/contracts/StockdealerFoundationControllerV4.sol/StockdealerFoundationControllerV4.json'),load('artifacts/contracts/StockdealerEconomyRouter.sol/StockdealerEconomyRouter.json'),load('artifacts/contracts/StockdealerPonsLifecycleAdapterV4.sol/StockdealerPonsLifecycleAdapterV4.json'),load('artifacts/contracts/StockdealerGameCoreV4.sol/StockdealerGameCoreV4.json'),load('artifacts/contracts/StockdealerRewardVault.sol/StockdealerRewardVault.json')
  ]);
  assertActivationPlanDigest(batch); // ACTIVATION_PLAN_DIGEST_MISMATCH
  if(batch.chainId!=='4663'||batch.transactions?.length!==1||batch.meta?.targetSequenceSimulation!=='single-call-complete')throw new Error('ACTIVATION_BATCH_SHAPE_INVALID');
  if(JSON.stringify(stable(batch.foundationAttestation))!==JSON.stringify(stable({planDigest:foundation.planDigest,deploymentTxHash:foundation.deploymentTxHash,blockNumber:foundation.blockNumber,blockHash:foundation.blockHash,contracts:foundation.contracts,codeHashes:foundation.codeHashes})))throw new Error('FOUNDATION_ATTESTATION_MISMATCH');
  const creationHashes={controller:keccak256(controllerArtifact.bytecode),router:keccak256(routerArtifact.bytecode),adapter:keccak256(adapterArtifact.bytecode),core:keccak256(coreArtifact.bytecode),vault:keccak256(vaultArtifact.bytecode)};
  if(JSON.stringify(stable(creationHashes))!==JSON.stringify(stable(batch.creationHashes)))throw new Error('ACTIVATION_CREATION_HASH_MISMATCH');
  if(!batch.economicPreflight||!batch.activation||!batch.meta.safeAttestation)throw new Error('ACTIVATION_ATTESTATIONS_MISSING');
  const item=batch.transactions[0],controllerAddress=getAddress(foundation.contracts.FoundationController);
  if(getAddress(item.to)!==controllerAddress||BigInt(item.value)!==0n)throw new Error('ACTIVATION_CALL_MISMATCH');
  const controllerInterface=new Interface(controllerArtifact.abi);
  let decoded;try{decoded=controllerInterface.decodeFunctionData('activateStockdealerEconomy',item.data);}catch{throw new Error('ACTIVATION_CALLDATA_INVALID');}
  if(getAddress(decoded[0].token)!==getAddress(batch.activation.tokenAddress))throw new Error('ACTIVATION_TOKEN_CALLDATA_MISMATCH');
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true,batchMaxCount:1});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const key=env.DEPLOYER_PRIVATE_KEY??'';if(!/^(?:0x)?[0-9a-fA-F]{64}$/.test(key))throw new Error('VALID_DEPLOYER_PRIVATE_KEY_REQUIRED');
  const wallet=new Wallet(key.startsWith('0x')?key:`0x${key}`,provider),safeAddress=getAddress(batch.meta.createdFromSafeAddress);
  if(getAddress(wallet.address)!==getAddress(batch.meta.safeAttestation.owners[0])||batch.meta.safeAttestation.threshold!==1)throw new Error('SIGNER_IS_NOT_SOLE_SAFE_OWNER');
  const currentSafe=await attestSafe(provider,safeAddress,env,'latest');
  if(JSON.stringify(stable(currentSafe))!==JSON.stringify(stable(batch.meta.safeAttestation)))throw new Error('SAFE_STATE_CHANGED_SINCE_ACTIVATION_PLAN');
  for(const [name,address] of Object.entries(foundation.contracts)){const code=await provider.getCode(address);if(code==='0x'||keccak256(code).toLowerCase()!==foundation.codeHashes[name].toLowerCase())throw new Error(`FOUNDATION_CODE_CHANGED:${name}`);}
  const controller=new Contract(controllerAddress,controllerArtifact.abi,provider),router=new Contract(foundation.contracts.EconomyRouter,routerArtifact.abi,provider),core=new Contract(foundation.contracts.GameCore,coreArtifact.abi,provider),adapter=new Contract(foundation.contracts.PonsAdapter,adapterArtifact.abi,provider);
  if(await controller.activated()||getAddress(await controller.stockdealerToken())!==ZeroAddress||!(await router.paused())||!(await core.purchasesPaused())||!(await core.gameplayPaused())||!(await core.claimsPaused())||await adapter.configurationFrozen())throw new Error('FOUNDATION_NOT_PAUSED_FOR_ACTIVATION');
  const safeRead=new Contract(safeAddress,SAFE_ABI,provider),nonce=BigInt(batch.meta.safeAttestation.nonce);
  const params=[controllerAddress,0n,item.data,0,0n,0n,0n,ZeroAddress,ZeroAddress];
  const safeTxHash=await safeRead.getTransactionHash(...params,nonce),signature=wallet.signingKey.sign(safeTxHash).serialized;
  const safe=new Contract(safeAddress,SAFE_ABI,wallet);
  if(!(await safe.execTransaction.staticCall(...params,signature)))throw new Error('ACTIVATION_SAFE_SIMULATION_FAILED');
  const gasEstimate=await safe.execTransaction.estimateGas(...params,signature),gasLimit=gasEstimate*12n/10n,block=await provider.getBlock('latest');
  if(!block||gasLimit>block.gasLimit)throw new Error('ACTIVATION_EXCEEDS_BLOCK_GAS');
  const fee=await provider.getFeeData(),feeCap=fee.maxFeePerGas??fee.gasPrice;if(!feeCap||await provider.getBalance(wallet.address)<gasLimit*feeCap)throw new Error('INSUFFICIENT_OWNER_GAS_BALANCE');
  const sent=await safe.execTransaction(...params,signature,{gasLimit});
  console.info(`V4_ACTIVATION_BROADCAST ${sent.hash} safeTxHash=${safeTxHash}`);
  const receipt=await sent.wait(1);if(!receipt||receipt.status!==1)throw new Error('V4_ACTIVATION_REVERTED');
  if(!(await controller.activated())||getAddress(await controller.stockdealerToken())!==getAddress(batch.activation.tokenAddress)||getAddress(await router.currency())!==getAddress(batch.activation.tokenAddress)||await router.paused()||await core.purchasesPaused()||await core.gameplayPaused()||await core.claimsPaused()||!(await adapter.configurationFrozen()))throw new Error('V4_ACTIVATION_POSTCONDITION_FAILED');
  await writeFile(new URL('deployments/stockdealer-mainnet-v4-activation-execution.json',root),`${JSON.stringify({status:'MINED_PENDING_FINAL_VERIFICATION',planDigest:batch.meta.checksum,transactionHash:sent.hash,safeTxHash,blockNumber:receipt.blockNumber},null,2)}\n`);
  console.info(`V4_ACTIVATION_MINED ${sent.hash} block=${receipt.blockNumber}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V4_ACTIVATION_EXECUTION_FAILED');process.exitCode=1;});
