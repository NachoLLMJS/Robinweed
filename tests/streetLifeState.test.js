import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STREET_LAYOUT, advancePatrol, advanceVehicleRoute } from '../src/streetLifeState.js';

test('street layout keeps the warehouse entrance and road center unobstructed', () => {
  assert.equal(STREET_LAYOUT.intersectionZ, 34);
  assert.equal(STREET_LAYOUT.houses.length, 2);
  assert.deepEqual(STREET_LAYOUT.houses, [
    { x: 8.4, z: 18.44, height: 5.1, rotationY: -Math.PI / 2 },
    { x: 8.4, z: 25.14, height: 7, rotationY: -Math.PI / 2 },
  ]);
  assert.deepEqual(STREET_LAYOUT.furniture, { x: -8.25, z: 20.5, height: 1.8, rotationY: Math.PI / 2 });
  assert.equal(STREET_LAYOUT.grass.length, 6);
  assert.ok(STREET_LAYOUT.grass.every(patch => Math.abs(patch.x) >= 56));
  assert.ok(STREET_LAYOUT.grass.every(patch => patch.width >= 90));
  assert.ok(STREET_LAYOUT.lamps.length >= 6);
  assert.ok(STREET_LAYOUT.trees.length >= 4);
  assert.ok(STREET_LAYOUT.van.x < -1.3, 'van should begin in the opposite traffic lane');
  assert.equal(STREET_LAYOUT.van.rotationY, Math.PI / 2, 'Meshy van requires a 180-degree visual-axis correction');
  for (const prop of [...STREET_LAYOUT.lamps, ...STREET_LAYOUT.trees]) {
    assert.ok(Math.abs(prop.x) >= 4.45);
  }
  for (const obstacle of STREET_LAYOUT.obstacles) {
    const blocksWarehouseDoor = obstacle.minX < 1.2 && obstacle.maxX > -1.2 && obstacle.minZ < 10 && obstacle.maxZ > 8;
    assert.equal(blocksWarehouseDoor, false);
  }
  const houseWalls = STREET_LAYOUT.obstacles.filter(obstacle => obstacle.minX === 5.98);
  assert.equal(houseWalls.length, 2);
  assert.ok(houseWalls[0].minZ <= 14.84, 'first new house must meet the original house row');
  assert.ok(houseWalls[0].maxZ >= houseWalls[1].minZ, 'new houses must have no collision gap');
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
    { x: -2.72, z: 12 }, { x: -2.72, z: 39 },
    { x: 2.72, z: 39 }, { x: 2.72, z: 12 },
  ]);
  const moved = advanceVehicleRoute({ segment: 0, distance: 26.8 }, 1, STREET_LAYOUT.vehicleRoute, 2.4);
  assert.equal(moved.segment, 1);
  assert.ok(moved.x > -2.72 && moved.z === 39);
  assert.ok(Math.abs(Math.abs(moved.rotationY) - Math.PI) < 1e-9);
});

test('patrol movement reverses at both route endpoints without overshoot', () => {
  assert.deepEqual(advancePatrol({ distance: 3.8, direction: 1 }, 1, 0, 4, 1), { distance: 4, direction: -1 });
  assert.deepEqual(advancePatrol({ distance: 0.1, direction: -1 }, 1, 0, 4, 1), { distance: 0, direction: 1 });
  assert.deepEqual(advancePatrol({ distance: 2, direction: 1 }, 0.5, 0, 4, 1), { distance: 2.5, direction: 1 });
});
