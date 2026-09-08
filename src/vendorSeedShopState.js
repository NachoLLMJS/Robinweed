import { ASSET_URLS } from './assetManifest.js';
import { SEED_VARIETIES } from './seedVarietyState.js';

export const VENDOR_SEED_PRODUCTS = Object.freeze(SEED_VARIETIES.map(variety => Object.freeze({
  ticker: variety.ticker,
  slot: variety.slot,
  color: variety.color,
  assetUrl: variety.ticker === 'HOOD'
    ? ASSET_URLS.items.seedPack
    : ASSET_URLS.items.stockSeedPacks[variety.ticker],
  packSize: 4,
  tokenPrice: 100,
})));

export function vendorProduct(ticker) {
  return VENDOR_SEED_PRODUCTS.find(product => product.ticker === ticker) || null;
}
