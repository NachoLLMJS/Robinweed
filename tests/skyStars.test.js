import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSkyStarPositions, SKY_STAR_COUNT, SKY_STAR_RADIUS } from '../src/skyStarsState.js';
import { NIGHT_SKY, moonDiscPosition } from '../src/nightSkyState.js';

test('expanded neighborhood sky uses a dense deterministic star dome', () => {
  assert.equal(SKY_STAR_COUNT, 420);
  assert.equal(SKY_STAR_RADIUS, 68);
  const first = buildSkyStarPositions();
  const second = buildSkyStarPositions();
  assert.deepEqual(first, second);
  assert.equal(first.length, SKY_STAR_COUNT * 3);
  for (let index = 0; index < first.length; index += 3) {
    const radius = Math.hypot(first[index], first[index + 1], first[index + 2]);
    assert.ok(Math.abs(radius - SKY_STAR_RADIUS) < 1e-9);
    assert.ok(first[index + 1] > 0);
  }
});

test('rendered star dome follows the camera across the expanded neighborhood', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /buildSkyStarPositions\(\)/);
  assert.match(source, /stars\.position\.copy\(camera\.position\)/);
  assert.doesNotMatch(source, /for\(let i=0;i<150;i\+\+\)/);
});

test('moon is compact, high in the sky and follows the camera', () => {
  assert.ok(NIGHT_SKY.moonRadius <= 3.2);
  const camera = { x: 0, y: 1.68, z: 0 };
  const position = moonDiscPosition(camera);
  assert.ok(position.y - camera.y > 100);
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /moonDiscPosition\(camera\.position\)/);
  assert.doesNotMatch(source, /moonDisc\.position\.set\(-13,14,41\)/);
});
