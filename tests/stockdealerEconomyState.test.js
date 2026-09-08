import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RENTAL_TIERS,
  rentalQuote,
  splitStockdealerSpend,
  routeStockdealerSpend,
  claimAssetForHarvest,
  TOKENIZED_STOCK_CONTRACTS,
  HOUSE_LISTINGS,
  createPreviewRental,
  rentalIsActive,
} from '../src/stockdealerEconomyState.js';

test('house tiers preserve supplied capacities and week/month prices without inventing the large price', () => {
  assert.deepEqual(RENTAL_TIERS, [
    { id: 'small', label: 'SMALL GROW HOUSE', capacity: 4, weeklyPrice: 1000 },
    { id: 'medium', label: 'MEDIUM GROW HOUSE', capacity: 8, weeklyPrice: 2000 },
    { id: 'large', label: 'LARGE GROW HOUSE', capacity: 15, weeklyPrice: null },
  ]);
  assert.deepEqual(rentalQuote('small', 'week'), { tokenCost: 1000, durationDays: 7, capacity: 4 });
  assert.deepEqual(rentalQuote('small', 'month'), { tokenCost: 4000, durationDays: 28, capacity: 4 });
  assert.deepEqual(rentalQuote('medium', 'month'), { tokenCost: 8000, durationDays: 28, capacity: 8 });
  assert.equal(rentalQuote('large', 'week').tokenCost, null);
});

test('every STOCKDEALER spend splits 60 percent to rewards and 40 percent to burn', () => {
  assert.deepEqual(splitStockdealerSpend(1000), { rewardPool: 600, burned: 400 });
  assert.deepEqual(splitStockdealerSpend(250), { rewardPool: 150, burned: 100 });
});

test('the reward share is swapped into tokenized stocks before ticker-matched harvest claims', () => {
  assert.deepEqual(routeStockdealerSpend(1000, 'NVDA'), {
    stockdealerIn: 1000,
    burned: 400,
    rewardSwap: { allocation: 'TICKER', ticker: 'NVDA', stockdealerIn: 600, tokenizedStockOut: null },
  });
  assert.equal(routeStockdealerSpend(1000, null).rewardSwap.allocation, 'CROP_LIABILITY_BASKET');
  assert.deepEqual(claimAssetForHarvest('NVDA'), {
    ticker: 'NVDA',
    contract: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',
    claimReady: true,
  });
  assert.deepEqual(claimAssetForHarvest('HOOD'), { ticker: 'HOOD', contract: null, claimReady: false });
});

test('current neighborhood listings are extensible and preview access expires exactly with the rental', () => {
  assert.deepEqual(HOUSE_LISTINGS.map(({ id, tierId }) => [id, tierId]), [
    ['RW-042-E', 'small'], ['RW-050-E', 'medium'], ['RW-102-W', 'large'],
  ]);
  const start = 2_000;
  const rental = createPreviewRental('RW-042-E', 'week', start);
  assert.equal(rental.mode, 'FRONTEND_PREVIEW');
  assert.equal(rental.capacity, 4);
  assert.equal(rental.tokenCost, 1000);
  assert.equal(rental.owner, null);
  assert.equal(rental.expiresAt, start + 7 * 24 * 60 * 60 * 1000);
  assert.equal(rentalIsActive(rental, rental.expiresAt - 1), true);
  assert.equal(rentalIsActive(rental, rental.expiresAt), false);
  assert.equal(createPreviewRental('RW-102-W', 'week', start), null);
});

test('only used stock rewards are registered and missing HOOD remains TBA', () => {
  assert.deepEqual(TOKENIZED_STOCK_CONTRACTS, {
    HOOD: null,
    MSFT: '0xe93237c50d904957cf27e7b1133b510c669c2e74',
    TSLA: '0x322f0929c4625ed5bad873c95208d54e1c003b2d',
    NVDA: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',
    MSTR: '0xec262a75e413fafd0df80480274532c79d42da09',
    AAPL: '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9',
    QQQ: '0xd5f3879160bc7c32ebb4dc785f8a4f505888de68',
    GOOGL: '0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3',
  });
});
