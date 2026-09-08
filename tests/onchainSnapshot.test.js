import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOnchainSnapshot } from '../src/onchainSnapshot.js';

const address = '0x1111111111111111111111111111111111111111';
const symbols = ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA'];
const base = {
  chainId: 4663,
  address,
  blockNumber: 123,
  blockHash: `0x${'a'.repeat(64)}`,
  properties: [{ houseId: 1, price: '1000', capacity: 4, configured: true, owner: address }],
  crops: [{ houseId: 1, plotId: 0, ticker: 'MSFT', plantedAt: 1, wateredAt: 2, stage: 3 }],
  seeds: Object.fromEntries(symbols.map(symbol => [symbol, { remaining: '1', unassignedRawCredit: '15' }])),
};

test('onchain snapshot validates bounded state and preserves uint256 seed totals', () => {
  const result = validateOnchainSnapshot(base, address);
  assert.equal(result.totalSeeds, '7');
  const huge = { ...base, seeds: { ...base.seeds, MSFT: { remaining: '900719925474099300000', unassignedRawCredit: '1' } } };
  assert.equal(validateOnchainSnapshot(huge, address).totalSeeds, '900719925474099300006');
});

test('onchain snapshot rejects wrong identity, malformed owners, duplicate houses and invalid crops', () => {
  for (const value of [
    { ...base, address: '0x2222222222222222222222222222222222222222' },
    { ...base, blockHash: 'bad' },
    { ...base, properties: [{ ...base.properties[0], owner: 'bad' }] },
    { ...base, properties: [base.properties[0], base.properties[0]] },
    { ...base, crops: [{ ...base.crops[0], ticker: 'HOOD' }] },
    { ...base, crops: [{ ...base.crops[0], stage: 9 }] },
  ]) assert.throws(() => validateOnchainSnapshot(value, address));
});

test('onchain crops must belong to a property owned by the snapshot wallet and fit its capacity', () => {
  assert.throws(() => validateOnchainSnapshot({ ...base, crops: [{ ...base.crops[0], houseId: 2 }] }, address), /INVALID_CROP_STATE/);
  assert.throws(() => validateOnchainSnapshot({ ...base, properties: [{ ...base.properties[0], owner: '0x2222222222222222222222222222222222222222' }] }, address), /INVALID_CROP_STATE/);
  assert.throws(() => validateOnchainSnapshot({ ...base, crops: [{ ...base.crops[0], plotId: 4 }] }, address), /INVALID_CROP_STATE/);
});
