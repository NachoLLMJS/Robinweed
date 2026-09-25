export const HIGH_TOTAL_MS = 20000;
export const IDLE_HIGH = Object.freeze({
  phase: 'idle', elapsed: 0, active: false, exhaling: false, intensity: 0,
  fovOffset: 0, swayRoll: 0, tint: 0, vignette: 0, ember: 0,
  lipReach: 0, secondsLeft: 0,
});

const SMOKE_WIND = Object.freeze({
  street: Object.freeze({ x: 0.14, z: -0.02 }),
  warehouse: Object.freeze({ x: 0.05, z: 0 }),
  'shop-interior': Object.freeze({ x: 0.03, z: 0 }),
  'house-interior': Object.freeze({ x: 0.03, z: 0 }),
  'restaurant-interior': Object.freeze({ x: 0.04, z: 0 }),
});
const DEFAULT_WIND = Object.freeze({ x: 0.05, z: 0 });
const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (from, to, amount) => from + (to - from) * clamp01(amount);

export function smokeWindFor(location) {
  return SMOKE_WIND[location] ?? DEFAULT_WIND;
}

export function beginHigh(potency = 1, now = Date.now()) {
  return { startedAt: now, potency: clamp01(Number(potency) || 0) };
}

export function highPhaseAt(elapsed) {
  if (elapsed < 900) return 'draw';
  if (elapsed < 1500) return 'hold';
  if (elapsed < 2900) return 'exhale';
  if (elapsed < HIGH_TOTAL_MS) return 'haze';
  return 'idle';
}

export function sampleHigh(session, now = Date.now()) {
  if (!session || !Number.isFinite(session.startedAt) || !Number.isFinite(now)) return IDLE_HIGH;
  const elapsed = now - session.startedAt;
  if (elapsed < 0 || elapsed >= HIGH_TOTAL_MS) return IDLE_HIGH;
  const phase = highPhaseAt(elapsed);
  let intensity = 0;
  let ember = 0.34;
  let lipReach = 0;
  if (phase === 'draw') {
    const progress = elapsed / 900;
    intensity = lerp(0, 0.15, progress); ember = lerp(0.34, 1, progress); lipReach = clamp01(progress);
  } else if (phase === 'hold') {
    const progress = (elapsed - 900) / 600;
    intensity = lerp(0.15, 0.35, progress); ember = 1; lipReach = 1;
  } else if (phase === 'exhale') {
    const progress = (elapsed - 1500) / 1400;
    intensity = lerp(0.35, 1, progress); ember = lerp(1, 0.42, progress); lipReach = 1 - clamp01(progress);
  } else {
    const progress = clamp01((elapsed - 2900) / (HIGH_TOTAL_MS - 2900));
    intensity = (Math.cos(progress * Math.PI) + 1) / 2;
  }
  const weight = clamp01(intensity) * clamp01(Number(session.potency) || 0);
  return {
    phase, elapsed, active: true, exhaling: phase === 'exhale', intensity: clamp01(intensity),
    fovOffset: weight * 7,
    swayRoll: weight * 0.03,
    tint: weight * 0.22,
    vignette: weight * 0.55,
    ember: clamp01(ember),
    lipReach: clamp01(lipReach),
    secondsLeft: Math.ceil((HIGH_TOTAL_MS - elapsed) / 1000),
  };
}
