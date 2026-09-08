import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIAL_PLAYER_SPAWN, portalFor, boundsForLocation, cityBuildingFor } from '../src/navigationState.js';
import { moveCircle } from '../src/collisionMath.js';

test('refresh starts near Vlad and the grow tables instead of the warehouse exit', () => {
  assert.deepEqual(INITIAL_PLAYER_SPAWN, {
    location: 'warehouse', x: 1.5, z: -3.9, yaw: -Math.PI / 2,
  });
  assert.ok(Math.hypot(INITIAL_PLAYER_SPAWN.x - 4.8, INITIAL_PLAYER_SPAWN.z + 4.7) < 3.5);
  assert.ok(Math.abs(INITIAL_PLAYER_SPAWN.z - 7.82) > 10);
});

test('warehouse exit requires confirmation and spawns outside the closed shell', () => {
  assert.deepEqual(portalFor('warehouse-exit'), {
    title: 'LEAVE THE WAREHOUSE?',
    message: 'Do you want to go outside?',
    confirm: 'YES, GO OUTSIDE',
    target: 'street',
    spawn: { x: 0, z: 9.55, yaw: Math.PI },
  });
});

test('commercial street building enters its separate interior instance', () => {
  assert.equal(portalFor('shop-entrance').target, 'shop-interior');
});

test('residential houses have no legacy portal that bypasses wallet ownership', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal(portalFor('house-entrance'), null);
  assert.doesNotMatch(main, /portalHit\([^;]*'house-entrance'\)/s);
});

test('interior exits return to their matching street entrances', () => {
  assert.deepEqual(portalFor('shop-exit').spawn, { x: -5.95, z: 13.2, yaw: -Math.PI / 2 });
  assert.deepEqual(portalFor('house-exit').spawn, { x: 5.5, z: 11.75, yaw: Math.PI / 2 });
});

test('restaurant uses a dedicated interior instance and returns to its right-branch entrance', () => {
  const enter = portalFor('restaurant-entrance');
  assert.equal(enter.target, 'restaurant-interior');
  assert.deepEqual(enter.spawn, { x: 0, z: -63, yaw: 0 });
  const exit = portalFor('restaurant-exit');
  assert.equal(exit.target, 'street');
  assert.deepEqual(exit.spawn, { x: 27.2, z: 38.65, yaw: Math.PI });
  assert.deepEqual(boundsForLocation('restaurant-interior'), { minX: -11.5, maxX: 11.5, minZ: -98.5, maxZ: -61.5 });
});

test('street portal exits spawn inside bounds after accounting for player radius', () => {
  const playerRadius = 0.28;
  const bounds = boundsForLocation('street');
  for (const id of ['shop-exit', 'house-exit', 'restaurant-exit']) {
    const { spawn } = portalFor(id);
    assert.ok(spawn.x >= bounds.minX + playerRadius, `${id} spawns left of the playable center bound`);
    assert.ok(spawn.x <= bounds.maxX - playerRadius, `${id} spawns right of the playable center bound`);
    assert.ok(spawn.z >= bounds.minZ + playerRadius, `${id} spawns before the playable center bound`);
    assert.ok(spawn.z <= bounds.maxZ - playerRadius, `${id} spawns after the playable center bound`);
  }
});

test('each location has finite movement bounds and unknown portals are rejected', () => {
  for (const location of ['warehouse', 'street', 'shop-interior', 'house-interior', 'restaurant-interior']) {
    const bounds = boundsForLocation(location);
    assert.ok(bounds.minX < bounds.maxX);
    assert.ok(bounds.minZ < bounds.maxZ);
  }
  assert.equal(portalFor('missing'), null);
});

test('street extension reaches the neighborhood beyond the intersection', () => {
  const street = boundsForLocation('street');
  assert.equal(street.minX, -54);
  assert.equal(street.maxX, 54);
  assert.equal(street.maxZ, 108.4);
  assert.equal(street.minZ, 8.65);
});

test('street buildings sit on the curb and have full-footprint collision', () => {
  const shop = cityBuildingFor('shop');
  const house = cityBuildingFor('house');
  assert.equal(shop.positionZ, 14.7);
  assert.equal(shop.portalZ, 13.2);
  assert.ok(shop.positionY <= 0);
  assert.ok(house.positionY < 0);
  assert.ok(Math.abs(house.positionX - 8.987) < 0.001);
  assert.equal(house.positionZ, 11.75);
  assert.equal(house.obstacle.minX, 6);
  assert.equal(house.obstacle.maxX, 11.975);
  assert.deepEqual(house.obstacle, { minX: 6, maxX: 11.975, minZ: 8.66, maxZ: 14.84 });
  const playerRadius = 0.28;
  const portalReach = 1.1;
  const nearestShopX = shop.obstacle.maxX + playerRadius;
  assert.ok(Math.abs(shop.portalX - nearestShopX) < portalReach);
  for (const building of [shop, house]) {
    assert.ok(building.obstacle.maxX - building.obstacle.minX > 3.5);
    assert.ok(building.obstacle.maxZ - building.obstacle.minZ > 4.5);
  }
});

test('player movement remains outside both exterior building shells', () => {
  const bounds = boundsForLocation('street');
  const obstacles = [cityBuildingFor('shop').obstacle, cityBuildingFor('house').obstacle];
  const shopAttempt = moveCircle({ x: -5.9, z: 14.7 }, { x: -0.5, z: 0 }, obstacles, bounds, 0.28);
  const houseAttempt = moveCircle({ x: 5.5, z: 11.75 }, { x: 0.5, z: 0 }, obstacles, bounds, 0.28);
  assert.deepEqual(shopAttempt, { x: -5.9, z: 14.7 });
  assert.deepEqual(houseAttempt, { x: 5.5, z: 11.75 });
  assert.ok(shopAttempt.x >= cityBuildingFor('shop').obstacle.maxX + 0.28);
  assert.ok(houseAttempt.x <= cityBuildingFor('house').obstacle.minX - 0.28);
});
