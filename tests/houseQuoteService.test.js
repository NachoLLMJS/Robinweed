import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBytes32String } from 'ethers';
import { quoteHousePurchase } from '../server/quoteService.js';

const aapl = encodeBytes32String('AAPL');
const msft = encodeBytes32String('MSFT');
const gameCore = {
  houses: async id => [id === 2 ? 100n : 0n, 8n, id === 2],
  houseOwner: async () => '0x0000000000000000000000000000000000000000',
  houseBasket: async () => [[aapl, msft], [5_000n, 5_000n]],
};
const router = {
  currency: async () => '0x1111111111111111111111111111111111111111',
  routes: async ticker => [ticker === aapl ? '0x2222222222222222222222222222222222222222' : '0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444', '0x5555555555555555555555555555555555555555', true],
};
const adapter = { pathFor: async () => '0x123456' };
const quoter = { quoteExactInput: { staticCall: async (_path, amount) => [amount * 2n, [], [], 0n] } };
const quoteBlockHash = `0x${'b'.repeat(64)}`;
const quoteContext = async () => ({ gameCore: '0x6666666666666666666666666666666666666666', economyRouter: '0x7777777777777777777777777777777777777777', quoteBlock: 456, quoteBlockHash, quoteBlockTimestamp: 700, deadline: 1000 });

test('house quote derives each basket minimum from exact 60 percent allocations', async () => {
  const quote = await quoteHousePurchase({ houseId: 2, slippageBps: 100, gameCore, router, adapterFor: () => adapter, quoter, quoteContext });
  assert.deepEqual(quote, { houseId: 2, chainId: 4663, gameCore: '0x6666666666666666666666666666666666666666', economyRouter: '0x7777777777777777777777777777777777777777', currency: '0x1111111111111111111111111111111111111111', quoteBlock: 456, quoteBlockHash, quoteBlockTimestamp: 700, deadline: 1000, capacity: 8, totalPrice: '100', tickers: [aapl, msft], quotedStockOuts: ['60', '60'], minimumOuts: ['60', '60'] });
});

test('house quote rejects sold, unavailable, invalid or unquotable houses', async () => {
  await assert.rejects(quoteHousePurchase({ houseId: 0, slippageBps: 100, gameCore, router, adapterFor: () => adapter, quoter, quoteContext }));
  await assert.rejects(quoteHousePurchase({ houseId: 3, slippageBps: 100, gameCore, router, adapterFor: () => adapter, quoter, quoteContext }));
  await assert.rejects(quoteHousePurchase({ houseId: 2, slippageBps: 501, gameCore, router, adapterFor: () => adapter, quoter, quoteContext }));
});
