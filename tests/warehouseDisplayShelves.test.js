import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WAREHOUSE_GROW_STATIONS, stationCollider } from '../src/warehouseExpansionState.js';
import {
  DISPLAY_SHELF_BANKS,
  displayShelfPieces,
  displayPlantPlacements,
} from '../src/warehouseDisplayShelves.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

test('warehouse display shelving is two purely decorative banks with eighteen plants', () => {
  assert.equal(DISPLAY_SHELF_BANKS.length, 2);
  const plants = displayPlantPlacements();
  assert.equal(plants.length, 18);
  assert.ok(plants.every(plant => plant.decorative === true));
  assert.ok(plants.every(plant => plant.onchainPlotId === null));
  assert.ok(plants.every(plant => !('growth' in plant) && !('water' in plant) && !('seedTicker' in plant)));
});

test('display shelves remain outside every canonical V4 warehouse plot', () => {
  const stationColliders = WAREHOUSE_GROW_STATIONS.map(stationCollider);
  for (const bank of DISPLAY_SHELF_BANKS) {
    assert.ok(stationColliders.every(collider => !overlaps(bank.collider, collider)));
  }
});

test('display shelf geometry has no cultivation interaction or persistence path', () => {
  const pieces = displayShelfPieces();
  assert.ok(pieces.length > 0);
  assert.ok(pieces.every(piece => piece.decorative === true));
  assert.match(main, /displayPlantPlacements\(\)/);
  assert.doesNotMatch(main, /displayShelf[^\n]*(?:userData\.interactive|pots\.push|localStorage|executeCultivationAction)/i);
});
