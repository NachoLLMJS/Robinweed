export const STAGES = [
  { name: 'Empty pot', min: 0 },
  { name: 'Seed', min: 1 },
  { name: 'Sprout', min: 2 },
  { name: 'Vegetative', min: 4 },
  { name: 'Flowering', min: 7 },
  { name: 'Ready to harvest', min: 10 },
];

export function stageFor(growth) {
  let stage = 0;
  STAGES.forEach((entry, index) => {
    if (growth >= entry.min) stage = index;
  });
  return stage;
}

export function plantSeed(pot, seeds) {
  if (pot.growth !== 0 || seeds < 1) return { pot, seeds, changed: false };
  return { pot: { ...pot, growth: 1, water: 35 }, seeds: seeds - 1, changed: true };
}

export function waterPlant(pot) {
  if (pot.growth < 1 || pot.growth >= 10 || pot.water >= 90) return { ...pot };
  return { ...pot, water: Math.min(100, pot.water + 34), growth: Math.min(10, pot.growth + 1) };
}

export function harvestPlant(pot) {
  if (stageFor(pot.growth) !== 5) return { pot, buds: 0, changed: false };
  const buds = 2 + Math.floor(pot.water / 34);
  return { pot: { growth: 0, water: 0 }, buds, changed: true };
}
