import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_PROPERTIES,
  propertyNear,
  purchasePreview,
  propertyAccess,
  streetSpawnForProperty,
} from '../src/housePropertyState.js';

const WALLET_A = '0x1111111111111111111111111111111111111111';
const WALLET_B = '0x2222222222222222222222222222222222222222';

test('every neighborhood building except KFC, Nike and restaurant is a purchasable property', () => {
  assert.equal(HOUSE_PROPERTIES.length, 35);
  assert.ok(HOUSE_PROPERTIES.some(property => property.id === 'START-WEST'));
  assert.ok(HOUSE_PROPERTIES.some(property => property.id === 'START-EAST'));
  assert.ok(HOUSE_PROPERTIES.every(property => !['cityPackKfc', 'cityPackDiner', 'restaurant'].includes(property.asset)));
  assert.equal(new Set(HOUSE_PROPERTIES.map(property => property.id)).size, HOUSE_PROPERTIES.length);
  assert.ok(HOUSE_PROPERTIES.every(property => [4, 8, 15].includes(property.capacity)));
});

test('nearest property interaction resolves only while the player is close to a house', () => {
  const house = HOUSE_PROPERTIES.find(property => property.id === 'START-EAST');
  assert.equal(propertyNear({ x: house.x, z: house.z })?.id, house.id);
  assert.equal(propertyNear({ x: 0, z: 34 }), null);
});

test('preview purchase binds a free house to the connected wallet and cannot overwrite ownership', () => {
  const house = HOUSE_PROPERTIES[0];
  const purchased = purchasePreview(house, WALLET_A);
  assert.equal(purchased.owner, WALLET_A);
  assert.equal(purchased.mode, 'FRONTEND_PREVIEW');
  assert.equal(purchasePreview(purchased, WALLET_B), null);
});

test('property access distinguishes unowned, owned by me, and owned by another wallet', () => {
  const house = HOUSE_PROPERTIES[0];
  assert.equal(propertyAccess(house, WALLET_A), 'AVAILABLE');
  const owned = purchasePreview(house, WALLET_A);
  assert.equal(propertyAccess(owned, WALLET_A.toUpperCase()), 'OWNER');
  assert.equal(propertyAccess(owned, WALLET_B), 'OCCUPIED');
  assert.equal(propertyAccess(owned, null), 'OCCUPIED');
});

test('leaving an interior returns beside that exact house on its nearest public street', () => {
  assert.deepEqual(streetSpawnForProperty({ x: 9, z: 70 }), { x: 5.4, z: 70, yaw: Math.PI / 2 });
  assert.deepEqual(streetSpawnForProperty({ x: -46, z: 42.4 }), { x: -46, z: 38.5, yaw: Math.PI });
  assert.deepEqual(streetSpawnForProperty({ x: 47, z: 25.6 }), { x: 47, z: 29.5, yaw: 0 });
});
