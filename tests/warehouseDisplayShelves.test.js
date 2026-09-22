import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WAREHOUSE_GROW_STATIONS, WAREHOUSE_DECOR, stationCollider } from '../src/warehouseExpansionState.js';
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
  assert.ok(plants.every(plant => !('plotId' in plant) && !('onchainPlotId' in plant)));
  assert.ok(plants.every(plant => !('growth' in plant) && !('water' in plant) && !('seedTicker' in plant)));
  assert.equal(new Set(plants.map(plant => plant.displayId)).size, 18);
  assert.ok(plants.every(plant => /^DISPLAY-[AB]-L[1-3]-P[1-3]$/.test(plant.displayId)));
  assert.ok(plants.every(plant => plant.position[1] === plant.supportY));
});

test('display shelves remain outside every canonical V4 warehouse plot', () => {
  const stationColliders = WAREHOUSE_GROW_STATIONS.map(stationCollider);
  for (const bank of DISPLAY_SHELF_BANKS) {
    assert.ok(stationColliders.every(collider => !overlaps(bank.collider, collider)));
  }
});

test('display shelf leaves a player-width passage to the hydroponic tower', () => {
  const shelf = DISPLAY_SHELF_BANKS.find(bank => bank.id === 'DISPLAY-B').collider;
  const tower = WAREHOUSE_DECOR.hydroponicTower.collider;
  assert.ok(tower.minZ - shelf.maxZ >= 0.56, 'the passage must fit the player radius on both sides');
});

test('display shelf geometry has no cultivation interaction or persistence path', () => {
  const pieces = displayShelfPieces();
  assert.ok(pieces.length > 0);
  assert.ok(pieces.every(piece => piece.decorative === true));
  assert.match(main, /displayPlantPlacements\(\)/);
  assert.doesNotMatch(main, /displayShelf[^\n]*(?:userData\.interactive|pots\.push|localStorage|executeCultivationAction)/i);
});

test('display plants use their own visual raycast and local shelf lighting', () => {
  assert.match(main, /type:'displayPlant'/);
  assert.match(main, /beginDisplayWatering\(display\.displayId/);
  assert.match(main, /displayPlantHits/);
  assert.match(main, /new THREE\.PointLight/);
  const displayWatering = main.slice(main.indexOf('function startDisplayWatering'), main.indexOf('async function useOnchainTool'));
  assert.doesNotMatch(displayWatering, /plotId|waterPlant|Object\.assign|executeCultivationAction|localStorage/);
});
