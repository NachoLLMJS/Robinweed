import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBytes32String } from 'ethers';
import { quoteSeedPurchase } from '../server/quoteService.js';

const ticker = encodeBytes32String('MSFT');
const gameCore = { seedSkus: async key => { assert.equal(key, ticker); return [100n, 4n, '0x2222222222222222222222222222222222222222', true]; } };
const router = {
  currency: async () => '0x1111111111111111111111111111111111111111',
  routes: async key => { assert.equal(key, ticker); return ['0x3333333333333333333333333333333333333333', '0x2222222222222222222222222222222222222222', '0x4444444444444444444444444444444444444444', true]; },
};
const adapter = { pathFor: async () => '0x123456' };
const quoter = { quoteExactInput: { staticCall: async (_path, amount) => [amount * 2n, [], [], 123n] } };
const quoteBlockHash = `0x${'a'.repeat(64)}`;
const quoteContext = async () => ({ gameCore: '0x5555555555555555555555555555555555555555', economyRouter: '0x6666666666666666666666666666666666666666', quoteBlock: 123, quoteBlockHash, quoteBlockTimestamp: 699, deadline: 999 });

test('seed quote reads onchain price/path and derives bounded minimum output from the exact 60 percent', async () => {
  const quote = await quoteSeedPurchase({ symbol: 'MSFT', packs: 2, slippageBps: 100, gameCore, router, adapterFor: () => adapter, quoter, quoteContext });
  assert.deepEqual(quote, { symbol: 'MSFT', ticker, chainId: 4663, gameCore: '0x5555555555555555555555555555555555555555', economyRouter: '0x6666666666666666666666666666666666666666', currency: '0x1111111111111111111111111111111111111111', quoteBlock: 123, quoteBlockHash, quoteBlockTimestamp: 699, deadline: 999, packs: 2, totalPrice: '200', rewardInput: '120', quotedStockOut: '240', minimumStockOut: '238' });
});

test('seed quote rejects HOOD, unconfigured values, invalid counts and excessive slippage', async () => {
  for (const input of [
    { symbol: 'HOOD', packs: 1, slippageBps: 100 },
    { symbol: 'MSFT', packs: 0, slippageBps: 100 },
    { symbol: 'MSFT', packs: 1, slippageBps: 501 },
  ]) await assert.rejects(quoteSeedPurchase({ ...input, gameCore, router, adapterFor: () => adapter, quoter, quoteContext }));
});

test('seed quote rejects promptly when its request signal is aborted', async () => {
  const controller = new AbortController();
  const pendingCore = { seedSkus: async () => new Promise(() => {}) };
  const pending = quoteSeedPurchase({ symbol: 'MSFT', packs: 1, slippageBps: 100, gameCore: pendingCore, router, adapterFor: () => adapter, quoter, quoteContext, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /QUOTE_ABORTED/);
});

test('seed quote rounds its minimum up so integer truncation cannot exceed requested slippage', async () => {
  const tinyQuoter = { quoteExactInput: { staticCall: async () => 2n } };
  const quote = await quoteSeedPurchase({ symbol: 'MSFT', packs: 1, slippageBps: 100, gameCore, router, adapterFor: () => adapter, quoter: tinyQuoter, quoteContext });
  assert.equal(quote.minimumStockOut, '2');
});

test('seed quote pins every onchain read to its advertised quote block', async () => {
  const seen = [];
  const wrap = value => async (...args) => { seen.push(args.at(-1)); return value; };
  await quoteSeedPurchase({ symbol: 'MSFT', packs: 1, slippageBps: 100,
    gameCore: { seedSkus: wrap([100n, 4n, '0x2222222222222222222222222222222222222222', true]) },
    router: { routes: wrap(['0x3333333333333333333333333333333333333333', '0x2222222222222222222222222222222222222222', '0x4444444444444444444444444444444444444444', true]), currency: wrap('0x1111111111111111111111111111111111111111') },
    adapterFor: () => ({ pathFor: wrap('0x123456') }), quoter: { quoteExactInput: { staticCall: wrap(60n) } }, quoteContext });
  assert.equal(seen.length, 5);
  assert.equal(seen.every(value => value?.blockTag === 123), true);
});
