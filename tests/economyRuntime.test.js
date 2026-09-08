import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBytes32String, keccak256 } from 'ethers';
import { executeCultivationAction, executeHousePurchase, executeSeedPurchase, loadEconomyConfig, reconcileEconomyJournal } from '../src/economyRuntime.js';

const symbols = ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA'];
const account = '0x1111111111111111111111111111111111111111';
const config = { chainId: 4663, economyActive: true, currency: '0x3333333333333333333333333333333333333333', houseBasketSymbols: symbols, contracts: [{ name: 'GameCore', address: '0x2222222222222222222222222222222222222222' }, { name: 'EconomyRouter', address: '0x4444444444444444444444444444444444444444' }] };
const quoteIdentity = { chainId: 4663, gameCore: config.contracts[0].address, economyRouter: config.contracts[1].address, currency: config.currency, quoteBlock: 100, quoteBlockHash: `0x${'9'.repeat(64)}`, quoteBlockTimestamp: 1000, deadline: 1300 };
const makeStorage = (value = null) => ({ value, getItem() { return this.value; }, setItem(_key, next) { this.value = next; }, removeItem() { this.value = null; } });
const locks = { request: async (_name, _options, callback) => callback() };

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function quoteProvider({ quoteHash = quoteIdentity.quoteBlockHash, quoteTimestamp = 1000, latestNumber = 100, latestTimestamp = 1000 } = {}) {
  const calls = [];
  return { calls, request: async ({ method, params }) => {
    calls.push({ method, params });
    if (method !== 'eth_getBlockByNumber') throw new Error(`unexpected ${method}`);
    if (params[0] === '0x64') return { number: '0x64', hash: quoteHash, timestamp: `0x${quoteTimestamp.toString(16)}` };
    if (params[0] === 'latest') return { number: `0x${latestNumber.toString(16)}`, hash: `0x${'8'.repeat(64)}`, timestamp: `0x${latestTimestamp.toString(16)}` };
    throw new Error('unexpected block');
  } };
}
const seedQuote = overrides => ({ ...quoteIdentity, symbol: 'MSFT', packs: 1, ticker: encodeBytes32String('MSFT'), totalPrice: '100', quotedStockOut: '60', minimumStockOut: '60', ...overrides });
const houseQuote = overrides => ({ ...quoteIdentity, houseId: 2, capacity: 4, totalPrice: '500', tickers: symbols.map(encodeBytes32String), quotedStockOuts: symbols.map(() => '100'), minimumOuts: symbols.map(() => '99'), ...overrides });

test('economy config loader accepts only the exact ordered seven-stock basket', async () => {
  assert.deepEqual(await loadEconomyConfig(async () => ({ ok: true, json: async () => config })), config);
  await assert.rejects(loadEconomyConfig(async () => ({ ok: true, json: async () => ({ ...config, houseBasketSymbols: [...symbols].reverse() }) })), /INCOMPLETE_HOUSE_BASKET/);
});

test('seed purchase pins the quote block and exact 300-second deadline before approval and send', async () => {
  const ethereum = quoteProvider();
  const calls = [];
  const result = await executeSeedPurchase({ symbol: 'MSFT', account, config, ethereum, storage: makeStorage(), locks,
    fetchImpl: async () => ({ ok: true, json: async () => seedQuote() }),
    approve: async () => { calls.push('approve'); return null; },
    send: async () => { calls.push('send'); return `0x${'b'.repeat(64)}`; },
    waitCanonical: async () => ({ status: '0x1' }), now: () => 1_000_000,
  });
  assert.equal(result.hash, `0x${'b'.repeat(64)}`);
  assert.deepEqual(calls, ['approve', 'send']);
  assert.deepEqual(ethereum.calls.map(call => call.params[0]), ['0x64', 'latest', '0x64', 'latest']);
});

test('seed purchase fails closed before approval for an altered, stale, or expired quote block', async () => {
  for (const ethereum of [
    quoteProvider({ quoteHash: `0x${'7'.repeat(64)}` }),
    quoteProvider({ quoteTimestamp: 999 }),
    quoteProvider({ latestNumber: 121 }),
    quoteProvider({ latestTimestamp: 1300 }),
  ]) {
    let approved = false;
    await assert.rejects(executeSeedPurchase({ symbol: 'MSFT', account, config, ethereum, storage: makeStorage(), locks,
      fetchImpl: async () => ({ ok: true, json: async () => seedQuote() }), approve: async () => { approved = true; }, send: async () => `0x${'b'.repeat(64)}` }), /QUOTE_(BLOCK_CHANGED|STALE|EXPIRED)/);
    assert.equal(approved, false);
  }
});

test('seed purchase rejects a server minimum weaker than the exact requested one-percent tolerance', async () => {
  let approved = false;
  await assert.rejects(executeSeedPurchase({ symbol: 'MSFT', account, config, ethereum: quoteProvider(), storage: makeStorage(), locks,
    fetchImpl: async () => ({ ok: true, json: async () => seedQuote({ minimumStockOut: '1' }) }), approve: async () => { approved = true; } }), /INVALID_QUOTE/);
  assert.equal(approved, false);
});

test('house purchase binds ID, configured capacity and all seven ordered routes', async () => {
  const calls = [];
  const storage = makeStorage();
  const result = await executeHousePurchase({ houseId: 2, account, config, ethereum: quoteProvider(), storage, locks,
    fetchImpl: async () => ({ ok: true, json: async () => houseQuote() }),
    approve: async input => { calls.push(['approve', input.amount]); return null; },
    send: async input => { calls.push(['send', input.action, input.args]); return `0x${'e'.repeat(64)}`; }, waitCanonical: async () => ({ status: '0x1' }), now: () => 1_000_000,
  });
  assert.equal(result.hash, `0x${'e'.repeat(64)}`);
  assert.deepEqual(calls[1], ['send', 'buyHouse', [2, 500n, symbols.map(() => 99n), 1300n]]);
  assert.equal(storage.value, null);
});

test('house purchase rejects mismatched basket identity, route lengths, capacity, or house ID', async () => {
  const malformed = [
    { houseId: 3 },
    { capacity: 8 },
    { tickers: symbols.map(encodeBytes32String).reverse() },
    { tickers: symbols.slice(0, 6).map(encodeBytes32String), quotedStockOuts: symbols.slice(0, 6).map(() => '1'), minimumOuts: symbols.slice(0, 6).map(() => '1') },
    { quotedStockOuts: [] },
    { minimumOuts: symbols.slice(1).map(() => '1') },
    { minimumOuts: symbols.map(() => '1') },
  ];
  for (const overrides of malformed) {
    let approved = false;
    await assert.rejects(executeHousePurchase({ houseId: 2, account, config, ethereum: quoteProvider(), storage: makeStorage(), locks,
      fetchImpl: async () => ({ ok: true, json: async () => houseQuote(overrides) }), approve: async () => { approved = true; }, send: async () => '' }), /INVALID_QUOTE/);
    assert.equal(approved, false);
  }
});

test('simultaneous in-tab economy intents cannot both enter the wallet send path', async () => {
  const gate = deferred();
  const storage = makeStorage();
  let sends = 0;
  const first = executeCultivationAction({ action: 'water', args: [2, 0], account, config, ethereum: {}, storage, locks, send: async () => { sends += 1; await gate.promise; return `0x${'f'.repeat(64)}`; }, waitCanonical: async () => ({ status: '0x1' }) });
  await Promise.resolve();
  await assert.rejects(executeCultivationAction({ action: 'water', args: [2, 1], account, config, ethereum: {}, storage, locks, send: async () => { sends += 1; return `0x${'e'.repeat(64)}`; } }), /ECONOMY_OPERATION_IN_PROGRESS/);
  gate.resolve();
  await first;
  assert.equal(sends, 1);
});

test('cultivation action is journaled and receipt-confirmed without a payment approval', async () => {
  const storage = makeStorage();
  const calls = [];
  const result = await executeCultivationAction({ action: 'water', args: [2, 0], account, config, ethereum: {}, storage, locks, now: () => 1000,
    send: async input => { calls.push(input); return `0x${'f'.repeat(64)}`; }, waitCanonical: async () => ({ status: '0x1' }) });
  assert.equal(result.hash, `0x${'f'.repeat(64)}`);
  assert.equal(calls[0].action, 'water');
  assert.equal(storage.value, null);
});

test('explicit rejection preserves a journal after a confirmed approval', async () => {
  const storage = makeStorage();
  await assert.rejects(executeHousePurchase({ houseId: 2, account, config, ethereum: quoteProvider(), storage, locks,
    fetchImpl: async () => ({ ok: true, json: async () => houseQuote() }), approve: async () => `0x${'a'.repeat(64)}`,
    waitCanonical: async () => ({ status: '0x1' }), send: async () => { const error = new Error('user rejected'); error.code = 4001; throw error; },
  }));
  assert.equal(JSON.parse(storage.value).approvalConfirmed, true);
});

test('reconciliation keeps approval and action identities separate after approval confirmation', async () => {
  const approvalHash = `0x${'a'.repeat(64)}`;
  const approvalData = '0x1234';
  const actionData = '0x5678';
  const storage = makeStorage();
  await assert.rejects(executeHousePurchase({ houseId: 2, account, config, ethereum: quoteProvider(), storage, locks,
    fetchImpl: async () => ({ ok: true, json: async () => houseQuote() }),
    approve: async input => { input.onPrepared({ chainId: 4663, account, target: config.currency, dataHash: keccak256(approvalData), nonce: 3 }); return approvalHash; },
    waitCanonical: async () => ({ status: '0x1' }),
    send: async input => { input.onPrepared({ chainId: 4663, account, target: config.contracts[0].address, dataHash: keccak256(actionData), nonce: 4 }); const error = new Error('user rejected'); error.code = 4001; throw error; },
  }));
  const ethereum = { request: async ({ method }) => ({ eth_chainId: '0x1237', eth_accounts: [account], eth_getTransactionReceipt: { status: '0x1' }, eth_getTransactionByHash: { hash: approvalHash, from: account, to: config.currency, input: approvalData, nonce: '0x3' } })[method] };
  assert.deepEqual(await reconcileEconomyJournal({ ethereum, account, storage, locks, waitCanonical: async () => ({ status: '0x1' }) }), { status: 'APPROVAL_CONFIRMED_RETRY_ACTION', hash: approvalHash });
  assert.equal(JSON.parse(storage.value).approvalConfirmed, true);
});

test('explicit wallet rejection clears only an unbroadcast unapproved journal', async () => {
  const rejected = makeStorage();
  await assert.rejects(executeCultivationAction({ action: 'water', args: [2, 0], account, config, ethereum: {}, storage: rejected, locks, send: async () => { const error = new Error('rejected'); error.code = 4001; throw error; } }));
  assert.equal(rejected.value, null);
  const ambiguous = makeStorage();
  await assert.rejects(executeCultivationAction({ action: 'water', args: [2, 0], account, config, ethereum: {}, storage: ambiguous, locks, send: async () => { throw new Error('network unknown'); } }));
  assert.notEqual(ambiguous.value, null);
});

test('reconciliation validates transaction target, calldata hash, and nonce before trusting a receipt', async () => {
  const data = '0x1234';
  const hash = `0x${'a'.repeat(64)}`;
  const journal = { account, status: 'actionBroadcast', hash, prepared: { chainId: 4663, account, target: config.contracts[0].address, dataHash: keccak256(data), nonce: 7 } };
  const storage = makeStorage(JSON.stringify(journal));
  const ethereum = { request: async ({ method }) => ({ eth_chainId: '0x1237', eth_accounts: [account], eth_getTransactionReceipt: { status: '0x1' }, eth_getTransactionByHash: { hash, from: account, to: config.contracts[0].address, input: data, nonce: '0x7' } })[method] };
  let waited = false;
  assert.deepEqual(await reconcileEconomyJournal({ ethereum, account, storage, locks, waitCanonical: async (_ethereum, waitedHash) => { waited = true; assert.equal(waitedHash, hash); return { status: '0x1' }; } }), { status: 'ACTION_CONFIRMED', hash });
  assert.equal(waited, true);
  assert.equal(storage.value, null);
  const altered = makeStorage(JSON.stringify(journal));
  const badEthereum = { request: async ({ method }) => method === 'eth_chainId' ? '0x1237' : method === 'eth_accounts' ? [account] : method === 'eth_getTransactionReceipt' ? { status: '0x1' } : { hash, from: account, to: config.contracts[0].address, input: '0xbeef', nonce: '0x7' } };
  await assert.rejects(reconcileEconomyJournal({ ethereum: badEthereum, account, storage: altered, locks }), /TRANSACTION_IDENTITY_MISMATCH/);
  assert.notEqual(altered.value, null);
});

test('reconciliation distinguishes dropped and replaced actions without deleting confirmed approval authority', async () => {
  const prepared = { chainId: 4663, account, target: config.contracts[0].address, dataHash: keccak256('0x1234'), nonce: 7 };
  for (const [latestNonce, expected] of [[7, 'ACTION_DROPPED_RETRY'], [8, 'ACTION_REPLACED']]) {
    const storage = makeStorage(JSON.stringify({ account, status: 'actionBroadcast', approvalConfirmed: true, approvalHash: `0x${'c'.repeat(64)}`, hash: `0x${'d'.repeat(64)}`, prepared }));
    const ethereum = { request: async ({ method, params }) => {
      if (method === 'eth_chainId') return '0x1237';
      if (method === 'eth_accounts') return [account];
      if (method === 'eth_getTransactionReceipt' || method === 'eth_getTransactionByHash') return null;
      if (method === 'eth_getTransactionCount') return `0x${latestNonce.toString(16)}`;
      if (method === 'eth_getBlockByNumber' && params[0] === 'latest') return { transactions: [] };
      throw new Error(`unexpected ${method}`);
    } };
    assert.equal((await reconcileEconomyJournal({ ethereum, account, storage, locks })).status, expected);
    assert.equal(JSON.parse(storage.value).approvalConfirmed, true);
  }
});

test('reconciliation finds a mined replacement in the bounded prepared-block range', async () => {
  const data = '0x1234';
  const originalHash = `0x${'d'.repeat(64)}`;
  const replacementHash = `0x${'e'.repeat(64)}`;
  const prepared = { chainId: 4663, account, target: config.contracts[0].address, dataHash: keccak256(data), nonce: 7, preparedBlock: 8 };
  const storage = makeStorage(JSON.stringify({ account, status: 'actionBroadcast', hash: originalHash, actionPrepared: prepared }));
  const ethereum = { request: async ({ method, params }) => {
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_accounts') return [account];
    if (method === 'eth_getTransactionReceipt') return params[0] === replacementHash ? { status: '0x1' } : null;
    if (method === 'eth_getTransactionByHash') return null;
    if (method === 'eth_getTransactionCount') return '0x8';
    if (method === 'eth_blockNumber') return '0xa';
    if (method === 'eth_getBlockByNumber') return { transactions: params[0] === '0x9' ? [{ hash: replacementHash, from: account, to: prepared.target, input: data, nonce: '0x7' }] : [] };
    throw new Error(`unexpected ${method}`);
  } };
  assert.deepEqual(await reconcileEconomyJournal({ ethereum, account, storage, locks, waitCanonical: async () => ({ status: '0x1' }) }), { status: 'ACTION_CONFIRMED', hash: replacementHash });
  assert.equal(storage.value, null);
});

test('a confirmed approval journal resumes its matching house purchase after restart', async () => {
  const storage=makeStorage(JSON.stringify({type:'HOUSE_PURCHASE',houseId:2,account,status:'approvalConfirmed',approvalConfirmed:true,totalPrice:'500'}));
  let sent=0;
  const result=await executeHousePurchase({houseId:2,account,config,ethereum:quoteProvider(),storage,locks,fetchImpl:async()=>({ok:true,json:async()=>houseQuote()}),approve:async()=>null,send:async()=>{sent+=1;return `0x${'e'.repeat(64)}`;},waitCanonical:async()=>({status:'0x1'})});
  assert.equal(result.hash,`0x${'e'.repeat(64)}`);assert.equal(sent,1);assert.equal(storage.value,null);
});

test('reconciliation confirms a reverted receipt canonically before clearing its journal', async () => {
  const data='0x1234',hash=`0x${'a'.repeat(64)}`,storage=makeStorage(JSON.stringify({account,status:'actionBroadcast',hash,prepared:{chainId:4663,account,target:config.contracts[0].address,dataHash:keccak256(data),nonce:7}}));
  const ethereum={request:async({method})=>method==='eth_chainId'?'0x1237':method==='eth_accounts'?[account]:method==='eth_getTransactionReceipt'?{status:'0x0'}:{hash,from:account,to:config.contracts[0].address,input:data,nonce:'0x7'}};
  let waited=false;
  assert.deepEqual(await reconcileEconomyJournal({ethereum,account,storage,locks,waitCanonical:async()=>{waited=true;return{status:'0x0'};}}),{status:'TRANSACTION_REVERTED',hash});
  assert.equal(waited,true);assert.equal(storage.value,null);
});
