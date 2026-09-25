import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEquipOnchainSeedSlot,
  firstOwnedOnchainSeedSlot,
  ownsOnchainSeedPack,
  remainingOnchainSeeds,
  visibleOnchainSeedSlots,
} from '../src/onchainSeedInventory.js';

const snapshot = values => ({
  seeds: Object.fromEntries(Object.entries(values).map(([ticker, remaining]) => [ticker, { remaining: String(remaining) }])),
});

test('a disconnected or empty wallet sees only watering can and trimmers', () => {
  assert.deepEqual([...visibleOnchainSeedSlots(null)], [0, 1]);
  assert.deepEqual([...visibleOnchainSeedSlots({ seeds: {} })], [0, 1]);
  for (let slot = 2; slot <= 9; slot += 1) {
    assert.equal(canEquipOnchainSeedSlot(null, slot), false);
    assert.equal(canEquipOnchainSeedSlot({ seeds: {} }, slot), false);
  }
});

test('only purchased on-chain seed packs appear and can be equipped', () => {
  const owned = snapshot({ MSFT: 4, TSLA: 0, QQQ: 2 });
  assert.deepEqual([...visibleOnchainSeedSlots(owned)], [0, 1, 3, 8]);
  assert.equal(ownsOnchainSeedPack(owned, 'MSFT'), true);
  assert.equal(ownsOnchainSeedPack(owned, 'QQQ'), true);
  assert.equal(ownsOnchainSeedPack(owned, 'TSLA'), false);
  assert.equal(canEquipOnchainSeedSlot(owned, 3), true);
  assert.equal(canEquipOnchainSeedSlot(owned, 8), true);
  assert.equal(canEquipOnchainSeedSlot(owned, 4), false);
  assert.equal(firstOwnedOnchainSeedSlot(owned), 3);
});

test('after the last seed is spent its package disappears and cannot be equipped', () => {
  const before = snapshot({ TSLA: 1 });
  const after = snapshot({ TSLA: 0 });
  assert.deepEqual([...visibleOnchainSeedSlots(before)], [0, 1, 4]);
  assert.equal(canEquipOnchainSeedSlot(before, 4), true);
  assert.deepEqual([...visibleOnchainSeedSlots(after)], [0, 1]);
  assert.equal(canEquipOnchainSeedSlot(after, 4), false);
  assert.equal(firstOwnedOnchainSeedSlot(after), null);
});

test('remaining balances are parsed fail-closed without unsafe Number conversion', () => {
  const huge = '900719925474099300006';
  const state = snapshot({ NVDA: huge, AAPL: '-1', GOOGL: 'nope' });
  assert.equal(remainingOnchainSeeds(state, 'NVDA'), BigInt(huge));
  assert.equal(remainingOnchainSeeds(state, 'AAPL'), 0n);
  assert.equal(remainingOnchainSeeds(state, 'GOOGL'), 0n);
  assert.equal(remainingOnchainSeeds(state, 'HOOD'), 0n, 'HOOD has no on-chain stock token');
  assert.equal(ownsOnchainSeedPack(state, 'NVDA'), true);
  assert.equal(ownsOnchainSeedPack(state, 'AAPL'), false);
  assert.equal(canEquipOnchainSeedSlot(state, 99), false);
  assert.equal(canEquipOnchainSeedSlot(state, 0), true);
  assert.equal(canEquipOnchainSeedSlot(state, 1), true);
});
