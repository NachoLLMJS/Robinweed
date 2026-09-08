import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASSET_URLS } from '../src/assetManifest.js';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('warehouse board uses the supplied versioned pizarra artwork', () => {
  assert.equal(ASSET_URLS.textures.growthDiagram, '/textures/warehouse/pizarra.png?v=1');
  assert.match(main, /ASSET_URLS\.textures\.growthDiagram/);
});

test('warehouse expansion uses four versioned Meshy props without the removed gray duct', () => {
  assert.equal(ASSET_URLS.warehouse.soilPallet, '/models-v33/warehouse/soil-pallet.glb?v=1');
  assert.equal('hvacDuct' in ASSET_URLS.warehouse, false);
  assert.equal(ASSET_URLS.warehouse.airConditioner, '/models-v34/warehouse/wall-air-conditioner.glb?v=1');
  assert.equal(ASSET_URLS.warehouse.exhaustFan, '/models-v33/warehouse/exhaust-fan.glb?v=1');
  assert.equal(ASSET_URLS.warehouse.recyclingBin, '/models-v33/warehouse/recycling-bin.glb?v=1');
});

test('all eight warehouse stations share the canonical station layout', () => {
  assert.match(main, /WAREHOUSE_GROW_STATIONS\.forEach\(\(station,index\)=>/);
  assert.match(main, /group\.position\.set\(stationLayout\.x/);
  assert.match(main, /location:'warehouse'/);
});

test('warehouse loads pallet, wall AC, fans and recycling bin from the manifest', () => {
  assert.match(main, /loadWarehouseProp\(ASSET_URLS\.warehouse\.soilPallet/);
  assert.doesNotMatch(main, /ASSET_URLS\.warehouse\.hvacDuct/);
  assert.match(main, /loadWarehouseProp\(ASSET_URLS\.warehouse\.airConditioner/);
  assert.match(main, /loadWarehouseProp\(ASSET_URLS\.warehouse\.exhaustFan/);
  assert.match(main, /loadWarehouseProp\(ASSET_URLS\.warehouse\.recyclingBin/);
});

test('four glass jars receive a dense Meshy bud pile without colored bottom rings', () => {
  assert.match(main, /WAREHOUSE_JARS\.forEach\(createWarehouseJar\)/);
  assert.match(main, /populateWarehouseJarBuds/);
  assert.match(main, /WAREHOUSE_JAR_BUD_PLACEMENTS\.forEach/);
  assert.match(main, /meshyMatureBudTemplate\.clone\(true\)/);
  assert.doesNotMatch(main, /const band=new THREE\.Mesh/);
});
