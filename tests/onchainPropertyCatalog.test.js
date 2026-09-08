import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_PROPERTIES } from '../src/housePropertyState.js';
import { ONCHAIN_PROPERTY_IDS, onchainPropertyId, propertyIdFromOnchain } from '../src/onchainPropertyCatalog.js';

test('every current property has one immutable explicit uint32 onchain ID', () => {
  assert.deepEqual(Object.keys(ONCHAIN_PROPERTY_IDS).sort(), HOUSE_PROPERTIES.map(property => property.id).sort());
  const values = Object.values(ONCHAIN_PROPERTY_IDS);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values.every(value => Number.isInteger(value) && value > 0 && value <= 0xffffffff), true);
});

test('unknown property IDs fail closed', () => {
  assert.equal(onchainPropertyId('START-EAST'), 2);
  assert.equal(propertyIdFromOnchain(2), 'START-EAST');
  assert.throws(() => onchainPropertyId('UNKNOWN-HOUSE'));
  assert.throws(() => propertyIdFromOnchain(999));
});
