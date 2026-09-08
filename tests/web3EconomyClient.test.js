import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBytes32String } from 'ethers';
import { approveCurrencyIfNeeded, sendGameAction, waitForCanonicalReceipt, waitForSuccessfulReceipt } from '../src/web3EconomyClient.js';

function walletProvider({ chainId = '0x1237', account = '0x1111111111111111111111111111111111111111' } = {}) {
  const calls = [];
  return {
    calls,
    request: async request => {
      calls.push(request);
      if (request.method === 'eth_chainId') return chainId;
      if (request.method === 'eth_accounts') return [account];
      if (request.method === 'eth_getTransactionCount') return '0x0';
      if (request.method === 'eth_blockNumber') return '0x64';
      if (request.method === 'eth_sendTransaction') return `0x${'a'.repeat(64)}`;
      throw new Error('unexpected method');
    },
  };
}

const account = '0x1111111111111111111111111111111111111111';
const config = {
  chainId: 4663,
  economyActive: true,
  contracts: [{ name: 'GameCore', address: '0x2222222222222222222222222222222222222222' }],
};

test('web3 client revalidates chain/account then sends an allowlisted GameCore action', async () => {
  const ethereum = walletProvider();
  let prepared;
  const hash = await sendGameAction({ ethereum, config, account, action: 'buySeedPacks', args: [encodeBytes32String('MSFT'), 1, 100n, 1n, 9_999_999_999n], onPrepared: value => { prepared = value; } });
  assert.match(hash, /^0x[a-f0-9]{64}$/);
  assert.deepEqual(ethereum.calls.map(call => call.method), ['eth_chainId', 'eth_accounts', 'eth_getTransactionCount', 'eth_blockNumber', 'eth_sendTransaction']);
  assert.equal(ethereum.calls[4].params[0].to, config.contracts[0].address);
  assert.equal(ethereum.calls[4].params[0].nonce, '0x0');
  assert.equal(prepared.preparedBlock, 100);
});

test('web3 client fails closed before send when economy, chain, account, target, or action is invalid', async () => {
  for (const input of [
    { ethereum: walletProvider(), config: { ...config, economyActive: false }, action: 'water', args: [1, 0] },
    { ethereum: walletProvider({ chainId: '0x1' }), config, action: 'water', args: [1, 0] },
    { ethereum: walletProvider({ account: '0x3333333333333333333333333333333333333333' }), config, action: 'water', args: [1, 0] },
    { ethereum: walletProvider(), config: { ...config, contracts: [] }, action: 'water', args: [1, 0] },
    { ethereum: walletProvider(), config, action: 'adminCall', args: [] },
  ]) {
    await assert.rejects(sendGameAction({ account, ...input }));
    assert.equal(input.ethereum.calls.some(call => call.method === 'eth_sendTransaction'), false);
  }
});

test('currency approval targets only the configured token and EconomyRouter for the exact required amount', async () => {
  const ethereum = walletProvider();
  ethereum.request = async request => {
    ethereum.calls.push(request);
    if (request.method === 'eth_chainId') return '0x1237';
    if (request.method === 'eth_accounts') return [account];
    if (request.method === 'eth_call') return `0x${'0'.repeat(64)}`;
    if (request.method === 'eth_getTransactionCount') return '0x0';
    if (request.method === 'eth_blockNumber') return '0x64';
    if (request.method === 'eth_sendTransaction') return `0x${'b'.repeat(64)}`;
    throw new Error('unexpected method');
  };
  const approvalConfig = { ...config, currency: '0x3333333333333333333333333333333333333333', contracts: [...config.contracts, { name: 'EconomyRouter', address: '0x4444444444444444444444444444444444444444' }] };
  const hash = await approveCurrencyIfNeeded({ ethereum, config: approvalConfig, account, amount: 100n });
  assert.match(hash, /^0x[b]{64}$/);
  const sent = ethereum.calls.find(call => call.method === 'eth_sendTransaction').params[0];
  assert.equal(sent.to, approvalConfig.currency);
  assert.equal(sent.nonce, '0x0');
  assert.match(sent.data, /^0x095ea7b3/);
});

test('receipt waiter rejects reverts and only resolves a canonical receipt after twelve confirmations', async () => {
  let receiptPolls = 0;
  let latestPolls = 0;
  const blockHash = `0x${'e'.repeat(64)}`;
  const transactionHash = `0x${'c'.repeat(64)}`;
  const ethereum = { request: async ({ method, params }) => {
    if (method === 'eth_getTransactionReceipt') return ++receiptPolls < 2 ? null : { status: '0x1', blockNumber: '0x64', blockHash, transactionHash };
    if (method === 'eth_blockNumber') return ++latestPolls < 2 ? '0x6a' : '0x6f';
    if (method === 'eth_getBlockByNumber' && params[0] === '0x64') return { hash: blockHash };
    throw new Error(`unexpected ${method}`);
  } };
  assert.deepEqual(await waitForSuccessfulReceipt(ethereum, transactionHash, { pollMs: 1, timeoutMs: 100 }), { status: '0x1', blockNumber: '0x64', blockHash, transactionHash });
  assert.ok(latestPolls >= 2);
  await assert.rejects(waitForSuccessfulReceipt({ request: async () => ({ status: '0x0' }) }, `0x${'d'.repeat(64)}`, { pollMs: 1, timeoutMs: 50 }));
  await assert.rejects(waitForSuccessfulReceipt({ request: async ({ method }) => method === 'eth_getTransactionReceipt' ? { status: '0x1', blockNumber: '0x64', blockHash, transactionHash: `0x${'d'.repeat(64)}` } : method === 'eth_blockNumber' ? '0x6f' : { hash: `0x${'f'.repeat(64)}` } }, `0x${'d'.repeat(64)}`, { pollMs: 1, timeoutMs: 50 }), /TRANSACTION_REORGED/);
  await assert.rejects(waitForSuccessfulReceipt({ request: async ({ method }) => method === 'eth_getTransactionReceipt' ? { status: '0x1', blockNumber: '0x64', blockHash, transactionHash: `0x${'f'.repeat(64)}` } : method === 'eth_blockNumber' ? '0x6f' : { hash: blockHash } }, `0x${'d'.repeat(64)}`, { pollMs: 1, timeoutMs: 50 }), /RECEIPT_IDENTITY_MISMATCH/);
});

test('canonical receipt waiter confirms and authenticates a reverted receipt before returning it', async () => {
  const hash=`0x${'d'.repeat(64)}`,blockHash=`0x${'e'.repeat(64)}`,receipt={status:'0x0',transactionHash:hash,blockNumber:'0x64',blockHash};
  const ethereum={request:async({method})=>method==='eth_getTransactionReceipt'?receipt:method==='eth_blockNumber'?'0x6f':{hash:blockHash}};
  assert.deepEqual(await waitForCanonicalReceipt(ethereum,hash,{pollMs:1,timeoutMs:50}),receipt);
});
