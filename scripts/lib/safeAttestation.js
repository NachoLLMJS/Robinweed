import { Contract, Interface, ZeroAddress, getAddress, keccak256 } from 'ethers';

export const SAFE_SENTINEL = '0x0000000000000000000000000000000000000001';
export const SAFE_GUARD_STORAGE_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c7';
const SAFE_ABI = [
  'function VERSION() view returns(string)',
  'function getOwners() view returns(address[])',
  'function getThreshold() view returns(uint256)',
  'function nonce() view returns(uint256)',
  'function getModulesPaginated(address,uint256) view returns(address[],address)'
];
const FACTORY_EVENTS = new Interface(['event ProxyCreation(address indexed proxy,address singleton)']);
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

const addressFromStorage = value => getAddress(`0x${value.slice(-40)}`);
const csvAddresses = value => (value ?? '').split(',').filter(Boolean).map(getAddress).sort();

export async function attestSafe(provider, safeAddress, env, blockTag, { requireMultiSend = true } = {}) {
  const address = getAddress(safeAddress);
  for (const key of ['ADMIN_SAFE_CODE_HASH','ADMIN_SAFE_SINGLETON_CODE_HASH','ADMIN_SAFE_FACTORY_CODE_HASH','ADMIN_SAFE_DEPLOYMENT_TX_HASH']) {
    if (!hashPattern.test(env[key] ?? '')) throw new Error(`${key}_REQUIRED`);
  }
  for (const key of ['ADMIN_SAFE_SINGLETON_ADDRESS','ADMIN_SAFE_FACTORY_ADDRESS','ADMIN_SAFE_GUARD_ADDRESS']) {
    if (!addressPattern.test(env[key] ?? '')) throw new Error(`${key}_REQUIRED`);
  }
  if ((env.ADMIN_SAFE_GUARD_STORAGE_SLOT ?? '').toLowerCase() !== SAFE_GUARD_STORAGE_SLOT) throw new Error('ADMIN_SAFE_GUARD_STORAGE_SLOT_MISMATCH');
  if (!Object.hasOwn(env, 'ADMIN_SAFE_MODULES')) throw new Error('ADMIN_SAFE_MODULES_REQUIRED');

  const singleton = getAddress(env.ADMIN_SAFE_SINGLETON_ADDRESS);
  const factory = getAddress(env.ADMIN_SAFE_FACTORY_ADDRESS);
  const guard = getAddress(env.ADMIN_SAFE_GUARD_ADDRESS);
  const [proxyCode, singletonCode, factoryCode] = await Promise.all([
    provider.getCode(address, blockTag), provider.getCode(singleton, blockTag), provider.getCode(factory, blockTag)
  ]);
  if (proxyCode === '0x' || keccak256(proxyCode).toLowerCase() !== env.ADMIN_SAFE_CODE_HASH.toLowerCase()) throw new Error('ADMIN_SAFE_CODE_HASH_MISMATCH');
  if (singletonCode === '0x' || keccak256(singletonCode).toLowerCase() !== env.ADMIN_SAFE_SINGLETON_CODE_HASH.toLowerCase()) throw new Error('ADMIN_SAFE_SINGLETON_CODE_HASH_MISMATCH');
  if (factoryCode === '0x' || keccak256(factoryCode).toLowerCase() !== env.ADMIN_SAFE_FACTORY_CODE_HASH.toLowerCase()) throw new Error('ADMIN_SAFE_FACTORY_CODE_HASH_MISMATCH');
  if (addressFromStorage(await provider.getStorage(address, 0n, blockTag)) !== singleton) throw new Error('ADMIN_SAFE_SINGLETON_MISMATCH');
  if (addressFromStorage(await provider.getStorage(address, BigInt(SAFE_GUARD_STORAGE_SLOT), blockTag)) !== guard) throw new Error('ADMIN_SAFE_GUARD_MISMATCH');

  const deploymentHash = env.ADMIN_SAFE_DEPLOYMENT_TX_HASH;
  const [deploymentTx, deploymentReceipt] = await Promise.all([provider.getTransaction(deploymentHash), provider.getTransactionReceipt(deploymentHash)]);
  if (!deploymentTx || getAddress(deploymentTx.to ?? ZeroAddress) !== factory || !deploymentReceipt || deploymentReceipt.status !== 1 || deploymentReceipt.blockNumber > Number(blockTag)) throw new Error('ADMIN_SAFE_DEPLOYMENT_PROVENANCE_INVALID');
  const canonicalDeploymentBlock = await provider.getBlock(deploymentReceipt.blockNumber);
  if (!canonicalDeploymentBlock || canonicalDeploymentBlock.hash.toLowerCase() !== deploymentReceipt.blockHash.toLowerCase()) throw new Error('ADMIN_SAFE_DEPLOYMENT_NOT_CANONICAL');
  const proxyCreation = deploymentReceipt.logs.some(log => {
    if (getAddress(log.address) !== factory) return false;
    try { const parsed = FACTORY_EVENTS.parseLog(log); return parsed && getAddress(parsed.args.proxy) === address && getAddress(parsed.args.singleton) === singleton; }
    catch { return false; }
  });
  if (!proxyCreation) throw new Error('ADMIN_SAFE_PROXY_CREATION_EVENT_MISSING');

  const expectedOwners = csvAddresses(env.ADMIN_SAFE_OWNERS);
  const expectedModules = csvAddresses(env.ADMIN_SAFE_MODULES);
  const expectedThreshold = Number(env.ADMIN_SAFE_THRESHOLD);
  if (!env.ADMIN_SAFE_VERSION || expectedOwners.length === 0 || !Number.isSafeInteger(expectedThreshold) || expectedThreshold < 1 || expectedThreshold > expectedOwners.length) throw new Error('ADMIN_SAFE_EXPECTATIONS_REQUIRED');
  const safe = new Contract(address, SAFE_ABI, provider);
  const owners = (await safe.getOwners({ blockTag })).map(getAddress).sort();
  const threshold = Number(await safe.getThreshold({ blockTag }));
  const nonce = await safe.nonce({ blockTag });
  const version = await safe.VERSION({ blockTag });
  const [rawModules, next] = await safe.getModulesPaginated(SAFE_SENTINEL, 100n, { blockTag });
  const modules = rawModules.map(getAddress).sort();
  if (version !== env.ADMIN_SAFE_VERSION || threshold !== expectedThreshold || owners.length !== expectedOwners.length || owners.some((owner,index) => owner !== expectedOwners[index])) throw new Error('ADMIN_SAFE_CONFIGURATION_MISMATCH');
  if (getAddress(next) !== SAFE_SENTINEL || modules.length !== expectedModules.length || modules.some((module,index) => module !== expectedModules[index])) throw new Error('ADMIN_SAFE_EXTENSION_CONFIGURATION_MISMATCH');

  let multiSend = null;
  if (requireMultiSend) {
    if (!addressPattern.test(env.ADMIN_SAFE_MULTISEND_ADDRESS ?? '') || !hashPattern.test(env.ADMIN_SAFE_MULTISEND_CODE_HASH ?? '')) throw new Error('ADMIN_SAFE_MULTISEND_ATTESTATION_REQUIRED');
    const multiSendAddress = getAddress(env.ADMIN_SAFE_MULTISEND_ADDRESS);
    const code = await provider.getCode(multiSendAddress, blockTag);
    if (code === '0x' || keccak256(code).toLowerCase() !== env.ADMIN_SAFE_MULTISEND_CODE_HASH.toLowerCase()) throw new Error('ADMIN_SAFE_MULTISEND_CODE_MISMATCH');
    multiSend = { address: multiSendAddress, codeHash: keccak256(code) };
  }

  return Object.freeze({
    address, codeHash: keccak256(proxyCode), singleton, singletonCodeHash: keccak256(singletonCode),
    factory, factoryCodeHash: keccak256(factoryCode), deploymentTxHash: deploymentTx.hash,
    version, owners, threshold, modules, guard, nonce: nonce.toString(), multiSend
  });
}
