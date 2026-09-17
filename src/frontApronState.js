// El delantal de cada casa: la vereda deja de morir en el cordon y llega hasta la pared.
//
// EL DEFECTO, medido el 2026-09-11 sobre la rama viva. El cordon de la avenida es una franja de
// 1,8 m (`box([1.8,.16,24.4],curbMaterial,[x,.04,18.2])`, x = +-5,1) y el de la transversal otra de
// 1,05 m. Del borde de esa franja a la pared de la casa quedan, de promedio, **0,91 m de pasto
// pelado**, y ahi es donde estan las puertas: la puerta abre directo al cesped, sin escalon, sin
// camino y sin zocalo. Se ve en `frames/04-avenida-z056-oeste.png`.
//
// Y POR QUE NO ES UN CAMINO DE ENTRADA. El plan del paquete pedia "el camino de entrada de cada una
// de las 38 casas, desde la vereda hasta su puerta". No entra: el retiro va de 0,00 a 1,67 m y **22
// de las 38 casas tienen menos de 1,2 m**. Lo que si entra, y arregla el mismo defecto en las 38, es
// que la vereda cubra ese hueco. Por eso esto es un delantal y no un sendero.
//
// La cota es la del cordon (arriba en y = 0,12, espesor 0,16, centro en y = 0,04) para que se lea
// como la MISMA superficie. Si flotara sobre el pasto seria cambiar un defecto por otro.
// No agrega colliders: el jugador ya camina sobre el cordon y su altura es fija.
import { lots as allLots, HOUSE_FOOTPRINTS, SIDEWALK_EDGE } from './lotState.js';
import { LOT_FENCE_COLLIDERS } from './lotFenceState.js';
import { groundFaceFor } from './frontFaceState.js';

// Menos que esto es un labio de 20 cm que no se ve y suma una instancia al buffer.
export const APRON_MIN_DEPTH = 0.35;
// La cota de arriba del cordon. El test la ancla contra el literal de main.js.
export const APRON_TOP = 0.12;
// La cota del pasto: caja de 0,08 centrada en y = -0,01 en main.js (el test la ancla al literal). Lo que se
// apoya en el cesped (piezas sueltas del rincon, un umbral sin delantal) arranca aca.
export const GRASS_TOP = 0.03;
export const APRON_THICKNESS = 0.16;
// Cuanto se angosta el delantal respecto de su casa, de cada lado. Los cierres de frente de L viven
// en los huecos ENTRE casas y arrancan pegados a la huella: sin este recorte el delantal les pasa
// por debajo y la cerca queda flotando sobre la losa.
export const APRON_SIDE_TRIM = 0.12;
// Una caja por delantal, 12 triangulos. Las 32 se fusionan en UNA geometria: un draw call.
export const APRON_TRIS = 12;
// Metros por baldosa, el mismo numero que usa GROUND_REPEAT.curb en groundTextureState.js.
export const APRON_TILE_METRES = 1.6;
// El borde: una cinta baja entre el pavimento y el pasto. Sin ella el delantal es una losa apoyada
// sobre el cesped y el encuentro es una linea recta perfecta, que es el otro tell de maqueta.
export const EDGE_WIDTH = 0.14;
export const EDGE_TOP = 0.16;
export const EDGE_THICKNESS = 0.2;

// ?suelo=0|1|2|3|4 (alias ?vereda=). El 0 es la calle de hoy, bit a bit. El 3 suma el umbral de piedra delante de
// cada puerta medida (doorStoopState.js). El 4 suma el cruce (cebras y rebajes en la bocacalle) y los remates de
// vereda en los dos fondos de ladrillo de la transversal (crossingState.js).
export const SUELO_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', aprons: false, edges: false, stoops: false, crossings: false }),
  Object.freeze({ id: 1, key: 'apron', label: 'VEREDA', aprons: true, edges: false, stoops: false, crossings: false }),
  Object.freeze({ id: 2, key: 'edged', label: 'VEREDA+BORDE', aprons: true, edges: true, stoops: false, crossings: false }),
  Object.freeze({ id: 3, key: 'stoops', label: 'VEREDA+BORDE+UMBRAL', aprons: true, edges: true, stoops: true, crossings: false }),
  Object.freeze({ id: 4, key: 'crossings', label: 'VEREDA+BORDE+UMBRAL+CRUCE', aprons: true, edges: true, stoops: true, crossings: true }),
]);
// Jose delego los presets el 2026-09-13 ("todo lo que recomiendes avanzalo"): el defecto es la recomendacion (4), el 0 sigue
// siendo el juego de antes desde ?suelo=0 o el panel ?qa. Lo mismo en bases (2), vestida (2), laterales (2), isla (2, ya
// aprobado) y manzana (2).
export const DEFAULT_SUELO_PRESET = 4;

export function sueloPresetById(id) {
  return SUELO_PRESETS.find(preset => preset.id === id) ?? SUELO_PRESETS[DEFAULT_SUELO_PRESET];
}

export function readSueloPreset(search, fallback = DEFAULT_SUELO_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('suelo') ?? params.get('vereda');
  // `?suelo=` sin valor devuelve '' y Number('') es 0: sin este chequeo un signo igual de mas
  // seleccionaba el brazo de control en silencio. Misma trampa que en las otras cinco perillas.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && SUELO_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// El tramo continuo mas largo de `caja` a lo largo de `eje` que no toca ninguna cerca. Devuelve null
// si no queda nada util. Se queda con UN tramo a proposito: partir el delantal en dos deja astillas
// de medio metro que son una instancia mas en el buffer y no se ven.
function largestClearSpan(caja, eje, obstaculos) {
  const min = caja['min' + eje], max = caja['max' + eje];
  const cortes = [];
  for (const o of obstaculos) {
    if (!overlaps(caja, o)) continue;
    const a = Math.max(min, o['min' + eje]), b = Math.min(max, o['max' + eje]);
    if (b > a) cortes.push([a, b]);
  }
  if (!cortes.length) return { min, max };
  cortes.sort((p, q) => p[0] - q[0]);
  let mejor = null, cursor = min;
  for (const [a, b] of cortes) {
    if (a > cursor && (!mejor || a - cursor > mejor.max - mejor.min)) mejor = { min: cursor, max: a };
    cursor = Math.max(cursor, b);
  }
  if (max > cursor && (!mejor || max - cursor > mejor.max - mejor.min)) mejor = { min: cursor, max };
  return mejor;
}

// El borde exterior de la vereda que le toca a este lote.
export function kerbEdgeFor(lot) {
  const { street, side, x } = lot.footprint;
  if (street === 'main') return x < 0 ? -SIDEWALK_EDGE.main : SIDEWALK_EDGE.main;
  return side === 'north' ? SIDEWALK_EDGE.cross.north : SIDEWALK_EDGE.cross.south;
}

// El pasto que hoy queda entre el cordon y la pared. Es la profundidad del delantal.
// La pared es la cara MEDIDA a nivel del piso (frontFaceState), no el AABB: el AABB es el alero, y anclado a el
// el delantal de la casa C terminaba 0,33 m antes de la pared.
export function setbackOf(lot) {
  return Math.abs(groundFaceFor(lot) - kerbEdgeFor(lot));
}

// Un delantal por lote que tenga hueco. Va del borde de la vereda a la cara de la casa y es tan
// ancho como la casa menos el recorte lateral.
export function frontAprons(lots = allLots()) {
  const aprons = [];
  for (const lot of lots) {
    const depth = setbackOf(lot);
    if (depth < APRON_MIN_DEPTH) continue;
    const fp = lot.footprint;
    const borde = kerbEdgeFor(lot), frente = groundFaceFor(lot);
    let caja;
    if (fp.street === 'main') {
      // el delantal crece en x, del cordon a la pared; su ancho corre en z, con la casa
      caja = {
        minX: Math.min(borde, frente),
        maxX: Math.max(borde, frente),
        minZ: fp.minZ + APRON_SIDE_TRIM,
        maxZ: fp.maxZ - APRON_SIDE_TRIM,
      };
    } else {
      caja = {
        minX: fp.minX + APRON_SIDE_TRIM,
        maxX: fp.maxX - APRON_SIDE_TRIM,
        minZ: Math.min(borde, frente),
        maxZ: Math.max(borde, frente),
      };
    }
    // Una cerca lateral puede caer DENTRO del frente de la casa, porque la huella no esta centrada
    // en su lote: HOME-022 mide x 14,75..21,25 y el limite con el vecino cae en x 15,44..15,56.
    // El delantal es de UNA propiedad, asi que se corta en el limite en vez de pasarle por debajo.
    const eje = fp.street === 'main' ? 'Z' : 'X';
    const recortado = largestClearSpan(caja, eje, LOT_FENCE_COLLIDERS);
    if (!recortado) continue;
    caja['min' + eje] = recortado.min;
    caja['max' + eje] = recortado.max;

    const width = fp.street === 'main' ? caja.maxZ - caja.minZ : caja.maxX - caja.minX;
    if (width <= 0.2) continue;
    aprons.push({
      id: lot.id,
      street: fp.street,
      side: fp.side,
      ...caja,
      depth: +depth.toFixed(6),
      width: +width.toFixed(6),
      x: (caja.minX + caja.maxX) / 2,
      z: (caja.minZ + caja.maxZ) / 2,
    });
  }
  return aprons;
}

// Lo que main.js necesita para construir el delantal: una caja por lote, con su tamano, su
// posicion y cuantas veces repetir la baldosa en cada eje. Se fusionan en UNA geometria en vez de
// instanciarse, por dos razones concretas:
//   - la baldosa tiene que medir 1,6 m en los dos ejes en todos los delantales, y los delantales van
//     de 0,42 x 3,59 m a 1,67 x 12,26 m. Con instancias sobre una caja unitaria la textura se
//     estira hasta 7:1, y corregirlo pide un atributo por instancia y un parche de shader.
//   - fusionadas usan `curbMaterial` TAL CUAL, asi que el delantal cambia de color con el preset de
//     luz sin cablear nada. Un material clonado se habria quedado con el color del preset de carga.
// Sale igual en un draw call.
export function apronGeometrySpecs(aprons = frontAprons()) {
  return aprons.map(apron => {
    const sx = apron.maxX - apron.minX;
    const sz = apron.maxZ - apron.minZ;
    return {
      id: apron.id,
      size: [sx, APRON_THICKNESS, sz],
      position: [apron.x, APRON_TOP - APRON_THICKNESS / 2, apron.z],
      uv: [sx / APRON_TILE_METRES, sz / APRON_TILE_METRES],
    };
  });
}

// Las dos cintas de borde de cada delantal. Van en los costados que dan al pasto: el lado de adentro
// muere contra el cordon y el de afuera contra la pared, y ahi no hay cesped que separar.
export function apronEdges(aprons = frontAprons()) {
  const edges = [];
  for (const apron of aprons) {
    const largo = apron.street === 'main' ? apron.maxX - apron.minX : apron.maxZ - apron.minZ;
    if (largo <= 0) continue;
    for (const lado of [-1, 1]) {
      edges.push(apron.street === 'main'
        ? {
          id: `${apron.id}#${lado < 0 ? 'S' : 'N'}`, apron: apron.id,
          x: apron.x, z: lado < 0 ? apron.minZ : apron.maxZ,
          sx: largo, sz: EDGE_WIDTH,
        }
        : {
          id: `${apron.id}#${lado < 0 ? 'O' : 'E'}`, apron: apron.id,
          x: lado < 0 ? apron.minX : apron.maxX, z: apron.z,
          sx: EDGE_WIDTH, sz: largo,
        });
    }
  }
  return edges;
}

export function edgeGeometrySpecs(edges = apronEdges()) {
  return edges.map(edge => ({
    id: edge.id,
    size: [edge.sx, EDGE_THICKNESS, edge.sz],
    position: [edge.x, EDGE_TOP - EDGE_THICKNESS / 2, edge.z],
    uv: [edge.sx / APRON_TILE_METRES, edge.sz / APRON_TILE_METRES],
  }));
}

// Autochequeo para el gate: lo que el test mira, en una sola llamada, por si alguien mueve una
// huella o un cierre y el delantal deja de encajar.
export function apronConflicts(aprons = frontAprons()) {
  const choques = [];
  for (const apron of aprons) {
    // el propio AABB es el alero: el delantal entra debajo hasta la cara del zocalo, asi que no cuenta como choque
    for (const fp of HOUSE_FOOTPRINTS) if (fp.id !== apron.id && overlaps(apron, fp)) choques.push({ apron: apron.id, contra: `casa ${fp.id}` });
    for (const col of LOT_FENCE_COLLIDERS) if (overlaps(apron, col)) choques.push({ apron: apron.id, contra: 'cerca' });
  }
  for (let i = 0; i < aprons.length; i++) {
    for (let j = i + 1; j < aprons.length; j++) {
      if (overlaps(aprons[i], aprons[j])) choques.push({ apron: aprons[i].id, contra: `delantal ${aprons[j].id}` });
    }
  }
  return choques;
}
