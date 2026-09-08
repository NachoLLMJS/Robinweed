import test from 'node:test';
import assert from 'node:assert/strict';
import { fitScaleForWorldBox } from '../src/assetFit.js';

test('fit scale accounts for a quarter-turn swapping model width and depth', () => {
  const scale = fitScaleForWorldBox(
    { x: 1, y: .65, z: .55 },
    { maxWidthX: 5.5, maxDepthZ: 6.3, maxHeight: 5.2 },
    -Math.PI / 2,
  );
  assert.equal(scale, 6.3);
});

test('fit scale chooses the tightest width, depth, or height constraint', () => {
  const scale = fitScaleForWorldBox(
    { x: .7, y: 1, z: .8 },
    { maxWidthX: 5.2, maxDepthZ: 4.55, maxHeight: 7.1 },
    -Math.PI / 2,
  );
  assert.equal(scale, 6.5);
});
