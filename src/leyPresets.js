// src/leyPresets.js
// Perilla ?ley=0|1 (alias ?materiales=) del paquete B2: la ley de materiales (materialLaw.js) entra detras de una
// perilla conmutable en caliente, con el mismo patron que g60Presets.js (G), lightingPresets.js (A) y los 13
// ?preset de la ciudad: el 0 es IDENTICO al estado previo, para que Jose decida jugando y no leyendo un informe.
//
// B-5 de la VERIFICACION 2026-09-14: aplicar la ley incondicionalmente pisaba el "0 = hoy" de ?g60, ?marcas y
// ?galpon y los cuadros que A calibro con el city-pack a metal 1. Por eso cada loader guarda, por malla, el
// material de HOY (`off`: lo que queda tras tuneNightMaterials + callbacks, incluido el neon de G y el tinte de
// ?casas) y la ley sobre un clon (`on`), y applyLey(preset) apunta las mallas a uno u otro por referencia
// (lawVariants de materialLaw.js). Nada se recompila ni se recarga al conmutar.
//
// Defecto 1 (§4 del plan): como A y G, el envio es la ley puesta; el 0 queda para comparar.
const preset = (id, key, label, values) => Object.freeze({ id, key, label, ...values });

export const LEY_PRESETS = Object.freeze([
  preset(0, 'legacy', 'HOY', {
    law: false,
    note: 'HOY bit a bit: cada malla apunta al material que hoy queda tras tuneNightMaterials y los callbacks del loader (neon de G, tinte de ?casas). La ley ni se aplica ni se ve.',
  }),
  preset(1, 'law', 'LEY', {
    law: true,
    note: 'La ley de materiales (materialLaw.js): galpon fotoescaneado por paleta, restaurante interior y torre aplanados por promedio, city-pack y caminantes a metal <= .25 / rough >= .55, sin clamp de color sobre los assets cel. Vlad, plantas, cogollos, restaurante exterior y lo procedural de K/L/M quedan fuera.',
  }),
]);

export const DEFAULT_LEY_PRESET = 1;

export function leyPresetById(id) {
  return LEY_PRESETS.find(entry => entry.id === id) ?? LEY_PRESETS[DEFAULT_LEY_PRESET];
}

// Viene de la barra de direcciones: nunca tira, siempre cae al default. `?materiales=` es alias de `?ley=`;
// si vienen los dos manda `?ley=`.
export function readLeyPreset(search = '') {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('ley') ?? params.get('materiales');
  if (raw === null) return leyPresetById(DEFAULT_LEY_PRESET);
  const id = Number.parseInt(raw, 10);
  return leyPresetById(Number.isNaN(id) ? DEFAULT_LEY_PRESET : id);
}

// Lo que devuelven __robinweedQA.ley() y setLey(n): el preset entero, para leerlo desde la consola o el rig.
export function leyPresetSummary(entry) {
  return { id: entry.id, key: entry.key, label: entry.label, law: entry.law, note: entry.note };
}
