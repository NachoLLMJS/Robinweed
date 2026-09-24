export const SPECTATOR_IDENTITY = 'DEMO PLAYER';
export const SPECTATOR_STARTING_SEEDS = 24;
export const SPECTATOR_SEED_PACK_SIZE = 4;

export function createSpectatorSession() {
  return Object.freeze({
    identity: SPECTATOR_IDENTITY,
    tokenBalance: 'DEMO',
    seeds: SPECTATOR_STARTING_SEEDS,
    buds: 0,
    claimableStocks: {},
  });
}

export function buySpectatorSeedPack(seeds, packs = 1) {
  if (!Number.isSafeInteger(seeds) || seeds < 0 || !Number.isSafeInteger(packs) || packs < 1) {
    throw new Error('INVALID_SPECTATOR_INVENTORY');
  }
  return seeds + packs * SPECTATOR_SEED_PACK_SIZE;
}

export function waterSpectatorPlant(pot, now = Date.now()) {
  if (!pot || pot.growth < 1 || pot.growth >= 10 || pot.wateredAt != null) return { ...pot };
  return { ...pot, growth: 10, water: 100, wateredAt: now };
}

export function purchaseSpectatorProperty(property) {
  if (!property || property.owner) return null;
  return Object.freeze({ ...property, owner: SPECTATOR_IDENTITY, mode: 'OFFCHAIN_DEMO' });
}

export function spectatorPropertyAccess(property) {
  if (!property?.owner) return 'AVAILABLE';
  return property.mode === 'OFFCHAIN_DEMO' && property.owner === SPECTATOR_IDENTITY ? 'OWNER' : 'OCCUPIED';
}
