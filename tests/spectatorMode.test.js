import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECTATOR_IDENTITY,
  SPECTATOR_STARTING_SEEDS,
  buySpectatorSeedPack,
  createSpectatorSession,
  purchaseSpectatorProperty,
  spectatorPropertyAccess,
  waterSpectatorPlant,
} from '../src/spectatorMode.js';

test('spectator starts with local demo inventory and no wallet identity', () => {
  const session = createSpectatorSession();
  assert.equal(session.identity, SPECTATOR_IDENTITY);
  assert.equal(session.tokenBalance, 'DEMO');
  assert.equal(session.seeds, SPECTATOR_STARTING_SEEDS);
  assert.equal(session.buds, 0);
  assert.deepEqual(session.claimableStocks, {});
  assert.equal(Object.hasOwn(session, 'walletAddress'), false);
});

test('spectator seed purchases mutate only demo inventory', () => {
  assert.equal(buySpectatorSeedPack(3), 7);
  assert.equal(buySpectatorSeedPack(3, 2), 11);
  assert.throws(() => buySpectatorSeedPack(-1), /INVALID_SPECTATOR_INVENTORY/);
});

test('spectator watering accelerates the local crop to a harvestable demo stage', () => {
  const source = { growth: 1, water: 0, wateredAt: null, seedTicker: 'NVDA' };
  const result = waterSpectatorPlant(source, 1234);
  assert.deepEqual(result, { growth: 10, water: 100, wateredAt: 1234, seedTicker: 'NVDA' });
  assert.deepEqual(source, { growth: 1, water: 0, wateredAt: null, seedTicker: 'NVDA' });
});

test('spectator property ownership is explicitly offchain and local', () => {
  const property = { id: 'RW-001', owner: null, mode: 'UNOWNED', capacity: 4 };
  const purchased = purchaseSpectatorProperty(property);
  assert.equal(purchased.owner, SPECTATOR_IDENTITY);
  assert.equal(purchased.mode, 'OFFCHAIN_DEMO');
  assert.equal(spectatorPropertyAccess(purchased), 'OWNER');
  assert.equal(spectatorPropertyAccess(property), 'AVAILABLE');
});
