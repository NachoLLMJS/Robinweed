import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const forbiddenImports = [
  'additiveState', 'blunt', 'gameClock', 'growCabinState', 'growConfig',
  'growPersistence', 'growTierState', 'harvestLotState', 'harvestQualityState',
  'lotVisualState', 'moistureState', 'objectiveState', 'sandboxClock',
  'seedStockState', 'shelfBankState', 'strainState', 'wateringSession',
];

test('production client excludes prototype cultivation and shelf-bank systems', () => {
  for (const moduleName of forbiddenImports) assert.doesNotMatch(main, new RegExp(`from ['\"]\\./${moduleName}`));
  assert.doesNotMatch(main, /SHELF_BANK_LAYOUT|shelfPotPositions|shelfBankPieces/);
});

test('no visual dev panel is shipped to players', () => {
  assert.doesNotMatch(html, /sdLightPanel|light-panel/);
});

test('active onchain player economy cannot advance plants from the local clock', () => {
  assert.match(main, /pots\.forEach\(p=>\{if\(state\.mode==='spectator'\|\|!economyConfig\.economyActive\)\{const next=advancePlant\(p\)/);
  assert.doesNotMatch(main, /pots\.forEach\(p=>\{const next=advancePlant\(p\)/);
});
