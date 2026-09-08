import test from 'node:test';
import assert from 'node:assert/strict';
import { VENDOR_SEED_PRODUCTS } from '../src/vendorSeedShopState.js';

test('Vlad shop exposes exactly the eight playable seed packages using production GLBs', () => {
  assert.deepEqual(VENDOR_SEED_PRODUCTS.map(({ ticker, slot }) => [ticker, slot]), [
    ['HOOD', 2], ['MSFT', 3], ['TSLA', 4], ['NVDA', 5],
    ['MSTR', 6], ['AAPL', 7], ['QQQ', 8], ['GOOGL', 9],
  ]);
  assert.equal(VENDOR_SEED_PRODUCTS[0].assetUrl, '/models-v7/items/robinhood-seed-pack-clean.glb');
  assert.equal(VENDOR_SEED_PRODUCTS.find(item => item.ticker === 'QQQ').assetUrl, '/models-v29/items/stock-seed-packs/qqq-seed-pack.glb?v=5');
  assert.ok(VENDOR_SEED_PRODUCTS.every(item => item.assetUrl.endsWith('.glb') || item.assetUrl.includes('.glb?')));
  assert.ok(VENDOR_SEED_PRODUCTS.every(item => item.packSize === 4));
  assert.ok(VENDOR_SEED_PRODUCTS.every(item => item.tokenPrice === 100));
});
