import test from 'node:test';
import assert from 'node:assert/strict';
import { vendorYawTowardPlayer } from '../src/vendorOrientationState.js';

test('Vlad faces a player standing in front of the north-wall counter', () => {
  assert.equal(vendorYawTowardPlayer({ x: 4.8, z: -4.7 }, { x: 4.8, z: -2.2 }), Math.PI / 2);
});

test('Vlad follows the player horizontally instead of staring at the wall', () => {
  assert.equal(vendorYawTowardPlayer({ x: 4.8, z: -4.7 }, { x: 2.3, z: -4.7 }), 0);
  assert.equal(vendorYawTowardPlayer({ x: 4.8, z: -4.7 }, { x: 6.8, z: -4.7 }), Math.PI);
});
