import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('Vlad shop provides one GLB preview and eight selectable seed products', () => {
  assert.match(html, /id="vendorPackPreview"/);
  assert.match(html, /id="vendorSeedGrid"/);
  assert.match(html, /id="vendorSelectedTicker"/);
  assert.match(main, /VENDOR_SEED_PRODUCTS\.forEach/);
  assert.match(main, /function loadVendorPackPreview/);
  assert.match(main, /product\.assetUrl/);
  assert.match(main, /selectSlot\(product\.slot\)/);
});

test('unlaunched token purchases and tokenized-stock claims fail closed', () => {
  assert.match(html, /id="buySelectedSeeds"[^>]*disabled/);
  assert.match(html, /BUY 4 SEEDS · 100 \$STOCKDEALER/);
  assert.match(html, /60% STOCK SWAP · 40% BURN/);
  assert.match(html, /id="claimHarvest"[^>]*disabled/);
  assert.doesNotMatch(html, /id="sellBuds"/);
  assert.doesNotMatch(main, /state\.cash\+=earned/);
});

test('runtime seed buying loads verified economy config and executes the durable purchase flow', () => {
  assert.match(main, /loadEconomyConfig/);
  assert.match(main, /executeSeedPurchase/);
  assert.match(main, /buySelectedSeeds/);
  assert.match(main, /HOOD.*STOCK TOKEN UNAVAILABLE|STOCK TOKEN UNAVAILABLE.*HOOD/s);
});

test('confirmed seed purchase is not mislabeled as unsent when authoritative state refresh fails', () => {
  assert.match(main, /let result;try\{[\s\S]*?try\{result=await executeSeedPurchase/);
  assert.match(main, /PURCHASE CONFIRMED · STATE SYNC PENDING/);
});
