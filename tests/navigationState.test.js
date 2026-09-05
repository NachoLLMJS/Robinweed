import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFor, boundsForLocation, cityBuildingFor } from '../src/navigationState.js';
import { moveCircle } from '../src/collisionMath.js';

test('warehouse exit requires confirmation and spawns outside the closed shell', () => {
  assert.deepEqual(portalFor('warehouse-exit'), {
    title: 'LEAVE THE WAREHOUSE?',
    message: 'Do you want to go outside?',
    confirm: 'YES, GO OUTSIDE',
    target: 'street',
    spawn: { x: 0, z: 9.55, yaw: Math.PI },
  });
});

test('street buildings enter separate interior instances', () => {
  assert.equal(portalFor('shop-entrance').target, 'shop-interior');
  assert.equal(portalFor('house-entrance').target, 'house-interior');
  assert.notDeepEqual(portalFor('shop-entrance').spawn, portalFor('house-entrance').spawn);
});

test('interior exits return to their matching street entrances', () => {
  assert.deepEqual(portalFor('shop-exit').spawn, { x: -6.05, z: 14.7, yaw: -Math.PI / 2 });
  assert.deepEqual(portalFor('house-exit').spawn, { x: 5.5, z: 11.75, yaw: Math.PI / 2 });
});

test('each location has finite movement bounds and unknown portals are rejected', () => {
  for (const location of ['warehouse', 'street', 'shop-interior', 'house-interior']) {
    const bounds = boundsForLocation(location);
    assert.ok(bounds.minX < bounds.maxX);
    assert.ok(bounds.minZ < bounds.maxZ);
  }
  assert.equal(portalFor('missing'), null);
});

test('street extension reaches the new intersection and simple houses', () => {
  const street = boundsForLocation('street');
  assert.equal(street.maxZ, 42.4);
  assert.equal(street.minZ, 8.65);
});

test('street buildings sit on the curb and have full-footprint collision', () => {
  const shop = cityBuildingFor('shop');
  const house = cityBuildingFor('house');
  assert.ok(shop.positionY <= 0);
  assert.ok(house.positionY < 0);
  assert.ok(Math.abs(house.positionX - 8.987) < 0.001);
  assert.equal(house.positionZ, 11.75);
  assert.equal(house.obstacle.minX, 6);
  assert.equal(house.obstacle.maxX, 11.975);
  assert.deepEqual(house.obstacle, { minX: 6, maxX: 11.975, minZ: 8.66, maxZ: 14.84 });
  const street = boundsForLocation('street');
  const playerRadius = 0.28;
  const portalReach = 1.1;
  const nearestShopX = street.minX + playerRadius;
  assert.ok(shop.obstacle.maxX + playerRadius < nearestShopX);
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
  assert.deepEqual(shopAttempt, { x: bounds.minX + 0.28, z: 14.7 });
  assert.deepEqual(houseAttempt, { x: 5.5, z: 11.75 });
  assert.ok(shopAttempt.x >= cityBuildingFor('shop').obstacle.maxX + 0.28);
  assert.ok(houseAttempt.x <= cityBuildingFor('house').obstacle.minX - 0.28);
});
