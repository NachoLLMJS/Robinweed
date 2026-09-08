import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROWTH_STEP_MS,
  plantSeed,
  waterPlant,
  advancePlant,
  harvestPlant,
} from '../src/plantState.js';

const HOUR = 60 * 60 * 1000;

test('one watering starts automatic two-hour growth steps through maturity', () => {
  assert.equal(GROWTH_STEP_MS, 2 * HOUR);
  const planted = plantSeed({ growth: 0, water: 0, seedTicker: null }, 1, 'QQQ', 1_000).pot;
  assert.equal(planted.wateredAt, null);
  assert.equal(advancePlant(planted, 6 * HOUR).growth, 1);

  const watered = waterPlant(planted, 1_000 + HOUR);
  assert.equal(watered.wateredAt, 1_000 + HOUR);
  assert.equal(watered.water, 100);
  assert.deepEqual(waterPlant(watered, 1_000 + 2 * HOUR), watered);

  assert.equal(advancePlant(watered, watered.wateredAt + 2 * HOUR).growth, 2);
  assert.equal(advancePlant(watered, watered.wateredAt + 4 * HOUR).growth, 4);
  assert.equal(advancePlant(watered, watered.wateredAt + 6 * HOUR).growth, 7);
  assert.equal(advancePlant(watered, watered.wateredAt + 8 * HOUR).growth, 10);
});

test('harvest uses clock-derived maturity and preserves reward ticker', () => {
  const planted = plantSeed({ growth: 0, water: 0 }, 1, 'NVDA', 10).pot;
  const watered = waterPlant(planted, 20);
  assert.equal(harvestPlant(watered, 20 + 7 * HOUR).changed, false);
  const harvested = harvestPlant(watered, 20 + 8 * HOUR);
  assert.equal(harvested.changed, true);
  assert.equal(harvested.ticker, 'NVDA');
  assert.equal(harvested.pot.growth, 0);
  assert.equal(harvested.pot.wateredAt, null);
});
