import { Interface, getAddress, keccak256 } from 'ethers';

const GAME_CORE_ABI = [
  'function buySeedPacks(bytes32 ticker,uint32 packs,uint256 maxTotalPrice,uint256 minimumStockOut,uint256 deadline) returns (uint256)',
  'function buyHouse(uint32 houseId,uint256 maxPrice,uint256[] minimumOuts,uint256 deadline) returns (uint256[])',
  'function plant(uint32 houseId,uint8 plotId,bytes32 ticker) returns (bytes32)',
  'function water(uint32 houseId,uint8 plotId)',
  'function claimHarvest(uint32 houseId,uint8 plotId,address recipient) returns (uint256)',
];
const gameCoreInterface = new Interface(GAME_CORE_ABI);
const erc20Interface = new Interface([
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
]);
const ALLOWED_ACTIONS = new Set(['buySeedPacks', 'buyHouse', 'plant', 'water', 'claimHarvest']);
const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;

function rpcQuantity(value, errorCode) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(errorCode);
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed)) throw new Error(errorCode);
  return parsed;
}

function configuredAddress(config, name) {
  const matches = config?.contracts?.filter(contract => contract.name === name) ?? [];
  if (matches.length !== 1) throw new Error(`${name.toUpperCase()}_NOT_CONFIGURED`);
  return getAddress(matches[0].address);
}

export function gameCoreAddress(config) {
  if (config?.chainId !== 4663 || config?.economyActive !== true) throw new Error('ECONOMY_NOT_READY');
  return configuredAddress(config, 'GameCore');
}

export async function assertWalletForWrite(ethereum, expectedAccount) {
  if (!ethereum?.request) throw new Error('WALLET_UNAVAILABLE');
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  if (chainId?.toLowerCase() !== '0x1237') throw new Error('WRONG_CHAIN');
  const accounts = await ethereum.request({ method: 'eth_accounts' });
  if (!accounts?.length || getAddress(accounts[0]) !== getAddress(expectedAccount)) throw new Error('ACCOUNT_CHANGED');
  return getAddress(accounts[0]);
}

export async function sendGameAction({ ethereum, config, account, action, args, onPrepared = async () => {} }) {
  const target = gameCoreAddress(config);
  if (!ALLOWED_ACTIONS.has(action) || !Array.isArray(args)) throw new Error('ACTION_NOT_ALLOWED');
  const sender = await assertWalletForWrite(ethereum, account);
  const data = gameCoreInterface.encodeFunctionData(action, args);
  const nonce = rpcQuantity(await ethereum.request({ method: 'eth_getTransactionCount', params: [sender, 'pending'] }), 'INVALID_PENDING_NONCE');
  const preparedBlock = rpcQuantity(await ethereum.request({ method: 'eth_blockNumber' }), 'INVALID_PREPARED_BLOCK');
  await onPrepared({ chainId: 4663, account: sender, target, dataHash: keccak256(data), nonce, preparedBlock });
  const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: sender, to: target, data, value: '0x0', nonce: `0x${nonce.toString(16)}` }] });
  if (!TRANSACTION_HASH.test(hash ?? '')) throw new Error('UNKNOWN_TRANSACTION_STATE');
  return hash;
}

export async function approveCurrencyIfNeeded({ ethereum, config, account, amount, onPrepared = async () => {} }) {
  if (config?.economyActive !== true || typeof amount !== 'bigint' || amount <= 0n) throw new Error('ECONOMY_NOT_READY');
  const currency = getAddress(config.currency);
  const router = configuredAddress(config, 'EconomyRouter');
  const sender = await assertWalletForWrite(ethereum, account);
  const allowanceData = erc20Interface.encodeFunctionData('allowance', [sender, router]);
  const rawAllowance = await ethereum.request({ method: 'eth_call', params: [{ to: currency, data: allowanceData }, 'latest'] });
  const [allowance] = erc20Interface.decodeFunctionResult('allowance', rawAllowance);
  if (allowance === amount) return null;
  await assertWalletForWrite(ethereum, account);
  const data = erc20Interface.encodeFunctionData('approve', [router, amount]);
  const nonce = rpcQuantity(await ethereum.request({ method: 'eth_getTransactionCount', params: [sender, 'pending'] }), 'INVALID_PENDING_NONCE');
  const preparedBlock = rpcQuantity(await ethereum.request({ method: 'eth_blockNumber' }), 'INVALID_PREPARED_BLOCK');
  await onPrepared({ chainId: 4663, account: sender, target: currency, dataHash: keccak256(data), nonce, preparedBlock });
  const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: sender, to: currency, data, value: '0x0', nonce: `0x${nonce.toString(16)}` }] });
  if (!TRANSACTION_HASH.test(hash ?? '')) throw new Error('UNKNOWN_TRANSACTION_STATE');
  return hash;
}

export async function waitForCanonicalReceipt(ethereum, hash, { pollMs = 1_500, timeoutMs = 180_000, confirmations = 12 } = {}) {
  if (!ethereum?.request || !TRANSACTION_HASH.test(hash ?? '') || !Number.isInteger(confirmations) || confirmations < 1) throw new Error('INVALID_TRANSACTION_HASH');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) {
      if (!['0x0','0x1'].includes(receipt.status)) throw new Error('INVALID_RECEIPT_STATUS');
      if (receipt.transactionHash?.toLowerCase() !== hash.toLowerCase()) throw new Error('RECEIPT_IDENTITY_MISMATCH');
      if (!TRANSACTION_HASH.test(receipt.blockHash ?? '')) throw new Error('INVALID_RECEIPT_BLOCK');
      const receiptBlock = rpcQuantity(receipt.blockNumber, 'INVALID_RECEIPT_BLOCK');
      const latestBlock = rpcQuantity(await ethereum.request({ method: 'eth_blockNumber' }), 'INVALID_RECEIPT_BLOCK');
      if (latestBlock >= receiptBlock + confirmations - 1) {
        const [canonicalBlock, finalReceipt] = await Promise.all([
          ethereum.request({ method: 'eth_getBlockByNumber', params: [receipt.blockNumber, false] }),
          ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] }),
        ]);
        if (canonicalBlock?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase() || finalReceipt?.blockHash?.toLowerCase() !== receipt.blockHash.toLowerCase() || finalReceipt?.blockNumber !== receipt.blockNumber || finalReceipt?.transactionHash?.toLowerCase() !== hash.toLowerCase() || finalReceipt?.status !== receipt.status) throw new Error('TRANSACTION_REORGED');
        return finalReceipt;
      }
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error('TRANSACTION_STATUS_UNKNOWN');
}

export async function waitForSuccessfulReceipt(ethereum, hash, options) {
  const receipt = await waitForCanonicalReceipt(ethereum, hash, options);
  if (receipt.status !== '0x1') throw new Error('TRANSACTION_REVERTED');
  return receipt;
}
