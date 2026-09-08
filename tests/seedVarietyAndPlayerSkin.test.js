import test from 'node:test';
import assert from 'node:assert/strict';
import { plantSeed, waterPlant, harvestPlant } from '../src/plantState.js';
import {
  SEED_VARIETIES,
  tickerForSlot,
  budColorForTicker,
} from '../src/seedVarietyState.js';
import {
  PLAYER_SKINS,
  assignSessionPlayerSkin,
} from '../src/playerSkinState.js';

const EXPECTED = [
  { slot: 2, ticker: 'HOOD', color: '#00c805' },
  { slot: 3, ticker: 'MSFT', color: '#258ffa' },
  { slot: 4, ticker: 'TSLA', color: '#e82127' },
  { slot: 5, ticker: 'NVDA', color: '#76b900' },
  { slot: 6, ticker: 'MSTR', color: '#e31837' },
  { slot: 7, ticker: 'AAPL', color: '#707780' },
  { slot: 8, ticker: 'QQQ', color: '#6c20a3' },
  { slot: 9, ticker: 'GOOGL', color: '#4285f4' },
];

test('seed variety catalog is the single ordered slot-to-bud-color mapping', () => {
  assert.deepEqual(SEED_VARIETIES, EXPECTED);
  EXPECTED.forEach(({ slot, ticker, color }) => {
    assert.equal(tickerForSlot(slot), ticker);
    assert.equal(budColorForTicker(ticker), color);
  });
});

test('a planted pot keeps its seed ticker through growth and clears it after harvest', () => {
  const planted = plantSeed({ growth: 0, water: 0, seedTicker: null }, 2, 'QQQ');
  assert.equal(planted.pot.seedTicker, 'QQQ');
  const watered = waterPlant({ ...planted.pot, water: 0 });
  assert.equal(watered.seedTicker, 'QQQ');
  const harvested = harvestPlant({ growth: 10, water: 82, seedTicker: 'QQQ' });
  assert.equal(harvested.pot.seedTicker, null);
});

test('player skin is chosen from the two walkers once per session', () => {
  assert.deepEqual(PLAYER_SKINS, [
    { key: 'fox', url: '/models-v30/characters/fox-walk.glb?v=1' },
    { key: 'neonCat', url: '/models-v31/characters/neon-cat-walk.glb?v=1' },
  ]);
  const foxSession = assignSessionPlayerSkin({}, () => 0.1);
  assert.equal(foxSession.playerSkin.key, 'fox');
  assert.strictEqual(assignSessionPlayerSkin(foxSession, () => 0.9), foxSession);
  assert.equal(foxSession.playerSkin.key, 'fox');
  assert.equal(assignSessionPlayerSkin({}, () => 0.9).playerSkin.key, 'neonCat');
});
