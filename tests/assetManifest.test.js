import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_URLS, vendorClipForPanel } from '../src/assetManifest.js';

test('approved warehouse props and complete city buildings use versioned GLBs', () => {
  assert.deepEqual(ASSET_URLS.warehouse, {
    wall: '/models-v3/warehouse/concrete-wall.glb',
    exterior: '/models-v19/warehouse/warehouse.glb',
    loadingDoorFrame: '/models-v8/warehouse/automatic-loading-door-frame.glb',
    loadingDoorLeaf: '/models-v8/warehouse/automatic-loading-door-leaf.glb',
    growBench: '/models-v3/warehouse/grow-bench.glb',
    shelf: '/models-v3/warehouse/shelf.glb',
    growLight: '/models-v3/warehouse/grow-light.glb',
    vendorCounter: '/models-v3/warehouse/vendor-counter.glb',
    soilPallet: '/models-v33/warehouse/soil-pallet.glb?v=1',
    airConditioner: '/models-v34/warehouse/wall-air-conditioner.glb?v=1',
    exhaustFan: '/models-v33/warehouse/exhaust-fan.glb?v=1',
    recyclingBin: '/models-v33/warehouse/recycling-bin.glb?v=1',
    hydroponicTower: '/models-v38/warehouse/hydroponic-tower.glb?v=1',
  });
  assert.deepEqual(ASSET_URLS.city, {
    shop: '/models-v23/city-pack/residential-9004-house.glb?v=1',
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
    househeadIdle: '/models-v24/characters/househead-idle.glb?v=1',
    foxWalker: '/models-v30/characters/fox-walk.glb?v=1',
    neonCatWalker: '/models-v31/characters/neon-cat-walk.glb?v=1',
    cat: '/models-v33/street/sad-cream-cat.glb?v=1',
    simpleHouseA: '/models-v10/city/simple-house-a.glb',
    simpleHouseB: '/models-v10/city/simple-house-b.glb',
    simpleHouseC: '/models-v13/city/detailed-house-c.glb',
    simpleHouseD: '/models-v13/city/detailed-house-d.glb',
    simpleHouseE: '/models-v18/city/low-poly-house.glb',
    simpleHouseF: '/models-v14/city/simple-house-f.glb',
    simpleHouseG: '/models-v14/city/simple-house-g.glb',
    simpleHouseH: '/models-v14/city/simple-house-h.glb',
    infillHouse1: '/models-v19/city/low-poly-house-neww.glb',
    infillHouse2: '/models-v19/city/low-poly-house-new2.glb',
    infillHouse3: '/models-v19/city/low-poly-house-new3.glb',
    infillHouse4: '/models-v19/city/low-poly-house-new4.glb',
    infillHouse5: '/models-v20/city/low-poly-house-67-ground-clean.glb',
    cityPackHighrise: '/models-v21/city-pack/highrise.glb?v=1',
    cityPackMotel: '/models-v21/city-pack/motel.glb?v=1',
    cityPackKfc: '/models-v21/city-pack/kfc.glb?v=1',
    cityPackResidential: '/models-v21/city-pack/residential-block.glb?v=1',
    cityPackCommercialTower: '/models-v21/city-pack/commercial-tower.glb?v=1',
    cityPackCommercialPurple: '/models-v21/city-pack/commercial-purple.glb?v=1',
    cityPackDiner: '/models-v21/city-pack/diner.glb?v=1',
    restaurant: '/models-v17/city/restaurant.glb',
    restaurantInterior: '/models-v17/interiors/restaurant-in-the-evening.glb',
  });
  assert.equal(ASSET_URLS.items.seedPack, '/models-v7/items/robinhood-seed-pack-clean.glb');
  assert.equal(ASSET_URLS.textures.growthDiagram, '/textures/warehouse/pizarra.png?v=1');
  assert.equal(ASSET_URLS.branding.mark, '/brands/robinhood-chain-mark.svg');
});

test('tokenized-stock seed packets use their approved versioned production GLBs', () => {
  assert.deepEqual(ASSET_URLS.items.stockSeedPacks, {
    MSFT: '/models-v26/items/stock-seed-packs/msft-seed-pack.glb?v=2',
    TSLA: '/models-v26/items/stock-seed-packs/tsla-seed-pack.glb?v=2',
    NVDA: '/models-v26/items/stock-seed-packs/nvda-seed-pack.glb?v=2',
    MSTR: '/models-v26/items/stock-seed-packs/mstr-seed-pack.glb?v=2',
    AAPL: '/models-v26/items/stock-seed-packs/aapl-seed-pack.glb?v=2',
    QQQ: '/models-v29/items/stock-seed-packs/qqq-seed-pack.glb?v=5',
    GOOGL: '/models-v26/items/stock-seed-packs/googl-seed-pack.glb?v=2',
  });
});

test('street-life GLBs including fitted versioned Meshy houses are loaded into the playable exterior', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /STREET_LAYOUT, advanceVehicleRoute/);
  for (const key of ['lamp','tree','shrub','van','loadingZone','furniture','neighborOlder','cat','simpleHouseB','simpleHouseC','simpleHouseD','simpleHouseE','simpleHouseF','simpleHouseG','simpleHouseH','infillHouse1','infillHouse2','infillHouse3','infillHouse4','restaurant','restaurantInterior']) {
    assert.match(source, new RegExp(`ASSET_URLS\\.street\\.${key}`));
  }
  assert.match(source, /ASSET_URLS\.street\.househeadIdle/);
  assert.match(source, /Househead_Idle/);
  assert.match(source, /househeadMixer\.clipAction/);
  assert.match(source, /STREET_LAYOUT\.househead/);
  assert.match(source, /ASSET_URLS\.street\[placement\.asset\]/);
  assert.match(source, /STREET_LAYOUT\.cityPackBuildings/);
  assert.doesNotMatch(source, /ASSET_URLS\.street\.simpleHouseA/);
  assert.doesNotMatch(source, /ASSET_URLS\.street\.infillHouse5/);
  assert.match(source, /loadCenteredFittedAsset\(\s*ASSET_URLS\.city\.shop/);
  assert.match(source, /maxDepthZ: 6, groundY: \.02, rotationY: 0, scaleY: 1\.7, scaleZ: 1\.8/);
  assert.match(source, /wrapper\.scale\.z\*=placement\.scaleZ/);
  assert.match(source, /city pack residential 9004 replacement/);
  assert.doesNotMatch(source, /buildingUsesRobinhoodLogo\('shop'\)/);
  assert.doesNotMatch(source, /function createSimpleHouse\(/);
  assert.doesNotMatch(source, /ASSET_URLS\.street\.neighborYoung/);
  assert.doesNotMatch(source, /ASSET_URLS\.street\.backgroundBlock/);
  assert.doesNotMatch(source, /catPatrol|advancePatrol\(catPatrol/);
  assert.doesNotMatch(source, /models-v9\/street\/street-cat\.glb/);
  assert.match(source, /streetIntersection/);
  assert.match(source, /streetActors/);
  assert.match(source, /startStreetAmbience/);
  assert.match(source, /MeshoptDecoder/);
  assert.match(source, /setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(source, /ASSET_URLS\.warehouse\.exterior/);
});

test('approved V33 sidewalk cat stays a compact textured low-poly seated asset', () => {
  const glb = readFileSync(new URL('../public/models-v33/street/sad-cream-cat.glb', import.meta.url));
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString().replace(/\0+$/g, '').trim());
  const triangles = document.meshes.flatMap(mesh => mesh.primitives).reduce((total, primitive) => total + document.accessors[primitive.indices].count / 3, 0);
  assert.equal(document.meshes.length, 1);
  assert.equal(document.materials.length, 1);
  assert.equal(document.images.length, 1);
  assert.equal(document.animations?.length ?? 0, 0);
  assert.ok(triangles >= 3_000 && triangles <= 5_000);
  const position = document.accessors[document.meshes[0].primitives[0].attributes.POSITION];
  assert.deepEqual(position.min, [-0.37304699420928955, -0.5, -0.47070300579071045]);
  assert.deepEqual(position.max, [0.375, 0.5, 0.4726560115814209]);
});

test('supplied hydroponic tower remains a textured static GLB', () => {
  const glb = readFileSync(new URL('../public/models-v38/warehouse/hydroponic-tower.glb', import.meta.url));
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString().replace(/\0+$/g, '').trim());
  assert.ok(document.meshes.length > 0);
  assert.ok(document.materials.length > 0);
  assert.ok(document.images.length > 0);
  assert.equal(document.animations?.length ?? 0, 0);
});

test('Vlad v37 uses separate rigged low-poly clips without the unwanted back mark', () => {
  assert.deepEqual(ASSET_URLS.vendor, {
    idle: '/models-v37/characters/vlad-tenev-idle.glb?v=2',
    talk: '/models-v37/characters/vlad-tenev-talk.glb?v=2',
  });
  assert.equal(vendorClipForPanel(false), 'idle');
  assert.equal(vendorClipForPanel(true), 'talk');
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /vendor\.rotation\.y=vendorYawTowardPlayer\(vendor\.position,camera\.position\)/);
  assert.match(source, /material\.flatShading=true/);
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
  assert.match(source, /legacyWarehouseBox\(\[\.25, 4\.2, 16\], mats\.wall, \[7, 2\.05, 0\], false\)/);
  assert.match(source, /const loadingDoorPosition=\{x:0,z:7\.82\}/);
  assert.doesNotMatch(source, /const exteriorDoor=|for\(let y=\.22;y<2\.45/);
});

test('metal jambs close both Meshy door-frame light leaks', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /const loadingDoorJambWidth=\.22/);
  assert.match(source, /const loadingDoorJambMaterial=new THREE\.MeshStandardMaterial/);
  assert.match(source, /legacyWarehouseBox\(\[loadingDoorJambWidth,3\.25,\.3\],loadingDoorJambMaterial,\[-1\.05,1\.625,7\.96\],false\)/);
  assert.match(source, /legacyWarehouseBox\(\[loadingDoorJambWidth,3\.25,\.3\],loadingDoorJambMaterial,\[1\.05,1\.625,7\.96\],false\)/);
});
