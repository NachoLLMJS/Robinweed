import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSkyStarPositions, SKY_STAR_COUNT, SKY_STAR_RADIUS } from '../src/skyStarsState.js';

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
