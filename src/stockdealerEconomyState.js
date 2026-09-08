export const RENTAL_TIERS = Object.freeze([
  Object.freeze({ id: 'small', label: 'SMALL GROW HOUSE', capacity: 4, weeklyPrice: 1000 }),
  Object.freeze({ id: 'medium', label: 'MEDIUM GROW HOUSE', capacity: 8, weeklyPrice: 2000 }),
  Object.freeze({ id: 'large', label: 'LARGE GROW HOUSE', capacity: 15, weeklyPrice: null }),
]);

export const HOUSE_LISTINGS = Object.freeze([
  Object.freeze({ id: 'RW-042-E', tierId: 'small', district: 'EAST ROW' }),
  Object.freeze({ id: 'RW-050-E', tierId: 'medium', district: 'EAST ROW' }),
  Object.freeze({ id: 'RW-102-W', tierId: 'large', district: 'WEST ROW' }),
]);

export const TOKENIZED_STOCK_CONTRACTS = Object.freeze({
  HOOD: null,
  MSFT: '0xe93237c50d904957cf27e7b1133b510c669c2e74',
  TSLA: '0x322f0929c4625ed5bad873c95208d54e1c003b2d',
  NVDA: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',
  MSTR: '0xec262a75e413fafd0df80480274532c79d42da09',
  AAPL: '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9',
  QQQ: '0xd5f3879160bc7c32ebb4dc785f8a4f505888de68',
  GOOGL: '0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3',
});

export function rentalQuote(tierId, duration) {
  const tier = RENTAL_TIERS.find(candidate => candidate.id === tierId);
  if (!tier || !['week', 'month'].includes(duration)) return null;
  const multiplier = duration === 'month' ? 4 : 1;
  return {
    tokenCost: tier.weeklyPrice === null ? null : tier.weeklyPrice * multiplier,
    durationDays: duration === 'month' ? 28 : 7,
    capacity: tier.capacity,
  };
}

export function createPreviewRental(listingId, duration, now = Date.now()) {
  const listing = HOUSE_LISTINGS.find(candidate => candidate.id === listingId);
  if (!listing) return null;
  const quote = rentalQuote(listing.tierId, duration);
  if (!quote || quote.tokenCost === null) return null;
  return {
    mode: 'FRONTEND_PREVIEW',
    listingId,
    tierId: listing.tierId,
    duration,
    capacity: quote.capacity,
    tokenCost: quote.tokenCost,
    startsAt: now,
    expiresAt: now + quote.durationDays * 24 * 60 * 60 * 1000,
    owner: null,
  };
}

export function rentalIsActive(rental, now = Date.now()) {
  return Boolean(rental && rental.startsAt <= now && now < rental.expiresAt);
}

export function splitStockdealerSpend(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  return { rewardPool: amount * 0.6, burned: amount * 0.4 };
}

export function routeStockdealerSpend(amount, ticker = null) {
  const split = splitStockdealerSpend(amount);
  if (!split) return null;
  return {
    stockdealerIn: amount,
    burned: split.burned,
    rewardSwap: {
      allocation: ticker ? 'TICKER' : 'CROP_LIABILITY_BASKET',
      ticker,
      stockdealerIn: split.rewardPool,
      tokenizedStockOut: null,
    },
  };
}

export function claimAssetForHarvest(ticker) {
  if (!Object.hasOwn(TOKENIZED_STOCK_CONTRACTS, ticker)) return null;
  const contract = TOKENIZED_STOCK_CONTRACTS[ticker];
  return { ticker, contract, claimReady: contract !== null };
}
