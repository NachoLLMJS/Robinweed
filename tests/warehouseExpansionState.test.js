import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WAREHOUSE_GROW_STATIONS,
  WAREHOUSE_DECOR,
  WAREHOUSE_JARS,
  WAREHOUSE_JAR_BUD_PLACEMENTS,
  stationCollider,
} from '../src/warehouseExpansionState.js';

const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

test('warehouse has eight grow stations while preserving the original four', () => {
  assert.equal(WAREHOUSE_GROW_STATIONS.length, 8);
  assert.deepEqual(
    WAREHOUSE_GROW_STATIONS.slice(0, 4).map(({ x, z }) => [x, z]),
    [[-2.4, -2.2], [-0.8, -2.2], [0.8, -2.2], [2.4, -2.2]],
  );
  assert.deepEqual(
    WAREHOUSE_GROW_STATIONS.slice(4).map(({ x, z }) => [x, z]),
    [[-4.7, 0.15], [-3.15, 0.15], [3.15, 0.15], [4.7, 0.15]],
  );
});

test('new side stations leave the central entrance aisle and pillar clear', () => {
  const pillar = { minX: -0.48, maxX: 0.48, minZ: 0.77, maxZ: 1.73 };
  for (const station of WAREHOUSE_GROW_STATIONS.slice(4)) {
    const collider = stationCollider(station);
    assert.equal(overlaps(collider, pillar), false);
    assert.ok(collider.minX >= -6.6 && collider.maxX <= 6.6);
  }
  assert.ok(WAREHOUSE_GROW_STATIONS.slice(4).every(({ x }) => Math.abs(x) >= 3.15));
});

test('warehouse decor reserves floor corners, wall AC and elevated fans without gray ducts', () => {
  assert.deepEqual(WAREHOUSE_DECOR.soilPallet.position, [-5.35, 0, 3.25]);
  assert.deepEqual(WAREHOUSE_DECOR.recyclingBin.position, [5.65, 0, 3.45]);
  assert.equal('ducts' in WAREHOUSE_DECOR, false);
  assert.deepEqual(WAREHOUSE_DECOR.airConditioner.position, [-6.67, 2.35, 5.05]);
  assert.equal(WAREHOUSE_DECOR.fans.length, 2);
  assert.ok(WAREHOUSE_DECOR.airConditioner.position[1] >= 2);
  assert.ok(WAREHOUSE_DECOR.fans.every(item => item.position[1] >= 2));
});

test('lower shelf jars sit directly on the lower shelf instead of floating', () => {
  assert.deepEqual(WAREHOUSE_JARS.slice(0, 2).map(jar => jar.position[1]), [.49, .49]);
});

test('four shelf jars use distinct approved bud colors', () => {
  assert.equal(WAREHOUSE_JARS.length, 4);
  assert.equal(new Set(WAREHOUSE_JARS.map(jar => jar.ticker)).size, 4);
  assert.equal(new Set(WAREHOUSE_JARS.map(jar => jar.color)).size, 4);
});

test('the green HOOD jar sits fully inside the lower shelf instead of behind its left upright', () => {
  const hoodJar = WAREHOUSE_JARS.find(jar => jar.ticker === 'HOOD');
  assert.deepEqual(hoodJar.position, [-5.65, .49, -5.73]);
  assert.ok(WAREHOUSE_JARS.every(jar => jar.position[0] >= -5.8 && jar.position[0] <= -4.45));
});

test('each jar uses a dense bottom-supported pile instead of four floating buds', () => {
  assert.equal(WAREHOUSE_JAR_BUD_PLACEMENTS.length, 30);
  assert.ok(WAREHOUSE_JAR_BUD_PLACEMENTS.filter(([, y]) => y <= .09).length >= 8);
  assert.deepEqual([...new Set(WAREHOUSE_JAR_BUD_PLACEMENTS.map(([, y]) => y))], [.08, .14, .20, .26, .32]);
  assert.ok(WAREHOUSE_JAR_BUD_PLACEMENTS.every(([x, y, z]) => Math.hypot(x, z) <= .15 && y >= .08 && y <= .32));
});
