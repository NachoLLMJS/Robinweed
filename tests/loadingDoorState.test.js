import test from 'node:test';
import assert from 'node:assert/strict';
import { loadingDoorTarget, advanceLoadingDoor } from '../src/loadingDoorState.js';

test('warehouse loading door opens only when the player approaches it', () => {
  const door = { x: 0, z: 7.82 };
  assert.equal(loadingDoorTarget('warehouse', { x: 0, z: 6 }, door), 1);
  assert.equal(loadingDoorTarget('street', { x: 0, z: 8.65 }, door), 1);
  assert.equal(loadingDoorTarget('warehouse', { x: 0, z: 3 }, door), 0);
  assert.equal(loadingDoorTarget('house-interior', { x: 0, z: 7.82 }, door), 0);
});

test('warehouse loading door moves smoothly and never exceeds its travel', () => {
  assert.equal(advanceLoadingDoor(0, 1, 0.1), 0.24);
  assert.equal(advanceLoadingDoor(0.9, 1, 1), 1);
  assert.equal(advanceLoadingDoor(0.1, 0, 1), 0);
});
