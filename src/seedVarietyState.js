export const SEED_VARIETIES = Object.freeze([
  Object.freeze({ slot: 2, ticker: 'HOOD', color: '#00c805' }),
  Object.freeze({ slot: 3, ticker: 'MSFT', color: '#258ffa' }),
  Object.freeze({ slot: 4, ticker: 'TSLA', color: '#e82127' }),
  Object.freeze({ slot: 5, ticker: 'NVDA', color: '#76b900' }),
  Object.freeze({ slot: 6, ticker: 'MSTR', color: '#e31837' }),
  Object.freeze({ slot: 7, ticker: 'AAPL', color: '#707780' }),
  Object.freeze({ slot: 8, ticker: 'QQQ', color: '#6c20a3' }),
  Object.freeze({ slot: 9, ticker: 'GOOGL', color: '#4285f4' }),
]);

const BY_SLOT = new Map(SEED_VARIETIES.map(entry => [entry.slot, entry]));
const BY_TICKER = new Map(SEED_VARIETIES.map(entry => [entry.ticker, entry]));

export function tickerForSlot(slot) {
  return BY_SLOT.get(slot)?.ticker ?? null;
}

export function budColorForTicker(ticker) {
  return BY_TICKER.get(ticker)?.color ?? SEED_VARIETIES[0].color;
}
