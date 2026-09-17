// Las casas repetidas dejan de ser la misma casa.
//
// EL DEFECTO (diagnostico 2026-09-11, frame 01-aerea-sur): "la fila oeste es techo verde, techo verde, techo
// verde, techo verde -- mismo modelo, misma orientacion, mismo retiro. Se lee como copiar y pegar". Hay 21
// modelos para 38 edificios y seis se repiten: la casa C (5 lotes), la D (5), la F (4), la G (3), la H (3) y la
// E (3). No se puede cambiar el modelo (las huellas estan medidas por lote y todo apoya en ellas) ni girarlo
// (idem), asi que lo que cambia es la PINTURA: un tinte por lote, multiplicado sobre el albedo Y sobre el
// emisivo de noche (tuneNightMaterials usa la textura como emissiveMap, y de noche eso es lo que se ve: un
// tinte solo en `color` no se notaria).
//
// El reparto es determinista y por vecindad: cada lote toma el primer tinte de la paleta que no use ningun
// lote tenido a menos de 10 m ni el lote anterior del mismo modelo, recorriendo la ciudad en orden de calle.
// Sin `Math.random`: el gate mide la misma ciudad que ve el jugador.
//
// Perilla como las otras: ?casas=0|1|2 (alias ?paint=). 0 = las casas de hoy bit a bit (tinte blanco sobre el
// color base guardado). 1 = tintes de +-16 %. 2 = los mismos tintes a x1,5.
import { HOUSE_FOOTPRINTS } from './lotState.js';

export const CASAS_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', strength: 0 }),
  Object.freeze({ id: 1, key: 'paint', label: 'PINTURA', strength: 1 }),
  Object.freeze({ id: 2, key: 'bold', label: 'PINTURA FUERTE', strength: 1.5 }),
]);
export const DEFAULT_CASAS_PRESET = 1;

export function casasPresetById(id) {
  return CASAS_PRESETS.find(preset => preset.id === id) ?? CASAS_PRESETS[DEFAULT_CASAS_PRESET];
}

export function readCasasPreset(search, fallback = DEFAULT_CASAS_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('casas') ?? params.get('paint');
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && CASAS_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

// Multiplicadores RGB a fuerza 1. Cerca del blanco: un tinte que cambie el color de un techo verde a azul ya no
// es pintura, es otro modelo. El primer corte iba a +-8 % y de noche (ACES + emisivo) no se notaba en las capturas:
// se duplico a +-16 %. El "oscuro" es el que mas se nota de noche (baja el emisivo).
export const HOUSE_TINTS = Object.freeze([
  Object.freeze({ id: 'calido', rgb: [1.12, 0.96, 0.80] }),
  Object.freeze({ id: 'frio', rgb: [0.84, 0.94, 1.12] }),
  Object.freeze({ id: 'rosa', rgb: [1.10, 0.88, 0.92] }),
  Object.freeze({ id: 'salvia', rgb: [0.90, 1.04, 0.88] }),
  Object.freeze({ id: 'claro', rgb: [1.16, 1.12, 1.04] }),
  Object.freeze({ id: 'oscuro', rgb: [0.76, 0.76, 0.80] }),
]);
// Solo los modelos que se repiten llevan tinte: un edificio unico ya es distinto de sus vecinos.
export const REPEATED_MIN = 2;
export const NEIGHBOUR_RADIUS = 10;

const r3 = n => +n.toFixed(3);
const scaled = (rgb, strength) => rgb.map(v => r3(1 + (v - 1) * strength));

// Los lotes en orden de calle: la avenida de sur a norte (oeste, luego este), la transversal de oeste a este
// (sur, luego norte). Determinista y legible.
export function lotsInStreetOrder(footprints = HOUSE_FOOTPRINTS) {
  const key = f => (f.street === 'main' ? 0 : 1) * 1e6 + (f.side === 'west' || f.side === 'south' ? 0 : 1) * 1e4 + (f.street === 'main' ? f.z : f.x + 200);
  return [...footprints].sort((a, b) => key(a) - key(b));
}

export function repeatedAssets(footprints = HOUSE_FOOTPRINTS) {
  const count = new Map();
  for (const f of footprints) count.set(f.asset, (count.get(f.asset) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n >= REPEATED_MIN).map(([asset]) => asset));
}

// lote -> indice de HOUSE_TINTS. Independiente del preset: el preset solo escala la fuerza.
export function tintAssignment(footprints = HOUSE_FOOTPRINTS) {
  const repeated = repeatedAssets(footprints);
  const out = new Map();
  const usedByAsset = new Map();
  const usedTotal = HOUSE_TINTS.map(() => 0);
  const placed = [];
  for (const f of lotsInStreetOrder(footprints)) {
    if (!repeated.has(f.asset)) continue;
    // prohibidos: los tintes de las vecinas a menos de 10 m y los que ya uso este mismo modelo (cinco C caben en
    // seis tintes sin repetir ninguno); si no queda ninguno, se suelta primero la regla del modelo
    const vecinos = new Set(placed.filter(p => Math.hypot(p.f.x - f.x, p.f.z - f.z) < NEIGHBOUR_RADIUS).map(p => p.tint));
    const mismos = usedByAsset.get(f.asset) ?? new Set();
    let candidatos = HOUSE_TINTS.map((_, i) => i).filter(i => !vecinos.has(i) && !mismos.has(i));
    if (!candidatos.length) candidatos = HOUSE_TINTS.map((_, i) => i).filter(i => !vecinos.has(i));
    if (!candidatos.length) candidatos = HOUSE_TINTS.map((_, i) => i);
    // entre los que quedan, el menos usado en toda la ciudad: asi la paleta se reparte y no se repite el par calido/frio
    const tint = candidatos.reduce((best, i) => (usedTotal[i] < usedTotal[best] ? i : best), candidatos[0]);
    out.set(f.id, tint);
    usedTotal[tint]++;
    usedByAsset.set(f.asset, mismos.add(tint));
    placed.push({ f, tint });
  }
  return out;
}

// lote -> [r, g, b] para el preset. En el 0 todo es blanco: las casas de hoy.
export function houseTints(preset = casasPresetById(DEFAULT_CASAS_PRESET), footprints = HOUSE_FOOTPRINTS) {
  const out = new Map();
  for (const [id, tint] of tintAssignment(footprints)) {
    out.set(id, preset.strength ? scaled(HOUSE_TINTS[tint].rgb, preset.strength) : [1, 1, 1]);
  }
  return out;
}

// La colocacion de main.js (STREET_LAYOUT.houses / branchHouses) no lleva id: se busca la huella por posicion.
export function lotIdForPlacement(placement, footprints = HOUSE_FOOTPRINTS) {
  const hit = footprints.find(f => Math.abs(f.x - placement.x) < 0.06 && Math.abs(f.z - placement.z) < 0.06);
  return hit ? hit.id : null;
}
