import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATURE_BUD_CLUSTERS, matureBudVariant } from '../src/matureBudState.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const main = fs.readFileSync(path.join(here, '../src/main.js'), 'utf8');
const html = fs.readFileSync(path.join(here, '../index.html'), 'utf8');

test('mature variants provide colored bud clusters without replacing leaf materials', () => {
  assert.ok(MATURE_BUD_CLUSTERS.length >= 12);
  assert.deepEqual(matureBudVariant('QQQ'), { ticker: 'QQQ', color: '#6c20a3', clusters: MATURE_BUD_CLUSTERS });
  assert.match(main, /createMatureBudOverlay\(pot\.seedTicker\)/);
  assert.doesNotMatch(main, /leafMat\.color\.set/);
  assert.doesNotMatch(main, /lightLeafMat\.color\.set/);
});

test('game plants the selected ticker and rebuilds the matching mature visual', () => {
  assert.match(main, /plantSeed\(pot,state\.seeds,tickerForSlot\(state\.slot\)\)/);
  assert.match(main, /Object\.assign\(pot,result\.pot\)/);
  assert.match(main, /seedTicker:index===0\?'HOOD':null/);
  assert.match(main, /state\.claimableStocks\[result\.ticker\]/);
});

test('hotbar colors are applied from the seed catalog rather than duplicated inline', () => {
  assert.doesNotMatch(html, /--seed-color:/);
  assert.match(main, /SEED_VARIETIES/);
  assert.match(main, /style\.setProperty\('--seed-color',color\)/);
});

test('entering player mode assigns and loads one stable random local skin', () => {
  assert.match(main, /assignSessionPlayerSkin\(state\)/);
  assert.match(main, /loadLocalPlayerSkin\(state\.playerSkin\)/);
  assert.match(main, /localPlayerSkinKey===skin\.key/);
  assert.match(main, /material\.colorWrite=false/);
  assert.match(main, /localPlayerMixer\?\.update\(dt\)/);
});

test('QA can force and inspect a mature ticker variant without changing production input flow', () => {
  assert.match(main, /setPot\(index,growth,seedTicker/);
  assert.match(main, /plantVariant\(index\)/);
});
