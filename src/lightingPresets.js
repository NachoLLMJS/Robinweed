// Perillas de luz para Jose. Regla del plan maestro: el preset 0 es EXACTAMENTE
// el estado actual, para que el A/B sea honesto. Se elige por query string
// (?lighting=N, alias ?luz=N) y se cambia en caliente por __robinweedQA.setLighting(n).
import { LEGACY_PALETTE, NIGHT_PALETTE } from './nightPalette.js';
import { HORIZON } from './horizonState.js';
import { GROW_LIGHT_PRESETS } from './lightZoneState.js';
import { STREET_LIGHT_POOL } from './streetLightPool.js';

// Estas claves SI se aplican en caliente -- medido en Chrome con GPU: al cambiarlas three
// vuelve a compilar los materiales de la escena y las sombras aparecen o desaparecen de
// verdad. Lo que cuesta es un frame largo (1,3 s medido para castShadow, 2,5 s para las
// ocho luces de cultivo del preset 0), no una recarga. El panel lo avisa como RECOMPILE.
// La version anterior las declaraba imposibles y NO las aplicaba: el resultado era que
// conmutar 2 -> 0 dejaba las sombras de luna prendidas sobre un preset que no las tiene.
export const LIGHTING_RECOMPILE_KEYS = Object.freeze(['moonShadow', 'shadowMapSize', 'growPoints', 'legacy']);

export const LIGHTING_PRESETS = Object.freeze([
  Object.freeze({
    id: 0,
    key: 'legacy',
    label: 'BASE (HOY)',
    // `legacy` es el interruptor maestro del brazo de control: albedos del suelo, las once
    // luminarias que no son farol, el tono de cielo sin ACES apagado y los charcos pintados
    // fuera. Sin el, el preset 0 se parecia al juego de hoy solo en los numeros del panel.
    legacy: true,
    hemiSky: LEGACY_PALETTE.hemiSky,
    hemiGround: LEGACY_PALETTE.hemiGround,
    hemiIntensity: LEGACY_PALETTE.hemiIntensity,
    ambient: LEGACY_PALETTE.ambient,
    ambientIntensity: LEGACY_PALETTE.ambientIntensity,
    moonColor: LEGACY_PALETTE.moon,
    moonIntensity: LEGACY_PALETTE.moonIntensity,
    moonShadow: false,
    shadowMapSize: 1024,
    fogColor: 0x0c110b,
    fogDensity: 0.031,
    cameraFar: 80,
    skyHorizon: 0x0c110b,
    skyZenith: 0x0c110b,
    skyline: false,
    lampIntensity: 6.4,
    lampDistance: 8.5,
    lampDecay: 2,
    streetEmissive: LEGACY_PALETTE.streetEmissive,
    growPreset: 'legacy',
    growCone: false,
    // Las tres superficies mas grandes del cuadro. Se construyen con el material, asi que
    // si el preset no las trae, ningun cambio de luz las devuelve: el asfalto medido salia
    // 2,7x mas claro que la linea base y el pasto oliva en vez de verde.
    road: LEGACY_PALETTE.road,
    curb: LEGACY_PALETTE.curb,
    grassA: LEGACY_PALETTE.grassA,
    grassB: LEGACY_PALETTE.grassB,
    // El cultivo de hoy son ocho PointLight verdes fijas, no cuatro conos pooleados.
    growPoints: true,
  }),
  Object.freeze({
    id: 1,
    key: 'moonlit',
    label: 'LUNA (SUAVE)',
    legacy: false,
    hemiSky: NIGHT_PALETTE.hemiSky,
    hemiGround: NIGHT_PALETTE.hemiGround,
    hemiIntensity: 0.82,
    ambient: NIGHT_PALETTE.ambient,
    ambientIntensity: 0.36,
    moonColor: NIGHT_PALETTE.moon,
    moonIntensity: 1.7,
    moonShadow: true,
    shadowMapSize: 2048,
    fogColor: HORIZON.fogColor,
    fogDensity: 0.017,
    cameraFar: HORIZON.cameraFar,
    skyHorizon: HORIZON.horizon,
    skyZenith: HORIZON.zenith,
    skyline: true,
    lampIntensity: 9,
    lampDistance: 12,
    lampDecay: 1.8,
    streetEmissive: 0.06,
    growPreset: 'white',
    growCone: true,
    road: NIGHT_PALETTE.road,
    curb: NIGHT_PALETTE.curb,
    grassA: NIGHT_PALETTE.grassA,
    grassB: NIGHT_PALETTE.grassB,
    growPoints: false,
  }),
  Object.freeze({
    id: 2,
    key: 'noir',
    label: 'NOCHE CERRADA',
    legacy: false,
    hemiSky: NIGHT_PALETTE.hemiSky,
    hemiGround: NIGHT_PALETTE.hemiGround,
    hemiIntensity: NIGHT_PALETTE.hemiIntensity,
    ambient: NIGHT_PALETTE.ambient,
    ambientIntensity: NIGHT_PALETTE.ambientIntensity,
    moonColor: NIGHT_PALETTE.moon,
    moonIntensity: NIGHT_PALETTE.moonIntensity,
    moonShadow: true,
    shadowMapSize: 2048,
    fogColor: HORIZON.fogColor,
    fogDensity: HORIZON.fogDensity,
    cameraFar: HORIZON.cameraFar,
    skyHorizon: HORIZON.horizon,
    skyZenith: HORIZON.zenith,
    skyline: true,
    lampIntensity: STREET_LIGHT_POOL.intensity,
    lampDistance: STREET_LIGHT_POOL.distance,
    lampDecay: STREET_LIGHT_POOL.decay,
    streetEmissive: NIGHT_PALETTE.streetEmissive,
    growPreset: 'magenta',
    growCone: true,
    road: NIGHT_PALETTE.road,
    curb: NIGHT_PALETTE.curb,
    grassA: NIGHT_PALETTE.grassA,
    grassB: NIGHT_PALETTE.grassB,
    growPoints: false,
  }),
]);

export const DEFAULT_LIGHTING_PRESET = 2;

export function lightingPresetById(id) {
  return LIGHTING_PRESETS.find(preset => preset.id === id) ?? LIGHTING_PRESETS[DEFAULT_LIGHTING_PRESET];
}

// Acepta ?lighting=1 y el alias en español ?luz=1 del plan maestro. Cualquier
// cosa que no sea un id conocido cae al preset por defecto, nunca tira.
export function readLightingPreset(search, fallback = DEFAULT_LIGHTING_PRESET) {
  let raw = null;
  try {
    const params = new URLSearchParams(typeof search === 'string' ? search : '');
    raw = params.get('lighting') ?? params.get('luz');
  } catch { raw = null; }
  if (raw === null || raw === '') return lightingPresetById(fallback);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return lightingPresetById(fallback);
  const byKey = LIGHTING_PRESETS.find(preset => preset.key === raw);
  if (byKey) return byKey;
  return lightingPresetById(parsed);
}

// El step tiene que poder REPRESENTAR el valor del preset, o el slider arranca corrido:
// un <input type=range> pega el valor a la grilla apenas se lo asigna. Con step 0,02 y 0,5
// los dos numeros del brazo de control -- hemi 1,85 y farol 6,4 -- eran inalcanzables, asi
// que el pulgar aparecia en 1,86 y 6,5 el primer segundo, sin que nadie tocara nada.
export const LIGHTING_KNOBS = Object.freeze({
  hemiIntensity: Object.freeze({ min: 0, max: 2.4, step: 0.01 }),
  ambientIntensity: Object.freeze({ min: 0, max: 1.2, step: 0.02 }),
  moonIntensity: Object.freeze({ min: 0, max: 4, step: 0.05 }),
  fogDensity: Object.freeze({ min: 0, max: 0.04, step: 0.0005 }),
  lampIntensity: Object.freeze({ min: 0, max: 30, step: 0.1 }),
  streetEmissive: Object.freeze({ min: 0, max: 0.3, step: 0.005 }),
});

export function clampKnob(name, value) {
  const knob = LIGHTING_KNOBS[name];
  if (!knob) return value;
  if (!Number.isFinite(value)) return knob.min;
  return Math.min(knob.max, Math.max(knob.min, value));
}

// Devuelve un preset nuevo (no muta el congelado) con los overrides clampeados,
// mas la lista de cambios que cuestan una recompilacion, para que la UI lo avise.
export function applyLightingOverrides(preset, overrides = {}) {
  const next = { ...preset, id: preset.id, key: preset.key };
  const needsRecompile = [];
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in preset)) continue;
    if (LIGHTING_RECOMPILE_KEYS.includes(name)) {
      if (preset[name] !== value) needsRecompile.push(name);
      next[name] = value;
      continue;
    }
    next[name] = name in LIGHTING_KNOBS ? clampKnob(name, value) : value;
  }
  return { preset: next, needsRecompile };
}

// Que claves cambian de verdad al pasar de un preset a otro. Es lo que el panel muestra
// como RECOMPILE: la lista real, no la lista completa "por las dudas".
export function recompileKeysBetween(from, to) {
  if (!from) return [];
  return LIGHTING_RECOMPILE_KEYS.filter(key => from[key] !== to[key]);
}

// `measured` es el estado REAL de la escena (hoy: si la luna proyecta sombra). Si se pasa,
// se imprime ese y no el de la tabla: el hook de QA llegaba a decir "shadow on" con las
// sombras apagadas porque leia el preset y nadie aplicaba castShadow. Cuando los dos no
// coinciden queda marcado con (!) en vez de elegir en silencio al que miente.
export function lightingPresetSummary(preset, measured = {}) {
  const shadow = 'shadow' in measured ? measured.shadow : preset.moonShadow;
  const drift = 'shadow' in measured && measured.shadow !== preset.moonShadow ? ' (!)' : '';
  const grow = GROW_LIGHT_PRESETS[preset.growPreset]?.label ?? preset.growPreset;
  return `${preset.id} ${preset.label} · hemi ${preset.hemiIntensity} · amb ${preset.ambientIntensity} · fog ${preset.fogDensity} · far ${preset.cameraFar} · shadow ${shadow ? 'on' : 'off'}${drift} · grow ${grow}${preset.growPoints ? ' ×8 point' : ' cone'}`;
}
