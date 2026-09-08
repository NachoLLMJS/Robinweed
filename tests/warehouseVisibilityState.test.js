import test from 'node:test';
import assert from 'node:assert/strict';
import { warehouseVisibilityForLocation } from '../src/warehouseVisibilityState.js';

test('street shows only the supplied warehouse exterior', () => {
  assert.deepEqual(warehouseVisibilityForLocation('street'), {
    legacyInterior: false,
    suppliedExterior: true,
  });
});

test('warehouse location shows only the playable legacy interior', () => {
  assert.deepEqual(warehouseVisibilityForLocation('warehouse'), {
    legacyInterior: true,
    suppliedExterior: false,
  });
});

test('other interior instances hide both warehouse layers', () => {
  assert.deepEqual(warehouseVisibilityForLocation('restaurant-interior'), {
    legacyInterior: false,
    suppliedExterior: false,
  });
});
