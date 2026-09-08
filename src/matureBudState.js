import { budColorForTicker } from './seedVarietyState.js';

export const MATURE_BUD_CLUSTERS = Object.freeze([
  Object.freeze([0, 1.39, 0]),
  Object.freeze([0.2, 1.27, 0.03]),
  Object.freeze([-0.19, 1.24, -0.04]),
  Object.freeze([0.1, 1.16, 0.19]),
  Object.freeze([-0.08, 1.13, -0.2]),
  Object.freeze([0.28, 1.05, -0.1]),
  Object.freeze([-0.27, 1.02, 0.1]),
  Object.freeze([0.17, 0.94, 0.2]),
  Object.freeze([-0.16, 0.91, -0.21]),
  Object.freeze([0.29, 0.82, 0.08]),
  Object.freeze([-0.29, 0.8, -0.07]),
  Object.freeze([0.08, 0.72, -0.2]),
  Object.freeze([-0.07, 0.69, 0.2]),
  Object.freeze([0, 0.61, 0]),
]);

export function matureBudVariant(ticker) {
  return { ticker, color: budColorForTicker(ticker), clusters: MATURE_BUD_CLUSTERS };
}
