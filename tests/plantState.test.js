import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, plantSeed, waterPlant, harvestPlant } from '../src/plantState.js';

test('plant progresses through six visible stages', () => {
  assert.deepEqual([0,1,2,4,7,10].map(stageFor), [0,1,2,3,4,5]);
});

test('seed, water, and harvest loop conserves inventory', () => {
  const planted = plantSeed({growth:0,water:0}, 2);
  assert.equal(planted.seeds, 1);
  let pot = planted.pot;
  for (let i=0; i<12; i++) { pot = {...pot, water:0}; pot = waterPlant(pot); }
  const result = harvestPlant(pot);
  assert.equal(result.changed, true);
  assert.equal(result.pot.growth, 0);
  assert.ok(result.buds >= 2);
});

test('cannot harvest before final stage', () => {
  assert.equal(harvestPlant({growth:7,water:80}).changed, false);
});
