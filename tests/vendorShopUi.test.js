import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('Vlad shop provides one GLB preview and eight selectable seed products', () => {
  assert.match(html, /id="vendorPackPreview"/);
  assert.match(html, /id="vendorSeedGrid"/);
  assert.match(html, /id="vendorSelectedTicker"/);
  assert.match(main, /VENDOR_SEED_PRODUCTS\.forEach/);
  assert.match(main, /function loadVendorPackPreview/);
  assert.match(main, /product\.assetUrl/);
  assert.match(main, /selectSlot\(product\.slot\)/);
});

test('unsupported HOOD purchases fail closed while live stock purchases and mature claims are wired', () => {
  assert.match(html, /id="buySelectedSeeds"[^>]*disabled/);
  assert.match(html, /BUY 4 SEEDS · 100 \$STOCKDEALER/);
  assert.match(html, /60% STOCK SWAP · 40% BURN/);
  assert.match(html, /id="claimHarvest"[^>]*disabled/);
  assert.match(main, /claimHarvestButton\.addEventListener\('click',claimAvailableHarvest\)/);
  assert.match(main, /function claimableOnchainCrop/);
  assert.match(main, /NO MATURE STOCKS TO CLAIM/);
  assert.match(main, /plantWarehouse/);
  assert.match(main, /waterWarehouse/);
  assert.match(main, /claimWarehouseHarvest/);
  assert.match(main, /NO \$\{ticker\} SEEDS · SELECT \$\{ownedTickers\.join/);
  assert.doesNotMatch(main, /WAREHOUSE TUTORIAL/);
  assert.doesNotMatch(html, /id="sellBuds"/);
  assert.doesNotMatch(main, /state\.cash\+=earned/);
});

test('runtime seed buying loads verified economy config and executes the durable purchase flow', () => {
  assert.match(main, /loadEconomyConfig/);
  assert.match(main, /executeSeedPurchase/);
  assert.match(main, /buySelectedSeeds/);
  assert.match(main, /HOOD.*STOCK TOKEN UNAVAILABLE|STOCK TOKEN UNAVAILABLE.*HOOD/s);
});

test('confirmed seed purchases expose explicit onchain progress and a receipt container', () => {
  assert.match(html, /id="onchainPurchaseConfirmation"/);
  assert.match(html, /id="onchainPurchaseTicker"/);
  assert.match(html, /id="onchainPurchaseSeeds"/);
  assert.match(html, /id="onchainPurchaseHash"/);
  assert.match(html, /id="onchainPurchaseBlock"/);
  assert.match(main, /VERIFYING PURCHASE ONCHAIN/);
  assert.match(main, /showOnchainPurchaseConfirmation/);
  assert.match(main, /result\.receipt/);
  assert.match(main, /showReconciledPurchase\(reconciliation\)/);
  assert.match(main, /seeds:result\.creditedSeeds/);
  assert.doesNotMatch(main, /seeds:purchaseProduct\.packSize/);
  assert.match(styles, /#onchainPurchaseConfirmation\{z-index:40\}/);
});

test('confirmed seed purchase is not mislabeled as unsent when authoritative state refresh fails', () => {
  assert.match(main, /let result;try\{[\s\S]*?try\{result=await executeSeedPurchase/);
  assert.match(main, /PURCHASE CONFIRMED · STATE SYNC PENDING/);
});
