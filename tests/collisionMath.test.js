import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCircle } from '../src/collisionMath.js';

const bench = { minX: -3.4, maxX: 3.4, minZ: -3.325, maxZ: -1.075 };
const bounds = { minX: -6.3, maxX: 6.3, minZ: -7.2, maxZ: 7.3 };

test('player cannot cross the grow bench', () => {
  const result = moveCircle({ x: 0, z: -0.6 }, { x: 0, z: -1 }, [bench], bounds, 0.28);
  assert.ok(result.z >= bench.maxZ + 0.28, `crossed bench at z=${result.z}`);
});

test('collision is axis-separated so the player slides along furniture', () => {
  const result = moveCircle({ x: 3.8, z: -0.6 }, { x: -0.6, z: -0.8 }, [bench], bounds, 0.28);
  assert.ok(result.x < 3.8, 'expected horizontal slide');
  assert.ok(result.z >= bench.maxZ + 0.28, 'expected blocked forward axis');
});

test('room bounds include player radius', () => {
  const result = moveCircle({ x: 6.1, z: 0 }, { x: 2, z: 0 }, [], bounds, 0.28);
  assert.equal(result.x, 6.02);
});
