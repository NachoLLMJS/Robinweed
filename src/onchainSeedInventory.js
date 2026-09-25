import { SEED_VARIETIES, tickerForSlot } from './seedVarietyState.js';

const TOOL_SLOTS = Object.freeze([0, 1]);
const ONCHAIN_TICKERS = new Set(SEED_VARIETIES.map(({ ticker }) => ticker).filter(ticker => ticker !== 'HOOD'));

export function remainingOnchainSeeds(snapshot, ticker) {
  if (!ONCHAIN_TICKERS.has(ticker)) return 0n;
  const raw = snapshot?.seeds?.[ticker]?.remaining;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function ownsOnchainSeedPack(snapshot, ticker) {
  return remainingOnchainSeeds(snapshot, ticker) > 0n;
}

export function visibleOnchainSeedSlots(snapshot) {
  return new Set([
    ...TOOL_SLOTS,
    ...SEED_VARIETIES
      .filter(({ ticker }) => ownsOnchainSeedPack(snapshot, ticker))
      .map(({ slot }) => slot),
  ]);
}

export function canEquipOnchainSeedSlot(snapshot, slot) {
  if (TOOL_SLOTS.includes(slot)) return true;
  const ticker = tickerForSlot(slot);
  return Boolean(ticker) && ownsOnchainSeedPack(snapshot, ticker);
}

export function firstOwnedOnchainSeedSlot(snapshot) {
  return SEED_VARIETIES.find(({ ticker }) => ownsOnchainSeedPack(snapshot, ticker))?.slot ?? null;
}
