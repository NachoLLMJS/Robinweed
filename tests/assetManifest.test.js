import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_URLS, vendorClipForPanel } from '../src/assetManifest.js';

test('approved warehouse props and complete city buildings use versioned GLBs', () => {
  assert.deepEqual(ASSET_URLS.warehouse, {
    wall: '/models-v3/warehouse/concrete-wall.glb',
    loadingDoorFrame: '/models-v8/warehouse/automatic-loading-door-frame.glb',
    loadingDoorLeaf: '/models-v8/warehouse/automatic-loading-door-leaf.glb',
    growBench: '/models-v3/warehouse/grow-bench.glb',
    shelf: '/models-v3/warehouse/shelf.glb',
    growLight: '/models-v3/warehouse/grow-light.glb',
    vendorCounter: '/models-v3/warehouse/vendor-counter.glb',
  });
  assert.deepEqual(ASSET_URLS.city, {
    shop: '/models-v5/city/shop.glb',
    house: '/models-v5/city/house.glb',
  });
  assert.deepEqual(ASSET_URLS.street, {
    lamp: '/models-v9/street/streetlamp.glb',
    tree: '/models-v9/street/tree.glb',
    shrub: '/models-v9/street/shrub-planter.glb',
    van: '/models-v9/street/delivery-van.glb',
    loadingZone: '/models-v9/street/loading-zone-cluster.glb',
    furniture: '/models-v9/street/street-furniture-cluster.glb',
    neighborOlder: '/models-v9/street/neighbor-older-idle.glb',
    cat: '/models-v9/street/street-cat.glb',
    simpleHouseA: '/models-v10/city/simple-house-a.glb',
    simpleHouseB: '/models-v10/city/simple-house-b.glb',
  });
  assert.equal(ASSET_URLS.items.seedPack, '/models-v7/items/robinhood-seed-pack-clean.glb');
  assert.equal(ASSET_URLS.textures.growthDiagram, '/textures/plant-growth-diagram.png');
  assert.equal(ASSET_URLS.branding.mark, '/brands/robinhood-chain-mark.svg');
});

test('the V9 street-life set is loaded into the playable exterior', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /STREET_LAYOUT, advanceVehicleRoute/);
  for (const key of ['lamp','tree','shrub','van','loadingZone','furniture','neighborOlder','cat','simpleHouseA','simpleHouseB']) {
    assert.match(source, new RegExp(`ASSET_URLS\\.street\\.${key}`));
  }
  assert.doesNotMatch(source, /ASSET_URLS\.street\.neighborYoung/);
  assert.doesNotMatch(source, /ASSET_URLS\.street\.backgroundBlock/);
  assert.doesNotMatch(source, /catPatrol|advancePatrol\(catPatrol/);
  assert.match(source, /streetIntersection/);
  assert.match(source, /streetActors/);
  assert.match(source, /startStreetAmbience/);
  assert.match(source, /MeshoptDecoder/);
  assert.match(source, /setMeshoptDecoder\(MeshoptDecoder\)/);
});

test('vendor uses separate rigged idle and talk clips', () => {
  assert.deepEqual(ASSET_URLS.vendor, {
    idle: '/models-v3/characters/milo-idle.glb',
    talk: '/models-v3/characters/milo-talk.glb',
  });
  assert.equal(vendorClipForPanel(false), 'idle');
  assert.equal(vendorClipForPanel(true), 'talk');
});

test('approved first-person tools do not include a hand model', () => {
  assert.equal(JSON.stringify(ASSET_URLS).includes('glove'), false);
  assert.equal(JSON.stringify(ASSET_URLS).includes('hand'), false);
});

test('trimmers aim toward the crosshair and tilt forward away from the camera', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /const trimmerScreenRotation=2\.18/);
  assert.match(source, /const trimmerDepthTilt=-\.85/);
  assert.match(source, /loadViewModel\(1,'\/models\/tools\/trimmers\.glb',\.43,\[\.12,\.95,2\.36\],\[-\.12,-\.02,-\.12\],scissorsFallback,'trimmers',trimmerScreenRotation,trimmerDepthTilt\)/);
  assert.doesNotMatch(source, /tools\[1\]\.rotation\.z=/);
});

test('seed pack is loaded as one Meshy asset without a runtime logo overlay', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /loadViewModel\(2,ASSET_URLS\.items\.seedPack/);
  assert.doesNotMatch(source, /seedBagBrand|seedBrandBack|seedMarkTexture/);
});

test('the automatic loading door replaces the functional entrance and exit', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /box\(\[\.25, 4\.2, 16\], mats\.wall, \[7, 2\.05, 0\], false\)/);
  assert.match(source, /const loadingDoorPosition=\{x:0,z:7\.82\}/);
  assert.doesNotMatch(source, /const exteriorDoor=|for\(let y=\.22;y<2\.45/);
});

test('metal jambs close both Meshy door-frame light leaks', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /const loadingDoorJambWidth=\.22/);
  assert.match(source, /const loadingDoorJambMaterial=new THREE\.MeshStandardMaterial/);
  assert.match(source, /box\(\[loadingDoorJambWidth,3\.25,\.3\],loadingDoorJambMaterial,\[-1\.05,1\.625,7\.96\],false\)/);
  assert.match(source, /box\(\[loadingDoorJambWidth,3\.25,\.3\],loadingDoorJambMaterial,\[1\.05,1\.625,7\.96\],false\)/);
});
