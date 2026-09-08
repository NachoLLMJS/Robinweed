import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceOutsidePlayer, OUTSIDE_SPAWN } from '../server/multiplayerMovement.js';

const idle = { ...OUTSIDE_SPAWN, yaw: Math.PI, buttons: [] };

test('outside server spawn is inside canonical street bounds', () => {
  assert.deepEqual(OUTSIDE_SPAWN, { x: 0, z: 9.55 });
  assert.deepEqual(advanceOutsidePlayer(idle, 0.05), { ...idle });
});

test('outside server movement clamps bounds and rejects movement through buildings', () => {
  const edge = advanceOutsidePlayer({ x: 53.7, z: 20, yaw: Math.PI / 2, buttons: ['forward', 'run'] }, 0.1);
  assert.ok(edge.x <= 53.72);
  const insideApproach = { x: -6.0, z: 13.2, yaw: -Math.PI / 2, buttons: ['forward'] };
  const moved = advanceOutsidePlayer(insideApproach, 0.1);
  assert.equal(moved.x, insideApproach.x);
});
