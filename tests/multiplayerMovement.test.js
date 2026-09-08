import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceOutsidePlayer, outsideSpawnForSlot, OUTSIDE_SPAWN } from '../server/multiplayerMovement.js';
import { movementVector } from '../src/movementMath.js';

const idle = { ...OUTSIDE_SPAWN, yaw: Math.PI, buttons: [] };

test('outside server spawn is inside canonical street bounds', () => {
  assert.deepEqual(OUTSIDE_SPAWN, { x: 0, z: 9.55 });
  assert.deepEqual(advanceOutsidePlayer(idle, 0.05), { ...idle });
});

test('simultaneous outside players spawn visibly separated instead of overlapping', () => {
  const spawns = Array.from({ length: 5 }, (_, index) => outsideSpawnForSlot(index));
  assert.equal(new Set(spawns.map(spawn => `${spawn.x}:${spawn.z}`)).size, spawns.length);
  for (let index = 1; index < spawns.length; index += 1) {
    assert.ok(Math.hypot(spawns[index].x - spawns[0].x, spawns[index].z - spawns[0].z) > 0.56);
    assert.deepEqual(advanceOutsidePlayer({ ...spawns[index], yaw: Math.PI, buttons: [] }, 0.05), { ...spawns[index], yaw: Math.PI, buttons: [] });
  }
});

test('server movement uses the same camera-relative axes as local prediction at every heading', () => {
  const origin = { x: 20, z: 50 };
  for (const yaw of [-Math.PI, -Math.PI / 2, -0.7, 0, 0.8, Math.PI / 2, Math.PI]) {
    for (const [key, button] of [['KeyW', 'forward'], ['KeyS', 'backward'], ['KeyA', 'left'], ['KeyD', 'right']]) {
      const local = movementVector(yaw, code => code === key);
      const moved = advanceOutsidePlayer({ ...origin, yaw, buttons: [button] }, 0.05);
      const authoritative = { x: moved.x - origin.x, z: moved.z - origin.z };
      assert.ok(local.x * authoritative.x + local.z * authoritative.z > 0, `${key} diverged at yaw ${yaw}`);
    }
  }
});

test('outside server movement clamps bounds and rejects movement through buildings', () => {
  const edge = advanceOutsidePlayer({ x: 53.7, z: 20, yaw: Math.PI / 2, buttons: ['forward', 'run'] }, 0.1);
  assert.ok(edge.x <= 53.72);
  const insideApproach = { x: -6.0, z: 13.2, yaw: Math.PI / 2, buttons: ['forward'] };
  const moved = advanceOutsidePlayer(insideApproach, 0.1);
  assert.equal(moved.x, insideApproach.x);
});
