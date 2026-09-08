export const STAGES = [
  { name: 'Empty pot', min: 0 },
  { name: 'Seed', min: 1 },
  { name: 'Sprout', min: 2 },
  { name: 'Vegetative', min: 4 },
  { name: 'Flowering', min: 7 },
  { name: 'Ready to harvest', min: 10 },
];

export const GROWTH_STEP_MS = 2 * 60 * 60 * 1000;
const TIMED_GROWTH_VALUES = Object.freeze([1, 2, 4, 7, 10]);

export function stageFor(growth) {
  let stage = 0;
  STAGES.forEach((entry, index) => {
    if (growth >= entry.min) stage = index;
  });
  return stage;
}

export function plantSeed(pot, seeds, seedTicker = 'HOOD', now = Date.now()) {
  if (pot.growth !== 0 || seeds < 1) return { pot, seeds, changed: false };
  return {
    pot: { ...pot, growth: 1, water: 0, seedTicker, plantedAt: now, wateredAt: null },
    seeds: seeds - 1,
    changed: true,
  };
}

export function waterPlant(pot, now = Date.now()) {
  if (pot.growth < 1 || pot.growth >= 10 || pot.wateredAt != null) return { ...pot };
  return { ...pot, water: 100, wateredAt: now };
}

export function advancePlant(pot, now = Date.now()) {
  if (pot.growth < 1 || pot.growth >= 10 || pot.wateredAt == null) return { ...pot };
  const elapsedSteps = Math.max(0, Math.floor((now - pot.wateredAt) / GROWTH_STEP_MS));
  return { ...pot, growth: TIMED_GROWTH_VALUES[Math.min(elapsedSteps, TIMED_GROWTH_VALUES.length - 1)] };
}

export function harvestPlant(pot, now = Date.now()) {
  const current = advancePlant(pot, now);
  if (stageFor(current.growth) !== 5) return { pot: current, buds: 0, ticker: null, changed: false };
  const buds = 2 + Math.floor(current.water / 34);
  return {
    pot: { growth: 0, water: 0, seedTicker: null, plantedAt: null, wateredAt: null },
    buds,
    ticker: current.seedTicker || 'HOOD',
    changed: true,
  };
}
