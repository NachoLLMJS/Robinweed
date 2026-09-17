import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { wateringIsVisual } from '../src/cultivationMode.js';

test('V4 visual watering policy is explicit and fail-closed', () => {
  assert.equal(wateringIsVisual({ wateringMode: 'visual' }), true);
  assert.equal(wateringIsVisual({ wateringMode: 'onchain' }), false);
  assert.equal(wateringIsVisual({}), false);
  assert.equal(wateringIsVisual(null), false);
});

test('visual watering exits before cultivation transaction execution', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /if\(state\.slot===0&&wateringIsVisual\(economyConfig\)\)\{startVisualWatering\(pot\);return;\}/);
  assert.match(main, /GROWTH REMAINS ONCHAIN/);
  const startVisual = main.slice(main.indexOf('function startVisualWatering'), main.indexOf('async function useOnchainTool'));
  assert.doesNotMatch(startVisual, /Object\.assign|waterPlant|localStorage|executeCultivationAction/);
});
