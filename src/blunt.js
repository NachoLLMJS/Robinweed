import { budColorForTicker } from './seedVarietyState.js';

export const BLUNT_BUD_COST = 3;
export const DEFAULT_BLUNT_TICKER = 'HOOD';
export const BLUNT_GRADES = Object.freeze([
  Object.freeze({ key: 'reserve', label: 'HOUSE RESERVE', minStock: 9, potency: 1 }),
  Object.freeze({ key: 'shelf', label: 'TOP SHELF', minStock: 6, potency: 0.8 }),
  Object.freeze({ key: 'street', label: 'STREET ROLL', minStock: 3, potency: 0.55 }),
]);

const wholeBuds = value => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function bluntGradeFor(stock) {
  return BLUNT_GRADES.find(grade => stock >= grade.minStock) ?? null;
}

export function strongestStrain(claimableStocks = {}) {
  let strongest = null;
  let most = 0;
  for (const [ticker, raw] of Object.entries(claimableStocks ?? {})) {
    const stock = wholeBuds(raw);
    if (stock >= BLUNT_BUD_COST && stock > most) {
      strongest = ticker;
      most = stock;
    }
  }
  return strongest;
}

export function pickBluntTicker({ slotTicker = null, claimableStocks = {} } = {}) {
  return slotTicker || strongestStrain(claimableStocks) || DEFAULT_BLUNT_TICKER;
}

export function rollBlunt({ buds: rawBuds, ticker } = {}, now = Date.now()) {
  const buds = wholeBuds(rawBuds);
  if (!ticker) return { buds, blunt: null, changed: false, reason: 'NO_STRAIN' };
  if (buds < BLUNT_BUD_COST) return { buds, blunt: null, changed: false, reason: 'NOT_ENOUGH_BUDS' };
  const grade = bluntGradeFor(buds);
  return {
    buds: buds - BLUNT_BUD_COST,
    blunt: {
      ticker,
      color: budColorForTicker(ticker),
      grade: grade.key,
      label: grade.label,
      potency: grade.potency,
      rolledAt: now,
    },
    changed: true,
    reason: 'ROLLED',
  };
}
