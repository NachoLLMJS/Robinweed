import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';

const CHAIN_ID=4663;
const FACTORY='0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
const SINGLETON='0x41675C099F32341bf84BFc5382aF534df5C7461a';
const SENTINEL='0x0000000000000000000000000000000000000001';
const GUARD_SLOT='0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c7';
const DEFAULT_ENV=externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env');
const JOURNAL=resolve('deployments/robinhood-mainnet-rehearsal-safe.json');
const SAFE_ABI=[
  'function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)',
  'function VERSION() view returns(string)',
  'function getOwners() view returns(address[])',
  'function getThreshold() view returns(uint256)',
  'function nonce() view returns(uint256)',
  'function getModulesPaginated(address,uint256) view returns(address[],address)'
];
const FACTORY_ABI=['function createProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns(address proxy)'];
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at).trim(),line.slice(at+1).trim().replace(/^['"]|['"]$/g,'')];}));
const atomicWrite=async(path,value)=>{await mkdir(dirname(path),{recursive:true});const temp=`${path}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,path);};
const updateEnv=async(path,values)=>{const text=await readFile(path,'utf8');const lines=text.split(/\r?\n/);const seen=new Set();const output=lines.map(line=>{const at=line.indexOf('=');if(at<1||line.trimStart().startsWith('#'))return line;const key=line.slice(0,at).trim();if(!Object.hasOwn(values,key))return line;seen.add(key);return `${key}=${values[key]}`;});for(const [key,value] of Object.entries(values))if(!seen.has(key))output.push(`${key}=${value}`);await writeFile(path,output.join('\n').replace(/\n*$/,'\n'));};

async function verifySafe(provider,address,owner){
  const code=await provider.getCode(address);if(code==='0x')throw new Error('SAFE_CODE_MISSING');
  if(getAddress(`0x${(await provider.getStorage(address,0n)).slice(-40)}`)!==SINGLETON)throw new Error('SAFE_SINGLETON_MISMATCH');
  const safe=new Contract(address,SAFE_ABI,provider);const owners=(await safe.getOwners()).map(getAddress);const threshold=await safe.getThreshold();const nonce=await safe.nonce();const version=await safe.VERSION();const [modules,next]=await safe.getModulesPaginated(SENTINEL,100n);const guard=getAddress(`0x${(await provider.getStorage(address,BigInt(GUARD_SLOT))).slice(-40)}`);
  if(owners.length!==1||owners[0]!==owner||threshold!==1n||nonce!==0n||modules.length!==0||getAddress(next)!==SENTINEL||guard!==ZeroAddress)throw new Error('SAFE_CONFIGURATION_MISMATCH');
  return {address,proxyCodeHash:keccak256(code),singleton:SINGLETON,singletonCodeHash:keccak256(await provider.getCode(SINGLETON)),factory:FACTORY,factoryCodeHash:keccak256(await provider.getCode(FACTORY)),version,owners,threshold:'1',modules:[],guard:ZeroAddress,nonce:'0'};
}

async function main(){
  const envPath=process.env.STOCKDEALER_MAINNET_ENV??DEFAULT_ENV;const env=parseEnv(await readFile(envPath,'utf8'));
  if(!/^(?:0x)?[0-9a-fA-F]{64}$/.test(env.DEPLOYER_PRIVATE_KEY??'')||!env.ROBINHOOD_MAINNET_RPC_URL)throw new Error('MISSING_DEPLOYMENT_CREDENTIALS');
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,CHAIN_ID,{staticNetwork:true});if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const signer=new Wallet(env.DEPLOYER_PRIVATE_KEY.startsWith('0x')?env.DEPLOYER_PRIVATE_KEY:`0x${env.DEPLOYER_PRIVATE_KEY}`,provider);if(!env.EXPECTED_DEPLOYER_ADDRESS||signer.address!==getAddress(env.EXPECTED_DEPLOYER_ADDRESS))throw new Error('DEPLOYER_ADDRESS_MISMATCH');if((await provider.getCode(signer.address))!=='0x')throw new Error('DEPLOYER_MUST_BE_EOA');
  const factoryCode=await provider.getCode(FACTORY),singletonCode=await provider.getCode(SINGLETON);if(factoryCode==='0x'||singletonCode==='0x')throw new Error('SAFE_DEPENDENCY_MISSING');
  const safeInterface=new Interface(SAFE_ABI);const initializer=safeInterface.encodeFunctionData('setup',[[signer.address],1n,ZeroAddress,'0x',ZeroAddress,ZeroAddress,0n,ZeroAddress]);const saltNonce=BigInt(keccak256(toUtf8Bytes('STOCKDEALER-FLYCO-REHEARSAL-SAFE-1')));const factory=new Contract(FACTORY,FACTORY_ABI,signer);
  let prior=null;if(existsSync(JOURNAL)){prior=JSON.parse(await readFile(JOURNAL,'utf8'));if(prior.owner!==signer.address||prior.saltNonce!==saltNonce.toString())throw new Error('SAFE_JOURNAL_MISMATCH');if(prior.status==='completed'){await verifySafe(provider,getAddress(prior.predictedAddress),signer.address);console.info(`REHEARSAL_SAFE_ALREADY_DEPLOYED ${getAddress(prior.predictedAddress)}`);return;}if(prior.status==='broadcast'){const receipt=await provider.waitForTransaction(prior.txHash,Number(env.MIN_CONFIRMATIONS??1),180000);if(!receipt||receipt.status!==1)throw new Error('SAFE_DEPLOYMENT_NOT_CONFIRMED');const recoveredAddress=getAddress(prior.predictedAddress);const attestation=await verifySafe(provider,recoveredAddress,signer.address);await atomicWrite(JOURNAL,{...prior,status:'completed',blockNumber:receipt.blockNumber,attestation:{...attestation,deploymentTxHash:prior.txHash}});console.info(`REHEARSAL_SAFE_RECOVERED ${recoveredAddress}`);return;}if(prior.status!=='prepared')throw new Error('SAFE_JOURNAL_REQUIRES_MANUAL_RECOVERY');}
  const predicted=getAddress(await factory.createProxyWithNonce.staticCall(SINGLETON,initializer,saltNonce));
  if(prior&&prior.predictedAddress!==predicted)throw new Error('SAFE_JOURNAL_MISMATCH');
  if((await provider.getCode(predicted))!=='0x')throw new Error('PREDICTED_SAFE_ALREADY_HAS_CODE');
  const request=await factory.createProxyWithNonce.populateTransaction(SINGLETON,initializer,saltNonce);const nonce=await provider.getTransactionCount(signer.address,'pending');const gasEstimate=await provider.estimateGas({...request,from:signer.address});const fee=await provider.getFeeData();const gasPrice=fee.maxFeePerGas??fee.gasPrice;if(!gasPrice)throw new Error('GAS_PRICE_UNAVAILABLE');const gasLimit=gasEstimate*120n/100n;const required=gasLimit*gasPrice;if(await provider.getBalance(signer.address)<required)throw new Error('INSUFFICIENT_SAFE_DEPLOY_GAS');
  const prepared={status:'prepared',chainId:CHAIN_ID,owner:signer.address,factory:FACTORY,factoryCodeHash:keccak256(factoryCode),singleton:SINGLETON,singletonCodeHash:keccak256(singletonCode),predictedAddress:predicted,saltNonce:saltNonce.toString(),nonce,dataHash:keccak256(request.data),gasLimit:gasLimit.toString(),preparedBlock:await provider.getBlockNumber()};if(prior){if(prior.nonce!==nonce||prior.dataHash!==prepared.dataHash||prior.gasLimit!==prepared.gasLimit)throw new Error('SAFE_PREPARED_STATE_CHANGED');}else await atomicWrite(JOURNAL,prepared);
  if(!process.argv.includes('--broadcast')){console.info(`SAFE_PREFLIGHT_READY ${predicted}`);return;}
  const sent=await signer.sendTransaction({...request,nonce,gasLimit});await atomicWrite(JOURNAL,{...prepared,status:'broadcast',txHash:sent.hash});const confirmations=Number(env.MIN_CONFIRMATIONS??1);const receipt=await sent.wait(confirmations);if(!receipt||receipt.status!==1)throw new Error('SAFE_DEPLOYMENT_REVERTED');const attestation=await verifySafe(provider,predicted,signer.address);const completed={...prepared,status:'completed',txHash:sent.hash,blockNumber:receipt.blockNumber,attestation:{...attestation,deploymentTxHash:sent.hash}};await atomicWrite(JOURNAL,completed);
  await updateEnv(envPath,{ADMIN_MULTISIG_ADDRESS:predicted,ADMIN_SAFE_CODE_HASH:attestation.proxyCodeHash,ADMIN_SAFE_SINGLETON_ADDRESS:SINGLETON,ADMIN_SAFE_SINGLETON_CODE_HASH:attestation.singletonCodeHash,ADMIN_SAFE_FACTORY_ADDRESS:FACTORY,ADMIN_SAFE_FACTORY_CODE_HASH:attestation.factoryCodeHash,ADMIN_SAFE_DEPLOYMENT_TX_HASH:sent.hash,ADMIN_SAFE_VERSION:attestation.version,ADMIN_SAFE_OWNERS:signer.address,ADMIN_SAFE_THRESHOLD:'1',ADMIN_SAFE_MODULES:'',ADMIN_SAFE_GUARD_STORAGE_SLOT:GUARD_SLOT,ADMIN_SAFE_GUARD_ADDRESS:ZeroAddress});
  console.info(`REHEARSAL_SAFE_DEPLOYED ${predicted} ${sent.hash}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'SAFE_DEPLOYMENT_FAILED');process.exitCode=1;});
