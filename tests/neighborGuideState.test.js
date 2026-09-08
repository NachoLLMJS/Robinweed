import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNeighborGuideNearby } from '../src/neighborGuideState.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('older neighbor guide uses a bounded street proximity', () => {
  const npc = { x: 5, z: 25 };
  assert.equal(isNeighborGuideNearby({ x: 6.9, z: 25 }, npc), true);
  assert.equal(isNeighborGuideNearby({ x: 8, z: 25 }, npc), false);
});

test('older neighbor explains house capacity and two-hour stock rewards in English', () => {
  assert.match(html, /id="neighborGuide"/);
  assert.match(html, /Bigger houses have more grow stations/);
  assert.match(html, /every 2 hours you can cultivate more plants and earn more stocks/);
  assert.match(main, /\[ E \] TALK TO OLD NEIGHBOR/);
  assert.match(main, /isNeighborGuideNearby/);
  assert.match(main, /openNeighborGuide/);
});
