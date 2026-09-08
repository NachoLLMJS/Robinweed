import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STREET_LAYOUT, advancePatrol, advanceVehicleRoute } from '../src/streetLifeState.js';
import { ASSET_URLS } from '../src/assetManifest.js';
import { cityBuildingFor } from '../src/navigationState.js';

test('street layout keeps the warehouse entrance and road center unobstructed', () => {
  assert.equal(STREET_LAYOUT.intersectionZ, 34);
  assert.equal(STREET_LAYOUT.houses.length, 20);
  assert.deepEqual(STREET_LAYOUT.houses, [
    { x: 8.4, z: 18.44, height: 5.1, rotationY: -Math.PI / 2 },
    { x: 8.4, z: 25.14, height: 7, rotationY: -Math.PI / 2 },
    { x: 9.675, z: 42, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.525, z: 50.15, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.525, z: 42.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.675, z: 49.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.675, z: 57.9, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: -9.525, z: 57.8, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.675, z: 65.2, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.525, z: 65.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.525, z: 72.5, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: 9.675, z: 72.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.675, z: 80, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'simpleHouseE' },
    { x: -9.675, z: 80, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseF' },
    { x: 9.525, z: 87.5, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseG' },
    { x: -9.675, z: 87.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseH' },
    { x: 9.675, z: 95, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseF' },
    { x: -9.675, z: 94.8, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseE' },
    { x: 9.675, z: 102.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseH' },
    { x: -9.525, z: 102.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseG' },
  ]);
  assert.deepEqual(STREET_LAYOUT.furniture, { x: -10.5, z: 10.5, height: 1.8, rotationY: Math.PI / 2 });
  assert.equal(STREET_LAYOUT.grass.length, 4);
  assert.ok(STREET_LAYOUT.grass.every(patch => Math.abs(patch.x) >= 56));
  assert.ok(STREET_LAYOUT.grass.every(patch => patch.width >= 90));
  assert.equal(STREET_LAYOUT.lamps.length, 18);
  assert.deepEqual(STREET_LAYOUT.househead, { x: -5.1, z: 18.15, height: 1.55, rotationY: Math.PI / 2 });
  assert.ok(Math.hypot(STREET_LAYOUT.househead.x - STREET_LAYOUT.lamps[2].x, STREET_LAYOUT.househead.z - STREET_LAYOUT.lamps[2].z) > 2);
  assert.equal(STREET_LAYOUT.trees.length, 7);
  assert.ok(STREET_LAYOUT.van.x < -1.3, 'van should begin in the opposite traffic lane');
  assert.equal(STREET_LAYOUT.van.rotationY, Math.PI / 2, 'Meshy van requires a 180-degree visual-axis correction');
  for (const prop of [...STREET_LAYOUT.lamps, ...STREET_LAYOUT.trees]) {
    assert.ok(Math.abs(prop.x) >= 4.45);
  }
  for (const obstacle of STREET_LAYOUT.obstacles) {
    const blocksWarehouseDoor = obstacle.minX < 1.2 && obstacle.maxX > -1.2 && obstacle.minZ < 10 && obstacle.maxZ > 8;
    assert.equal(blocksWarehouseDoor, false);
  }
  const kfcWall = STREET_LAYOUT.obstacles.find(obstacle => !obstacle.kind && obstacle.maxX === 12.4);
  const nextHouseWall = STREET_LAYOUT.obstacles.find(obstacle => !obstacle.kind && obstacle.minZ === 22.02);
  assert.ok(kfcWall.minZ - cityBuildingFor('house').obstacle.maxZ <= 1.3 + 1e-9, 'KFC must fill the gap after the original house');
  assert.ok(nextHouseWall.minZ - kfcWall.maxZ <= 1.3 + 1e-9, 'KFC must fill the gap before the next house');
});

test('intersection stays clear of sidewalk strips and the crosswalk starts the street', () => {
  assert.equal(STREET_LAYOUT.crossingZ, 12.2);
  assert.ok(STREET_LAYOUT.intersectionZ - STREET_LAYOUT.crossingZ > 18);
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /box\(\[1\.8,\.16,38\]/, 'long sidewalks must stop at the intersection');
  assert.doesNotMatch(source, /box\(\[32,\.16,1\.05\]/, 'cross-street sidewalks must not span through the intersection');
  assert.match(source, /STREET_LAYOUT\.crossingZ/);
});

test('shrub planters stay out of the intersection roadway', () => {
  const roadHalfWidth = 6.25;
  const intersectionHalfDepth = 4.5;
  for (const shrub of STREET_LAYOUT.shrubs) {
    const insideIntersectionRoad = Math.abs(shrub.x) < roadHalfWidth
      && Math.abs(shrub.z - STREET_LAYOUT.intersectionZ) < intersectionHalfDepth;
    assert.equal(insideIntersectionRoad, false, `shrub at ${shrub.x},${shrub.z} blocks the intersection`);
  }
});

test('every tree planter footprint sits fully on grass instead of road, sidewalk, or curb', () => {
  const planterRadius = 1.76 / 2;
  const containsFootprint = (grass, tree) => (
    tree.x - planterRadius >= grass.x - grass.width / 2
    && tree.x + planterRadius <= grass.x + grass.width / 2
    && tree.z - planterRadius >= grass.z - grass.depth / 2
    && tree.z + planterRadius <= grass.z + grass.depth / 2
  );

  for (const tree of STREET_LAYOUT.trees) {
    assert.ok(
      STREET_LAYOUT.grass.some(grass => containsFootprint(grass, tree)),
      `tree planter at ${tree.x},${tree.z} is not fully supported by grass`,
    );
  }
});

test('tree and lamp placements leave a clear area around the older neighbor', () => {
  const distanceToNeighbor = prop => Math.hypot(
    prop.x - STREET_LAYOUT.neighborOlder.x,
    prop.z - STREET_LAYOUT.neighborOlder.z,
  );
  assert.ok(STREET_LAYOUT.lamps.every(lamp => distanceToNeighbor(lamp) >= 2));
  assert.ok(STREET_LAYOUT.trees.every(tree => distanceToNeighbor(tree) >= 4));
});

test('trees never intersect a residential building footprint', () => {
  for (const tree of STREET_LAYOUT.trees) {
    for (const building of STREET_LAYOUT.obstacles.filter(obstacle => obstacle.maxX > 10)) {
      const insideBuilding = tree.x >= building.minX && tree.x <= building.maxX
        && tree.z >= building.minZ && tree.z <= building.maxZ;
      assert.equal(insideBuilding, false, `tree at ${tree.x},${tree.z} intersects a house`);
    }
  }
});

test('new house row resumes beyond the intersection without blocking it or overlapping', () => {
  const postIntersection = STREET_LAYOUT.houses.filter(house => house.z > 37.6);
  assert.equal(postIntersection.length, 18);
  assert.ok(postIntersection.every(house => Math.abs(house.x)-house.maxWidthX/2 >= 6.2), 'new house fit boxes must remain behind the sidewalk');
  assert.ok(postIntersection.every(house => house.z > STREET_LAYOUT.intersectionZ + 6));
  const postIntersectionWalls = STREET_LAYOUT.obstacles.filter(obstacle => !obstacle.kind && obstacle.minZ > 37.6);
  assert.equal(postIntersectionWalls.length, 18);
  assert.deepEqual(new Set(postIntersection.map(house => house.asset)), new Set(['simpleHouseC', 'simpleHouseD', 'simpleHouseE', 'simpleHouseF', 'simpleHouseG', 'simpleHouseH']));
  for (const asset of ['simpleHouseE', 'simpleHouseF', 'simpleHouseG', 'simpleHouseH']) {
    assert.equal(postIntersection.filter(house => house.asset === asset).length, 2);
  }
  assert.equal(STREET_LAYOUT.vehicleRoute[1].z, 107);
  assert.equal(STREET_LAYOUT.vehicleRoute[2].z, 107);
});

test('new house fit boxes stay entirely inside their grass gaps without same-side overlap', () => {
  const houses=STREET_LAYOUT.houses.slice(2);
  for(const house of houses){
    assert.ok(Math.abs(house.x)-house.maxWidthX/2>=6.2);
    assert.ok(house.z-house.maxDepthZ/2>=38.7);
    assert.equal(house.groundY,.03);
  }
  for(const side of [-1,1]){
    const row=houses.filter(house=>Math.sign(house.x)===side).sort((a,b)=>a.z-b.z);
    for(let index=1;index<row.length;index++)assert.ok(row[index-1].z+row[index-1].maxDepthZ/2<row[index].z-row[index].maxDepthZ/2);
  }
});

test('grass patches do not overlap the transverse curbs', () => {
  const overlaps = (a, b) => (
    Math.abs(a.x - b.x) * 2 < a.width + b.width
    && Math.abs(a.z - b.z) * 2 < a.depth + b.depth
  );

  assert.equal(STREET_LAYOUT.crossCurbs.length, 4);
  for (const grass of STREET_LAYOUT.grass) {
    for (const curb of STREET_LAYOUT.crossCurbs) {
      assert.equal(overlaps(grass, curb), false, `grass at ${grass.x},${grass.z} overlaps curb at ${curb.x},${curb.z}`);
    }
  }
});

test('vehicle route circulates through both lanes and turns at each end', () => {
  assert.deepEqual(STREET_LAYOUT.vehicleRoute, [
    { x: -2.72, z: 12 }, { x: -2.72, z: 107 },
    { x: 2.72, z: 107 }, { x: 2.72, z: 12 },
  ]);
  const moved = advanceVehicleRoute({ segment: 0, distance: 94.8 }, 1, STREET_LAYOUT.vehicleRoute, 2.4);
  assert.equal(moved.segment, 1);
  assert.ok(moved.x > -2.72 && moved.z === 107);
  assert.ok(Math.abs(Math.abs(moved.rotationY) - Math.PI) < 1e-9);
});

test('patrol movement reverses at both route endpoints without overshoot', () => {
  assert.deepEqual(advancePatrol({ distance: 3.8, direction: 1 }, 1, 0, 4, 1), { distance: 4, direction: -1 });
  assert.deepEqual(advancePatrol({ distance: 0.1, direction: -1 }, 1, 0, 4, 1), { distance: 0, direction: 1 });
  assert.deepEqual(advancePatrol({ distance: 2, direction: 1 }, 0.5, 0, 4, 1), { distance: 2.5, direction: 1 });
});

test('first intersection continues into playable left and right neighborhood streets', () => {
  assert.deepEqual(STREET_LAYOUT.crossStreet, { x: 0, z: 34, width: 108, depth: 7.2 });
  assert.equal(STREET_LAYOUT.grass.length, 4, 'the old grass caps must be removed from both branches');
  assert.equal(STREET_LAYOUT.crossCurbs.length, 4);
  for (const side of [-1, 1]) {
    const curbs = STREET_LAYOUT.crossCurbs.filter(curb => Math.sign(curb.x) === side);
    assert.equal(curbs.length, 2);
    for (const curb of curbs) {
      assert.ok(Math.abs(curb.x) + curb.width / 2 >= 53.9, 'branch sidewalk must reach the road end');
      assert.ok(Math.abs(curb.x) - curb.width / 2 <= 4.21, 'branch sidewalk must meet the central carriageway');
    }
  }
  assert.ok(STREET_LAYOUT.branchHouses.filter(house => house.x < 0).length >= 4);
  assert.ok(STREET_LAYOUT.branchHouses.filter(house => house.x > 0).length >= 4);
  assert.ok(STREET_LAYOUT.lamps.some(lamp => Math.abs(lamp.x) >= 45 && Math.abs(lamp.z - 34) >= 4));
});

test('restaurant sits on the first right street behind its sidewalk', () => {
  assert.deepEqual(STREET_LAYOUT.restaurant, {
    x: 32, z: 44.15, height: 5.2,
    maxWidthX: 13.5, maxDepthZ: 10, groundY: .03, rotationY: Math.PI,
  });
  const restaurantObstacle = STREET_LAYOUT.obstacles.find(obstacle => obstacle.kind === 'restaurant');
  assert.deepEqual(restaurantObstacle, {
    kind: 'restaurant', minX: 25.25, maxX: 38.75, minZ: 39.15, maxZ: 49.15,
  });
  assert.ok(restaurantObstacle.minZ > STREET_LAYOUT.intersectionZ + STREET_LAYOUT.crossStreet.depth / 2);
  assert.ok(restaurantObstacle.minX > 4.2, 'restaurant must remain on the right branch');
});

test('replacement house E uses its entrance-facing orientation on every street', () => {
  const eHouses = [...STREET_LAYOUT.houses, ...STREET_LAYOUT.branchHouses]
    .filter(house => house.asset === 'simpleHouseE');
  assert.deepEqual(eHouses.map(({ x, z, rotationY }) => ({ x, z, rotationY })), [
    { x: 9.675, z: 80, rotationY: 0 },
    { x: -9.675, z: 94.8, rotationY: Math.PI },
    { x: -37, z: 42.4, rotationY: -Math.PI / 2 },
    { x: 18, z: 25.6, rotationY: Math.PI / 2 },
  ]);
});

test('five supplied houses fill existing empty lots without extending either road', () => {
  assert.deepEqual(STREET_LAYOUT.crossStreet, { x: 0, z: 34, width: 108, depth: 7.2 });
  assert.equal(STREET_LAYOUT.infillHouses.length, 5);
  assert.deepEqual(STREET_LAYOUT.infillHouses.map(({ x, z, asset }) => ({ x, z, asset })), [
    { x: -28.5, z: 42.4, asset: 'infillHouse1' },
    { x: -28.5, z: 25.6, asset: 'infillHouse2' },
    { x: 27, z: 25.6, asset: 'infillHouse3' },
    { x: 37, z: 25.6, asset: 'infillHouse4' },
    { x: -10, z: 20.5, asset: 'infillHouse5' },
  ]);
  assert.deepEqual(STREET_LAYOUT.infillHouses.map(house => house.groundY), [.03, .03, .03, .03, .02]);
  assert.equal(STREET_LAYOUT.obstacles.filter(obstacle => obstacle.kind === 'infill-house').length, 5);
});

test('motel replaces house 67 without floating or blocking the road', () => {
  const motel = STREET_LAYOUT.cityPackBuildings.find(item => item.asset === 'cityPackMotel');
  assert.deepEqual(motel, {
    x: -10, z: 22.5, height: 12.2,
    maxWidthX: 7.4, maxDepthZ: 8.8, groundY: .02,
    rotationY: Math.PI / 2, asset: 'cityPackMotel', replaces: 'infillHouse5',
  });
  assert.ok(motel.x + motel.maxWidthX / 2 <= -6.2, 'motel must remain behind the west sidewalk');
  assert.deepEqual(STREET_LAYOUT.furniture, { x: -10.5, z: 10.5, height: 1.8, rotationY: Math.PI / 2 });
  const collider = STREET_LAYOUT.obstacles.find(obstacle => obstacle.kind === 'infill-house' && obstacle.minZ === 18.1);
  assert.deepEqual(collider, {
    kind: 'infill-house', minX: -13.7, maxX: -6.3, minZ: 18.1, maxZ: 26.9,
  });
  const furnitureRadius = 2.4;
  const closestX = Math.max(collider.minX, Math.min(STREET_LAYOUT.furniture.x, collider.maxX));
  const closestZ = Math.max(collider.minZ, Math.min(STREET_LAYOUT.furniture.z, collider.maxZ));
  assert.ok(Math.hypot(STREET_LAYOUT.furniture.x - closestX, STREET_LAYOUT.furniture.z - closestZ) > furnitureRadius);
});

test('relocated motel leaves every tree planter outside its footprint', () => {
  const collider = STREET_LAYOUT.obstacles.find(obstacle => obstacle.kind === 'infill-house' && obstacle.minZ === 18.1);
  const planterRadius = .88;
  for (const tree of STREET_LAYOUT.trees) {
    const closestX = Math.max(collider.minX, Math.min(tree.x, collider.maxX));
    const closestZ = Math.max(collider.minZ, Math.min(tree.z, collider.maxZ));
    assert.ok(
      Math.hypot(tree.x - closestX, tree.z - closestZ) > planterRadius,
      `tree planter at ${tree.x},${tree.z} overlaps the motel`,
    );
  }
});

test('every lamp is centered on its supporting sidewalk', () => {
  const mainStreetLamps = STREET_LAYOUT.lamps.filter(lamp => Math.abs(lamp.x) <= 6);
  const crossStreetLamps = STREET_LAYOUT.lamps.filter(lamp => Math.abs(lamp.x) > 6);
  assert.equal(mainStreetLamps.length, 12);
  assert.equal(crossStreetLamps.length, 6);
  assert.ok(!STREET_LAYOUT.lamps.some(lamp => lamp.x === -5.1 && lamp.z === 30.2));
  assert.ok(!STREET_LAYOUT.lamps.some(lamp => lamp.x === 5.1 && lamp.z === 37.2));
  assert.ok(mainStreetLamps.every(lamp => Math.abs(lamp.x) === 5.1));
  assert.ok(crossStreetLamps.every(lamp => lamp.z === 29.88 || lamp.z === 38.12));
});

test('city pack replaces the two rejected houses and five repeated buildings', () => {
  const buildings = STREET_LAYOUT.cityPackBuildings;
  assert.equal(buildings.length, 7);
  assert.deepEqual(
    new Set(buildings.map(building => building.asset)),
    new Set(['cityPackHighrise', 'cityPackMotel', 'cityPackKfc', 'cityPackResidential', 'cityPackCommercialTower', 'cityPackCommercialPurple', 'cityPackDiner']),
  );
  assert.ok(buildings.some(building => building.replaces === 'infillHouse5' && building.x === -10 && building.z === 22.5));
  assert.ok(buildings.some(building => building.replaces === 'simpleHouseA' && building.x === 9.2 && building.z === 18.44));
  assert.ok(buildings.every(building => Number.isFinite(building.groundY)));
});

test('city pack assets are standalone versioned GLBs', () => {
  const keys = ['cityPackHighrise', 'cityPackMotel', 'cityPackKfc', 'cityPackResidential', 'cityPackCommercialTower', 'cityPackCommercialPurple', 'cityPackDiner'];
  for (const key of keys) assert.match(ASSET_URLS.street[key], /^\/models-v21\/city-pack\/.+\.glb\?v=1$/);
});

test('city pack replacement envelopes do not overlap and remain behind sidewalks', () => {
  const buildings = STREET_LAYOUT.cityPackBuildings;
  for (const building of buildings) {
    const halfX = building.maxWidthX / 2;
    const halfZ = building.maxDepthZ / 2;
    if (Math.abs(building.x) < 14) assert.ok(Math.abs(building.x) - halfX >= 6 - 1e-9, `${building.asset} crosses a main sidewalk`);
    if (Math.abs(building.z - 34) < 14) assert.ok(Math.abs(building.z - 34) - halfZ >= 4.65 - 1e-9, `${building.asset} crosses a branch sidewalk`);
  }
  for (let i = 0; i < buildings.length; i++) for (let j = i + 1; j < buildings.length; j++) {
    const a = buildings[i], b = buildings[j];
    const separatedX = Math.abs(a.x - b.x) >= (a.maxWidthX + b.maxWidthX) / 2;
    const separatedZ = Math.abs(a.z - b.z) >= (a.maxDepthZ + b.maxDepthZ) / 2;
    assert.ok(separatedX || separatedZ, `${a.asset} overlaps ${b.asset}`);
  }
});

test('highrise presents its opposite facade to the main road', () => {
  const highrise = STREET_LAYOUT.cityPackBuildings.find(building => building.asset === 'cityPackHighrise');
  assert.equal(highrise.rotationY, -Math.PI / 2);
});

test('motel occupies the north gap without overlapping the Robinhood shop', () => {
  const motel = STREET_LAYOUT.cityPackBuildings.find(building => building.asset === 'cityPackMotel');
  const shop = cityBuildingFor('shop').obstacle;
  const motelBounds = {
    minX: motel.x - motel.maxWidthX / 2,
    maxX: motel.x + motel.maxWidthX / 2,
    minZ: motel.z - motel.maxDepthZ / 2,
    maxZ: motel.z + motel.maxDepthZ / 2,
  };
  const overlaps = motelBounds.minX < shop.maxX && motelBounds.maxX > shop.minX
    && motelBounds.minZ < shop.maxZ && motelBounds.maxZ > shop.minZ;
  assert.equal(overlaps, false);
  assert.equal(motel.z, 22.5);
});

test('KFC and Nike store fill more of their existing lots', () => {
  const kfc = STREET_LAYOUT.cityPackBuildings.find(building => building.asset === 'cityPackKfc');
  const nike = STREET_LAYOUT.cityPackBuildings.find(building => building.asset === 'cityPackDiner');
  assert.deepEqual(
    { x: kfc.x, width: kfc.maxWidthX, height: kfc.height },
    { x: 9.2, width: 6.4, height: 6 },
  );
  assert.deepEqual(
    { width: nike.maxWidthX, depth: nike.maxDepthZ, height: nike.height, rotationY: nike.rotationY, scaleX: nike.scaleX, scaleY: nike.scaleY },
    { width: 7.3, depth: 7.5, height: 5.6, rotationY: -Math.PI / 2, scaleX: undefined, scaleY: 1.4 },
  );
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /wrapper\.scale\.x\*=placement\.scaleX/);
  assert.match(source, /wrapper\.scale\.y\*=placement\.scaleY/);
});

test('exterior restaurant has no generated green-border sign', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /restaurantSignCanvas|restaurantSignContext|fillText\('RESTAURANT'/);
});
