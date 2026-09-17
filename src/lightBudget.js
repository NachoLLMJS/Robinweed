// Presupuesto de luces. El problema medido no es "faltan luces": son 43, de las
// cuales 42 estan encendidas SIEMPRE, en toda ubicacion. Cada material Standard
// compila un loop de ~40 point lights que se ejecuta en cada fragmento de la
// pantalla, incluso estando adentro del galpon con la ciudad detras de la pared.
//
// La solucion NO es apagar luces con .visible=false: three arma los arrays de
// uniforms recorriendo la escena y saltea lo invisible, asi que apagar una luz
// CAMBIA NUM_POINT_LIGHTS y obliga a recompilar el programa de cada material.
// En cambio, un pool de tamaño FIJO que se reasigna nunca cambia el conteo:
// se compila una sola vez, a 8 en vez de a 40.
import { STREET_LIGHT_POOL, assignLightSlots, lampDistance, poolPlacement } from './streetLightPool.js';
import { GROW_LIGHT } from './lightZoneState.js';

export const POINT_BUDGET = Object.freeze({
  slots: 8,
  acquireRadius: 15,
  releaseRadius: 17,
  updateMs: STREET_LIGHT_POOL.updateMs,
  parkAt: STREET_LIGHT_POOL.parkAt,
});

export const SPOT_BUDGET = Object.freeze({
  slots: 4,
  acquireRadius: 3,
  releaseRadius: 3.8,
  updateMs: STREET_LIGHT_POOL.updateMs,
  parkAt: STREET_LIGHT_POOL.parkAt,
});

// Conteo real de la escena de hoy, medido en Chrome con GPU (04-RECON, seccion render).
export const LEGACY_LIGHT_CENSUS = Object.freeze({
  total: 43,
  visibleInStreet: 42,
  visibleInWarehouse: 43,
  withShadow: 0,
  points: 40,
});

// Toda luz puntual del juego, con la sala a la que pertenece. Las posiciones salen
// de las mismas tablas que usa main.js: si la ciudad se mueve, esto se mueve con ella.
//
// Cada luminaria lleva DOS juegos de numeros: el nuevo (arriba) y el `legacy`, que es el
// del juego de hoy, leido de `src/main.js` en 7e1f1b0 (ver tests/fixtures/legacy-scene-*.json).
// Sin el legacy, el preset 0 encendia el galpon y los interiores con la intensidad NUEVA
// -- hasta 2,8x -- y el A/B comparaba la noche nueva contra un pasado ya retocado.
//
// `pulse` copia otra cosa que el juego de hoy hace y no es obvia: solo los faroles y los
// carteles de la calle titilan (+/-0,18); los plafones del galpon y de los interiores son
// fijos. El pool los hacia titilar a todos.
//
// `phase` es el indice con el que titila cada luminaria. El juego de hoy usa su posicion
// en `streetLights`, y ese orden es un accidente de carga: los cuatro carteles se empujan
// de forma sincrona (0-3) y los 18 faroles despues, cuando cae el GLB (4-21). Medido en
// Chrome resolviendo la fase desde dos muestras de intensidad: error 0 en las 22. El pool
// titilaba por numero de SLOT, asi que la fase de un farol saltaba al cambiar de slot.
const legacy = (intensity, distance, decay) => Object.freeze({ intensity, distance, decay });
const SIGN_PHASES = 4;

export function buildFixtureTable({ lamps, restaurant, houseZ = 11.75 }) {
  const fixtures = [];
  lamps.forEach((lamp, index) => fixtures.push({
    id: `lamp-${index}`, zone: 'street', kind: 'lamp', pulse: true, phase: SIGN_PHASES + index,
    x: lamp.x, y: STREET_LIGHT_POOL.height, z: lamp.z,
    color: STREET_LIGHT_POOL.color, intensity: STREET_LIGHT_POOL.intensity,
    distance: STREET_LIGHT_POOL.distance, decay: STREET_LIGHT_POOL.decay,
    legacy: legacy(6.4, 8.5, 2),
  }));
  fixtures.push({ id: 'restaurant-front', zone: 'street', kind: 'sign', pulse: true, phase: 0, x: restaurant.x, y: 3.2, z: restaurant.z - restaurant.maxDepthZ / 2 - 1, color: 0xffbe73, intensity: 8, distance: 12, decay: 1.8, legacy: legacy(4.6, 9, 2) });
  fixtures.push({ id: 'glow-shop', zone: 'street', kind: 'sign', pulse: true, phase: 1, x: -6, y: 2.2, z: 14.7, color: 0xffd39a, intensity: 5, distance: 9, decay: 1.85, legacy: legacy(2.6, 7.5, 2) });
  fixtures.push({ id: 'glow-house', zone: 'street', kind: 'sign', pulse: true, phase: 2, x: 6, y: 2.35, z: houseZ, color: 0xffc77d, intensity: 4.6, distance: 9, decay: 1.85, legacy: legacy(2.4, 7.5, 2) });
  fixtures.push({ id: 'glow-portal', zone: 'street', kind: 'sign', pulse: true, phase: 3, x: 0, y: 3.2, z: 42, color: 0xa7c6ff, intensity: 3.4, distance: 9, decay: 1.85, legacy: legacy(1.4, 7.5, 2) });
  for (const x of [-4.2, 0, 4.2]) fixtures.push({ id: `room-${x}`, zone: 'warehouse', kind: 'room', pulse: false, x, y: 3.72, z: 2.3, color: 0xffe3b5, intensity: 9, distance: 11, decay: 1.9, legacy: legacy(3.2, 8, 2) });
  fixtures.push({ id: 'loading-door', zone: 'warehouse', kind: 'room', pulse: false, x: 0, y: 3.55, z: 7.15, color: 0xb9ff9a, intensity: 6.5, distance: 7.5, decay: 1.9, legacy: legacy(2.4, 5.2, 2) });
  fixtures.push({ id: 'shop-lamp', zone: 'shop-interior', kind: 'room', pulse: false, x: 0, y: 3.45, z: -30, color: 0xb9ff83, intensity: 11, distance: 11, decay: 1.9, legacy: legacy(7, 9, 2) });
  fixtures.push({ id: 'house-lamp', zone: 'house-interior', kind: 'room', pulse: false, x: 0, y: 3.45, z: -48, color: 0xffd6a0, intensity: 11, distance: 11, decay: 1.9, legacy: legacy(7, 9, 2) });
  fixtures.push({ id: 'restaurant-exit', zone: 'restaurant-interior', kind: 'room', pulse: false, x: 0, y: 2.55, z: -61.35, color: 0x84ff52, intensity: 6, distance: 7, decay: 1.9, legacy: legacy(3.8, 5.5, 2) });
  for (const [x, z] of [[-6, -70], [5, -80], [-5, -90]]) fixtures.push({ id: `restaurant-${x}-${z}`, zone: 'restaurant-interior', kind: 'room', pulse: false, x, y: 3, z, color: 0xffb56b, intensity: 9.5, distance: 15, decay: 1.85, legacy: legacy(4.8, 13, 2) });
  return Object.freeze(fixtures.map(fixture => Object.freeze(fixture)));
}

// La UNICA forma de pasar del catalogo de luminarias a lo que se enciende. El preset 0
// devuelve la luminaria de hoy, entera; los demas dejan la nueva y solo re-tunean el farol,
// que es la perilla que Jose mueve en el panel.
export function tuneFixtures(fixtures, preset) {
  return fixtures.map(fixture => {
    if (fixture.kind === 'lamp') return { ...fixture, intensity: preset.lampIntensity, distance: preset.lampDistance, decay: preset.lampDecay };
    return preset.legacy && fixture.legacy ? { ...fixture, ...fixture.legacy } : fixture;
  });
}

export function fixturesForZone(fixtures, location) {
  return fixtures.filter(fixture => fixture.zone === location);
}

// Cuantas luces de esa sala caen a la vez dentro del radio de captura, barriendo
// toda el area caminable. Es el numero que decide cuantos slots hace falta tener.
export function worstCaseOccupancy(fixtures, location, bounds, radius, step = 0.5) {
  const zone = fixturesForZone(fixtures, location);
  let worst = 0;
  let where = null;
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += step) {
      let count = 0;
      for (const fixture of zone) if (lampDistance(x, z, fixture) <= radius) count++;
      if (count > worst) { worst = count; where = { x, z }; }
    }
  }
  return { worst, where, zoneSize: zone.length };
}

export function assignBudgetSlots(previous, location, cameraX, cameraZ, fixtures, config = POINT_BUDGET) {
  return assignLightSlots(previous, cameraX, cameraZ, fixturesForZone(fixtures, location), config);
}

export function budgetPlacement(slots, location, fixtures, config = POINT_BUDGET) {
  const zone = fixturesForZone(fixtures, location);
  return poolPlacement(slots, zone, config).map((placement, slot) => {
    const fixture = placement.lampIndex === null ? null : zone[placement.lampIndex];
    return fixture
      ? { slot, fixtureId: fixture.id, x: fixture.x, y: fixture.y, z: fixture.z, color: fixture.color, intensity: fixture.intensity, distance: fixture.distance, decay: fixture.decay, pulse: fixture.pulse === true, phase: fixture.phase ?? 0 }
      : { slot, fixtureId: null, x: config.parkAt.x, y: config.parkAt.y, z: config.parkAt.z, color: 0x000000, intensity: 0, distance: 1, decay: 2, pulse: false, phase: 0 };
  });
}

export function assignGrowSlots(previous, cameraX, cameraZ, stations, config = SPOT_BUDGET) {
  return assignLightSlots(previous, cameraX, cameraZ, stations, config);
}

export function growPlacement(slots, stations, rig = GROW_LIGHT, config = SPOT_BUDGET) {
  return slots.map((stationIndex, slot) => {
    const station = stationIndex === null || stationIndex === undefined ? null : stations[stationIndex];
    return station
      ? { slot, stationIndex, x: station.x, y: rig.height, z: station.z, targetY: rig.targetY, intensity: rig.intensity }
      : { slot, stationIndex: null, x: config.parkAt.x, y: config.parkAt.y, z: config.parkAt.z, targetY: config.parkAt.y - 1, intensity: 0 };
  });
}

// Lo que se gana: hoy el shader recorre 40 point lights por fragmento en todas
// las salas; con el pool son 8 point + 4 spot, fijos, sin recompilar nunca.
export function budgetSummary() {
  return {
    before: { pointsCompiled: LEGACY_LIGHT_CENSUS.points, spotsCompiled: 0 },
    after: { pointsCompiled: POINT_BUDGET.slots, spotsCompiled: SPOT_BUDGET.slots },
    pointReduction: LEGACY_LIGHT_CENSUS.points / POINT_BUDGET.slots,
  };
}
