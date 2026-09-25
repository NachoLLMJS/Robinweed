import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('runtime hides every unowned on-chain seed package and guards slot selection', () => {
  assert.match(main, /from '\.\/onchainSeedInventory\.js'/);
  assert.match(main, /function syncOnchainSeedHotbar\(\)/);
  assert.match(main, /visibleOnchainSeedSlots\(state\.onchainSnapshot\)/);
  assert.match(main, /canEquipOnchainSeedSlot\(state\.onchainSnapshot,slot\)/);
  assert.match(main, /NO SEEDS · BUY A PACK ONCHAIN/);
  assert.match(css, /\.hotbar button\.locked\s*\{[^}]*display:none/i);
});

test('authoritative snapshot refresh repaints the hotbar and drops a depleted equipped pack', () => {
  assert.match(main, /state\.onchainSnapshot=snapshot;[^\n]*syncOnchainSeedSelection\(\);[^\n]*refresh\(\)/);
  assert.match(main, /function syncOnchainSeedSelection\(\)/);
  assert.match(main, /state\.slot=0/);
  assert.match(main, /syncOnchainSeedHotbar\(\)/);
});
test('on-chain planting rechecks ownership immediately before sending a transaction', () => {
  assert.match(main, /async function useOnchainTool/);
  assert.match(main, /if\(!canEquipOnchainSeedSlot\(state\.onchainSnapshot,state\.slot\)\)/);
  assert.match(main, /NO \$\{ticker\} SEEDS · SELECT \$\{ownedTickers\.join/);
  assert.match(main, /NO SEEDS · BUY A PACK ONCHAIN/);
});
