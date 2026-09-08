import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateActivationConfig } from '../scripts/lib/activationConfig.js';

const example = JSON.parse(readFileSync(new URL('../config/mainnet-activation.example.json', import.meta.url)));

test('incomplete checked-in activation example fails closed', () => {
  assert.throws(() => validateActivationConfig(example));
});

test('activation config requires exact seven-stock basket, paths, prices and 35 stable houses', () => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA'];
  const complete = {
    ...example,
    tokenAddress: '0x1111111111111111111111111111111111111111',
    expectedTokenCodeHash: `0x${'a'.repeat(64)}`,
    burnProbeHolder: '0x3333333333333333333333333333333333333333',
    seedPackPriceTokens: '100',
    houseBasket: symbols.map((symbol, index) => ({ symbol, weightBps: index === 6 ? 1432 : 1428 })),
    paths: Object.fromEntries(symbols.map(symbol => [symbol, '0x' + '11'.repeat(20) + '000bb8' + '22'.repeat(20)])),
    houses: example.houses.map(house => ({ ...house, priceTokens: '1000' })),
    activateAfterValidation: true,
  };
  const result = validateActivationConfig(complete);
  assert.equal(result.houses.length, 35);
  assert.equal(result.houseBasket.reduce((sum, item) => sum + item.weightBps, 0), 10_000);
  assert.throws(() => validateActivationConfig({ ...complete, chainId: 46630 }));
  assert.throws(() => validateActivationConfig({ ...complete, houses: complete.houses.slice(1) }));
  assert.throws(() => validateActivationConfig({ ...complete, expectedTokenCodeHash: null }));
  assert.throws(() => validateActivationConfig({ ...complete, burnProbeHolder: null }));
});
