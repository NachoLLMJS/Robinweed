import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUSEHEAD_SWAP_ROUTE, isHouseheadNearby, nextHouseheadPanel } from '../src/househeadSwapState.js';

test('househead conversation opens a question before the swap preview', () => {
  assert.equal(nextHouseheadPanel('closed', 'talk'), 'question');
  assert.equal(nextHouseheadPanel('question', 'accept'), 'swap');
});

test('declining or closing always returns to gameplay', () => {
  assert.equal(nextHouseheadPanel('question', 'decline'), 'closed');
  assert.equal(nextHouseheadPanel('swap', 'close'), 'closed');
});

test('talk prompt is driven by proximity rather than exact aim', () => {
  const npc = { x: -5.1, z: 18.15 };
  assert.equal(isHouseheadNearby({ x: -2.55, z: 18.15 }, npc), true);
  assert.equal(isHouseheadNearby({ x: -2.35, z: 18.15 }, npc), false);
});

test('househead route is fixed to ETH into $STOCKDEALER and cannot execute', () => {
  assert.deepEqual(HOUSEHEAD_SWAP_ROUTE, {
    inputSymbol: 'ETH',
    outputSymbol: '$STOCKDEALER',
    network: 'Robinhood Chain',
    executable: false,
  });
});

test('game wires proximity talk, confirmation, and orientation-only swap panels', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="househeadQuestion"/);
  assert.match(html, /SWAP ETH FOR \$STOCKDEALER/);
  assert.match(html, /id="househeadYes"/);
  assert.match(html, /id="househeadNo"/);
  assert.match(html, /id="stockdealerSwap"/);
  assert.match(html, /YOU PAY[\s\S]*ETH[\s\S]*YOU RECEIVE[\s\S]*\$STOCKDEALER/);
  assert.match(html, /ORIENTATION ONLY — SWAP UNAVAILABLE/);
  assert.match(main, /type:'househead'/);
  assert.match(html, /MEADGod · TOKEN GUIDE/);
  assert.match(html, /MEADGod SWAP DESK/);
  assert.match(main, /\[ E \] TALK TO MEADGod/);
  assert.match(main, /househeadYes\.addEventListener/);
  assert.match(main, /househeadNo\.addEventListener/);
});
