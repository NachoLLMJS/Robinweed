import { readFile, writeFile } from 'node:fs/promises';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, keccak256 } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';
import { assertActivationPlanDigest, stable } from './lib/activationPlanDigest.js';
import { attestSafe } from './lib/safeAttestation.js';

const root=new URL('../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const SAFE_ABI=['function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)','function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns(bool)','event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)'];
const withoutNonce=({nonce,...rest})=>rest;

async function main(){
  const txHash=process.argv.find(value=>/^0x[0-9a-fA-F]{64}$/.test(value));if(!txHash)throw new Error('ACTIVATION_EXECUTION_TX_HASH_REQUIRED');
  const [env,batch,foundation,controllerArtifact,routerArtifact,adapterArtifact,coreArtifact,vaultArtifact]=await Promise.all([
    readFile(process.env.STOCKDEALER_MAINNET_ENV??externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env'),'utf8').then(parseEnv),load('deployments/safe-activation-v4-batch.json'),load('deployments/robinhood-mainnet-foundation-v4.json'),
    load('artifacts/contracts/StockdealerFoundationControllerV4.sol/StockdealerFoundationControllerV4.json'),load('artifacts/contracts/StockdealerEconomyRouter.sol/StockdealerEconomyRouter.json'),load('artifacts/contracts/StockdealerPonsLifecycleAdapterV4.sol/StockdealerPonsLifecycleAdapterV4.json'),load('artifacts/contracts/StockdealerGameCoreV4.sol/StockdealerGameCoreV4.json'),load('artifacts/contracts/StockdealerRewardVault.sol/StockdealerRewardVault.json')
  ]);
  assertActivationPlanDigest(batch); // ACTIVATION_PLAN_DIGEST_MISMATCH
  if(batch.chainId!=='4663'||batch.transactions?.length!==1||!batch.meta?.safeAttestation||!batch.foundationAttestation||!batch.creationHashes||!batch.economicPreflight||batch.meta.targetSequenceSimulation!=='single-call-complete')throw new Error('ACTIVATION_PLAN_INVALID');
  const expectedFoundation={planDigest:foundation.planDigest,deploymentTxHash:foundation.deploymentTxHash,blockNumber:foundation.blockNumber,blockHash:foundation.blockHash,contracts:foundation.contracts,codeHashes:foundation.codeHashes};
  if(JSON.stringify(stable(batch.foundationAttestation))!==JSON.stringify(stable(expectedFoundation)))throw new Error('FOUNDATION_ATTESTATION_MISMATCH');
  const creationHashes={controller:keccak256(controllerArtifact.bytecode),router:keccak256(routerArtifact.bytecode),adapter:keccak256(adapterArtifact.bytecode),core:keccak256(coreArtifact.bytecode),vault:keccak256(vaultArtifact.bytecode)};
  if(JSON.stringify(stable(creationHashes))!==JSON.stringify(stable(batch.creationHashes)))throw new Error('ACTIVATION_CREATION_HASH_MISMATCH');
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true,batchMaxCount:1});if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const receipt=await provider.getTransactionReceipt(txHash),transaction=await provider.getTransaction(txHash),safeAddress=getAddress(batch.meta.createdFromSafeAddress);
  if(!receipt||receipt.status!==1||!transaction||getAddress(transaction.to??ZeroAddress)!==safeAddress)throw new Error('ACTIVATION_RECEIPT_INVALID');
  const head=await provider.getBlockNumber(),confirmations=Math.max(1,Number(env.MIN_CONFIRMATIONS??12));if(head-receipt.blockNumber+1<confirmations)throw new Error('ACTIVATION_NOT_FINALIZED');
  const canonical=await provider.getBlock(receipt.blockNumber);if(!canonical||canonical.hash.toLowerCase()!==receipt.blockHash.toLowerCase())throw new Error('ACTIVATION_NOT_CANONICAL');
  const safeInterface=new Interface(SAFE_ABI);let outer;try{outer=safeInterface.decodeFunctionData('execTransaction',transaction.data);}catch{throw new Error('ACTIVATION_SAFE_CALLDATA_INVALID');}
  const [to,value,data,operation,safeTxGas,baseGas,gasPrice,gasToken,refundReceiver]=outer,item=batch.transactions[0];
  if(getAddress(to)!==getAddress(item.to)||value!==BigInt(item.value)||data.toLowerCase()!==item.data.toLowerCase()||Number(operation)!==0||safeTxGas!==0n||baseGas!==0n||gasPrice!==0n||getAddress(gasToken)!==ZeroAddress||getAddress(refundReceiver)!==ZeroAddress)throw new Error('ACTIVATION_SAFE_ENVELOPE_MISMATCH');
  const controllerInterface=new Interface(controllerArtifact.abi);try{const decoded=controllerInterface.decodeFunctionData('activateStockdealerEconomy',data);if(getAddress(decoded[0].token)!==getAddress(batch.activation.tokenAddress))throw new Error('ACTIVATION_TOKEN_MISMATCH');}catch(error){if(error instanceof Error&&error.message==='ACTIVATION_TOKEN_MISMATCH')throw error;throw new Error('ACTIVATION_CALLDATA_INVALID');}
  const safe=new Contract(safeAddress,SAFE_ABI,provider),expectedSafeTxHash=await safe.getTransactionHash(to,value,data,operation,safeTxGas,baseGas,gasPrice,gasToken,refundReceiver,BigInt(batch.meta.safeAttestation.nonce),{blockTag:receipt.blockNumber});
  const successes=receipt.logs.flatMap(log=>{if(getAddress(log.address)!==safeAddress)return[];try{const parsed=safeInterface.parseLog(log);return parsed?.name==='ExecutionSuccess'?[parsed]:[];}catch{return[];}});
  if(successes.length!==1||successes[0].args.txHash.toLowerCase()!==expectedSafeTxHash.toLowerCase())throw new Error('ACTIVATION_SAFE_SUCCESS_MISMATCH');
  const postSafe=await attestSafe(provider,safeAddress,env,receipt.blockNumber);if(JSON.stringify(stable(withoutNonce(postSafe)))!==JSON.stringify(stable(withoutNonce(batch.meta.safeAttestation)))||BigInt(postSafe.nonce)!==BigInt(batch.meta.safeAttestation.nonce)+1n)throw new Error('ACTIVATION_SAFE_POSTSTATE_MISMATCH');
  for(const [name,address] of Object.entries(foundation.contracts)){const code=await provider.getCode(address,receipt.blockNumber);if(code==='0x'||keccak256(code).toLowerCase()!==foundation.codeHashes[name].toLowerCase())throw new Error(`ACTIVATION_FOUNDATION_CODE_MISMATCH:${name}`);}
  const controller=new Contract(foundation.contracts.FoundationController,controllerArtifact.abi,provider),router=new Contract(foundation.contracts.EconomyRouter,routerArtifact.abi,provider),adapter=new Contract(foundation.contracts.PonsAdapter,adapterArtifact.abi,provider),core=new Contract(foundation.contracts.GameCore,coreArtifact.abi,provider),token=getAddress(batch.activation.tokenAddress);
  if(!(await controller.activated())||getAddress(await controller.stockdealerToken())!==token||getAddress(await router.currency())!==token||await router.paused()||await core.purchasesPaused()||await core.gameplayPaused()||await core.claimsPaused()||!(await adapter.configurationFrozen()))throw new Error('ACTIVATION_POSTCONDITION_FAILED');
  for(const symbol of batch.activation.symbols){const sku=await core.seedSkus(`0x${Buffer.from(symbol).toString('hex').padEnd(64,'0')}`);if(!sku.configured||sku.packPrice===0n||sku.seedsPerPack===0n)throw new Error(`ACTIVATION_SKU_POSTCONDITION_FAILED:${symbol}`);}
  for(const house of batch.activation.houses){const configured=await core.houses(house.onchainId);if(!configured.configured||configured.price===0n||configured.capacity!==BigInt(house.capacity))throw new Error(`ACTIVATION_HOUSE_POSTCONDITION_FAILED:${house.onchainId}`);}
  await writeFile(new URL('deployments/stockdealer-mainnet-v4-activation-execution.json',root),`${JSON.stringify({status:'STOCKDEALER_V4_ACTIVATED_VERIFIED',planDigest:batch.meta.checksum,transactionHash:txHash,safeTxHash:expectedSafeTxHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,verifiedAt:new Date().toISOString()},null,2)}\n`);
  console.info(`STOCKDEALER_V4_ACTIVATION_VERIFIED ${txHash} block=${receipt.blockNumber}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V4_ACTIVATION_VERIFICATION_FAILED');process.exitCode=1;});
