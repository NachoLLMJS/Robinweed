import test from 'node:test';
import assert from 'node:assert/strict';
import { movementAxes, movementVector } from '../src/movementMath.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('forward movement follows the camera at quarter turns', () => {
  let axes = movementAxes(0);
  close(axes.forward.x, 0); close(axes.forward.z, -1);
  axes = movementAxes(-Math.PI / 2);
  close(axes.forward.x, 1); close(axes.forward.z, 0);
  axes = movementAxes(Math.PI / 2);
  close(axes.forward.x, -1); close(axes.forward.z, 0);
});

test('right strafe remains camera-right at quarter turns', () => {
  let axes = movementAxes(0);
  close(axes.right.x, 1); close(axes.right.z, 0);
  axes = movementAxes(-Math.PI / 2);
  close(axes.right.x, 0); close(axes.right.z, 1);
});

test('diagonal movement is normalized and opposite keys cancel', () => {
  const diagonal = movementVector(0, code => code === 'KeyW' || code === 'KeyD');
  close(Math.hypot(diagonal.x, diagonal.z), 1);
  const cancelled = movementVector(0, code => code === 'KeyW' || code === 'KeyS');
  assert.deepEqual(cancelled, { x: 0, z: 0 });
});
