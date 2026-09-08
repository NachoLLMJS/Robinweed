import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCircle } from '../src/collisionMath.js';
import {
  RESTAURANT_EXTERIOR_INTERACTION,
  RESTAURANT_INTERIOR_LAYOUT,
} from '../src/restaurantExperience.js';

test('restaurant entrance interaction spans the full exterior frontage', () => {
  const zone = RESTAURANT_EXTERIOR_INTERACTION;
  assert.equal(zone.id, 'restaurant-entrance');
  assert.ok(zone.size.x >= 13, 'the interaction zone must cover the full 13 m facade');
  assert.ok(zone.size.z >= 2, 'the prompt must be reachable before touching the model');
  assert.equal(zone.position.x, 32);
  assert.ok(zone.position.z < 39.15, 'interaction must sit in front of the restaurant collision shell');
  assert.ok(zone.position.x - zone.size.x / 2 <= 25.5);
  assert.ok(zone.position.x + zone.size.x / 2 >= 38.5);
});

test('restaurant exit door is directly behind the entry spawn and has an obvious approach', () => {
  const { exitDoor, spawn } = RESTAURANT_INTERIOR_LAYOUT;
  assert.equal(exitDoor.id, 'restaurant-exit');
  assert.equal(exitDoor.position.x, 0);
  assert.ok(exitDoor.position.z > spawn.z, 'turning around must face the exit');
  assert.ok(exitDoor.position.z - spawn.z <= 1.5, 'exit prompt must be immediately approachable');
  assert.ok(exitDoor.wallZ - spawn.z >= 2.5, 'visible door must be far enough away to fit in view');
  assert.ok(exitDoor.wallZ - spawn.z <= 3.2, 'visible door must remain clearly legible');
  assert.ok(exitDoor.size.x >= 2.4);
  assert.ok(exitDoor.size.y >= 2.7);
  assert.ok(exitDoor.label.includes('EXIT'));
});

test('restaurant interior has no furniture colliders restricting exploration', () => {
  const { obstacles, bounds } = RESTAURANT_INTERIOR_LAYOUT;
  assert.deepEqual(obstacles, []);

  const throughFormerCenterTable = moveCircle(
    { x: 0, z: -80 },
    { x: 0, z: -3 },
    obstacles,
    bounds,
    .28,
  );
  assert.deepEqual(throughFormerCenterTable, { x: 0, z: -83 });

  const throughFormerLeftBar = moveCircle(
    { x: -4, z: -67 },
    { x: -2, z: -4 },
    obstacles,
    bounds,
    .28,
  );
  assert.deepEqual(throughFormerLeftBar, { x: -6, z: -71 });
});
