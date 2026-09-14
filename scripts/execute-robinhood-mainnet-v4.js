import { readFile } from 'node:fs/promises';
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, getAddress, getCreate2Address, keccak256, toUtf8Bytes } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';
import { attestSafe } from './lib/safeAttestation.js';
import { assertPackedBatch, packBatch } from './lib/safeMultisend.js';

const ROOT=new URL('../',import.meta.url);
const ENV_PATH=process.env.STOCKDEALER_MAINNET_ENV??externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const SAFE_ABI=[
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns(bool)',
  'function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns(bytes32)'
];
const MULTISEND_ABI=['function multiSend(bytes transactions)'];
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const load=async path=>JSON.parse(await readFile(new URL(path,ROOT),'utf8'));
const withoutNonce=({nonce,...rest})=>rest;

async function main(){
  if(!process.argv.includes('--broadcast'))throw new Error('EXPLICIT_BROADCAST_FLAG_REQUIRED');
  const [env,plan,batch]=await Promise.all([
    readFile(ENV_PATH,'utf8').then(parseEnv),
    load('deployments/stockdealer-mainnet-foundation-v4-plan.json'),
    load('deployments/stockdealer-mainnet-foundation-v4-safe-batch.json')
  ]);
  if(plan.chainId!==4663||plan.status!=='UNSIGNED_SAFE_BATCH_SIMULATED'||batch.chainId!=='4663'||batch.meta?.checksum!==plan.planDigest)throw new Error('INVALID_V4_PLAN');
  const expectedDigest=keccak256(toUtf8Bytes(JSON.stringify(stable({baseDigest:plan.baseDigest,safeAttestation:plan.safe,pinnedBlock:plan.pinnedBlock,addresses:plan.contracts,transactions:batch.transactions}))));
  if(expectedDigest!==plan.planDigest)throw new Error('V4_PLAN_DIGEST_MISMATCH');
  const rawKey=env.DEPLOYER_PRIVATE_KEY??'';
  if(!/^(?:0x)?[0-9a-fA-F]{64}$/.test(rawKey))throw new Error('VALID_DEPLOYER_PRIVATE_KEY_REQUIRED');
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true,batchMaxCount:1});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const wallet=new Wallet(rawKey.startsWith('0x')?rawKey:`0x${rawKey}`,provider);
  if(getAddress(wallet.address)!==getAddress(plan.safe.owners[0])||plan.safe.threshold!==1)throw new Error('SIGNER_IS_NOT_SOLE_SAFE_OWNER');
  const currentSafe=await attestSafe(provider,plan.safe.address,env,'latest');
  if(JSON.stringify(stable(withoutNonce(currentSafe)))!==JSON.stringify(stable(withoutNonce(plan.safe)))||currentSafe.nonce!==plan.safe.nonce)throw new Error('SAFE_STATE_CHANGED_SINCE_PLAN');
  for(const deployment of plan.deployments){
    const transaction=batch.transactions.find(tx=>getAddress(tx.to)===getAddress(plan.create2Proxy.address)&&tx.data.slice(0,66)===deployment.salt);
    if(!transaction)throw new Error(`V4_DEPLOYMENT_CALL_MISSING:${deployment.label}`);
    const initCode=`0x${transaction.data.slice(66)}`;
    if(keccak256(initCode)!==deployment.initCodeHash||getAddress(getCreate2Address(plan.create2Proxy.address,deployment.salt,keccak256(initCode)))!==getAddress(deployment.address)||(await provider.getCode(deployment.address))!=='0x')throw new Error(`V4_CREATE2_PREFLIGHT_FAILED:${deployment.label}`);
  }
  const packed=packBatch(batch.transactions);
  assertPackedBatch(packed,batch.transactions);
  const multiSendData=new Interface(MULTISEND_ABI).encodeFunctionData('multiSend',[packed]);
  const args=[plan.safe.multiSend.address,0n,multiSendData,1,0n,0n,0n,ZeroAddress,ZeroAddress];
  const safeRead=new Contract(plan.safe.address,SAFE_ABI,provider);
  const safeTxHash=await safeRead.getTransactionHash(...args,BigInt(plan.safe.nonce));
  const signature=wallet.signingKey.sign(safeTxHash).serialized;
  const safe=new Contract(plan.safe.address,SAFE_ABI,wallet);
  const executable=await safe.execTransaction.staticCall(...args,signature);
  if(executable!==true)throw new Error('SAFE_EXECUTION_SIMULATION_FAILED');
  const gasEstimate=await safe.execTransaction.estimateGas(...args,signature);
  const gasLimit=gasEstimate*12n/10n;
  const latestBlock=await provider.getBlock('latest');
  if(!latestBlock||gasLimit>latestBlock.gasLimit)throw new Error('SAFE_EXECUTION_EXCEEDS_BLOCK_GAS');
  const fee=await provider.getFeeData();
  const feeCap=fee.maxFeePerGas??fee.gasPrice;
  if(!feeCap||await provider.getBalance(wallet.address)<gasLimit*feeCap)throw new Error('INSUFFICIENT_OWNER_GAS_BALANCE');
  const transaction=await safe.execTransaction(...args,signature,{gasLimit});
  console.info(`V4_SAFE_EXECUTION_BROADCAST ${transaction.hash} safeTxHash=${safeTxHash} gasLimit=${gasLimit}`);
  const receipt=await transaction.wait(1);
  if(!receipt||receipt.status!==1)throw new Error('V4_SAFE_EXECUTION_REVERTED');
  console.info(`V4_SAFE_EXECUTION_MINED ${transaction.hash} block=${receipt.blockNumber}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V4_SAFE_EXECUTION_FAILED');process.exitCode=1;});
