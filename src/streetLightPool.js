// Seis PointLight reales que se reasignan a los faroles mas cercanos.
// La cantidad de luces NUNCA cambia: si cambiara, three recompila los 510 materiales
// de la escena en pleno movimiento. Solo se mueven de farol a farol.
export const STREET_LIGHT_POOL = Object.freeze({
  slots: 6,
  color: 0xffc66d,
  intensity: 11,
  distance: 13,
  decay: 1.7,
  height: 3.05,
  acquireRadius: 13,
  releaseRadius: 14.5,
  updateMs: 160,
  parkAt: Object.freeze({ x: 0, y: -60, z: 0 }),
  poolRadius: 6.2,
  poolTint: Object.freeze([255, 198, 109]),
  poolOpacityIdle: 0.19,
  poolOpacityLit: 0.06,
  flicker: 0.18,
});

export function lampDistance(cameraX, cameraZ, lamp) {
  return Math.hypot(lamp.x - cameraX, lamp.z - cameraZ);
}

export function shouldRecomputePool(lastAt, now, updateMs = STREET_LIGHT_POOL.updateMs) {
  return !(now - lastAt < updateMs);
}

export function assignLightSlots(previous, cameraX, cameraZ, lamps, config = STREET_LIGHT_POOL) {
  const slots = new Array(config.slots).fill(null);
  const taken = new Set();
  for (let slot = 0; slot < config.slots; slot++) {
    const lampIndex = previous?.[slot];
    if (lampIndex === null || lampIndex === undefined) continue;
    const lamp = lamps[lampIndex];
    if (!lamp) continue;
    if (lampDistance(cameraX, cameraZ, lamp) > config.releaseRadius) continue;
    slots[slot] = lampIndex;
    taken.add(lampIndex);
  }
  const candidates = lamps
    .map((lamp, index) => ({ index, distance: lampDistance(cameraX, cameraZ, lamp) }))
    .filter(entry => entry.distance <= config.acquireRadius && !taken.has(entry.index))
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  let cursor = 0;
  for (let slot = 0; slot < config.slots && cursor < candidates.length; slot++) {
    if (slots[slot] !== null) continue;
    slots[slot] = candidates[cursor++].index;
  }
  return slots;
}

export function poolPlacement(slots, lamps, config = STREET_LIGHT_POOL) {
  return slots.map(lampIndex => {
    if (lampIndex === null || lampIndex === undefined || !lamps[lampIndex]) {
      return { lampIndex: null, x: config.parkAt.x, y: config.parkAt.y, z: config.parkAt.z, intensity: 0 };
    }
    const lamp = lamps[lampIndex];
    return { lampIndex, x: lamp.x, y: config.height, z: lamp.z, intensity: config.intensity };
  });
}
