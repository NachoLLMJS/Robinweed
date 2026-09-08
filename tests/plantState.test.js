import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, plantSeed, waterPlant, advancePlant, harvestPlant, GROWTH_STEP_MS } from '../src/plantState.js';

test('plant progresses through six visible stages', () => {
  assert.deepEqual([0,1,2,4,7,10].map(stageFor), [0,1,2,3,4,5]);
});

test('seed, one watering, timed growth, and harvest loop conserves inventory', () => {
  const now = 1_000;
  const planted = plantSeed({growth:0,water:0}, 2, 'HOOD', now);
  assert.equal(planted.seeds, 1);
  const watered = waterPlant(planted.pot, now);
  const mature = advancePlant(watered, now + 4 * GROWTH_STEP_MS);
  const result = harvestPlant(mature, now + 4 * GROWTH_STEP_MS);
  assert.equal(result.changed, true);
  assert.equal(result.pot.growth, 0);
  assert.ok(result.buds >= 2);
});

test('cannot harvest before final stage', () => {
  assert.equal(harvestPlant({growth:7,water:80}).changed, false);
});
