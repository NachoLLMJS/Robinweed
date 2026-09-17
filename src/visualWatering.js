export const VISUAL_WATER_HOLD_MS = 2000;
export const VISUAL_WATER_DROPS_PER_SECOND = 24;
export const VISUAL_WATER_MAX_DROPS_PER_FRAME = 3;
export const VISUAL_WATER_MAX_LIVE_DROPS = 40;

export function beginVisualWatering(potIndex, startedAt = performance.now()) {
  if (!Number.isSafeInteger(potIndex) || potIndex < 0) throw new TypeError('Invalid pot index');
  return Object.freeze({ potIndex, startedAt, heldMs: 0, progress: 0, complete: false });
}

export function advanceVisualWatering(session, wallDeltaMs) {
  if (!session || !Number.isSafeInteger(session.potIndex)) throw new TypeError('Invalid visual watering session');
  const delta = Number.isFinite(wallDeltaMs) ? Math.max(0, wallDeltaMs) : 0;
  const heldMs = Math.min(VISUAL_WATER_HOLD_MS, session.heldMs + delta);
  const progress = heldMs / VISUAL_WATER_HOLD_MS;
  return Object.freeze({
    potIndex: session.potIndex,
    startedAt: session.startedAt,
    heldMs,
    progress,
    complete: progress >= 1,
  });
}

export function visualWaterDrops(carry, deltaSeconds, liveDrops) {
  const safeCarry = Number.isFinite(carry) ? Math.max(0, carry) : 0;
  const safeDelta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.125, deltaSeconds)) : 0;
  const live = Number.isFinite(liveDrops) ? Math.max(0, Math.floor(liveDrops)) : 0;
  const requested = safeCarry + safeDelta * VISUAL_WATER_DROPS_PER_SECOND;
  const emitted = Math.min(
    Math.floor(requested),
    VISUAL_WATER_MAX_DROPS_PER_FRAME,
    Math.max(0, VISUAL_WATER_MAX_LIVE_DROPS - live),
  );
  return Object.freeze({ emitted, carry: requested - Math.floor(requested) });
}
