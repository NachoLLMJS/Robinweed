// Las marcas reales de la calle, y como se sacan sin romper la manzana.
//
// Jose pidio sacar "el edificio de KFC y el de Nike". Los dos existen:
//   - el KFC es `cityPackKfc` en (9,2 / 18,44), a la salida del galpon, con la cara del Coronel en la
//     fachada (textura #1 del GLB);
//   - NIKE es el diner `cityPackDiner` en (-37 / 42,4), en la fila norte de la transversal: las letras
//     son GEOMETRIA de color plano, no una imagen, y por eso la recon que busco logos en las 173 texturas
//     de los 66 GLB no las encontro y las dio por inexistentes. Se ven de frente desde la vereda sur.
//
// Se reemplazan por dos edificios sin marca generados con Tripo (evidencia/ciudad/gen3d.mjs, 5 creditos
// cada uno) y pasados por post3d.mjs. Cada uno ocupa el MISMO lote, con el frente sobre la misma linea
// que el edificio que saca: los cierres de L montan 0,16 m sobre las esquinas del frente medido, y un
// frente retirado dejaria la cerca terminando en el aire. Hacia el fondo el edificio puede ser mas corto
// (detras es patio), y en ese caso los decals de fondo y laterales, que se apoyan en la cintura del
// edificio viejo, se pliegan para no quedar flotando en el pasto.
//
// Es una perilla como las otras nueve: ?marcas=0|1 (alias ?brands=), el 0 es el juego de hoy bit a bit y
// se conmuta en caliente. Los dos GLB viejos se siguen cargando y solo se esconden.
import { HOUSE_FOOTPRINTS } from './lotState.js';

export const MARCAS_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', swap: false }),
  Object.freeze({ id: 1, key: 'clean', label: 'SIN MARCAS', swap: true }),
]);
export const DEFAULT_MARCAS_PRESET = 1;
export function marcasPresetById(id) {
  return MARCAS_PRESETS.find(preset => preset.id === id) ?? MARCAS_PRESETS[DEFAULT_MARCAS_PRESET];
}
export function readMarcasPreset(search, fallback = DEFAULT_MARCAS_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('marcas') ?? params.get('brands');
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && MARCAS_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

const lotBox = id => HOUSE_FOOTPRINTS.find(f => f.id === id);
const kfc = lotBox('cityPackKfc@9.2/18.44'), diner = lotBox('cityPackDiner@-37/42.4');

// Las colocaciones. `raw` es el tamano del GLB tal como sale de post3d (medido con
// evidencia/ciudad/medir-glb.mjs); `loadCenteredFittedAsset` lo ajusta con una escala uniforme a la
// caja (maxWidthX / maxDepthZ / height) y despues multiplica `wrapper.scale` por scaleX/scaleY/scaleZ,
// que son LOCALES, pre-rotacion: con rotationY = PI/2 un scaleX estira el eje Z del mundo.
// `expectedBox` es la caja de mundo que resulta; el test la recalcula con la misma formula que el runtime.
export const BRAND_SWAPS = Object.freeze([
  Object.freeze({
    lot: kfc.id, swapsOut: 'cityPackKfc', asset: 'cornerShop',
    // Un shophouse de dos plantas con persiana metalica: el frente (raw +x) mira a la calle con
    // rotationY PI, igual que el KFC. Regenerado el 2026-09-13 con textura de 1024 (el primero tenia 256 y se veia
    // borroso desde el spawn); Tripo lo entrego esta vez como una torre angosta (0,45 x 1 x 0,42), asi que el fit
    // uniforme lo manda la ALTURA (5,302) y las escalas locales lo llevan a la caja del KFC: scaleX 1,68 el fondo,
    // scaleZ 2,06 el ancho del frente (una persiana ancha; las ventanas quedan chatas). `x` se corre para que el
    // frente quede en el cordon (x = 6). Medido con evidencia/ciudad/marcas3-ajustar.mjs.
    raw: Object.freeze([0.446, 1, 0.423]),
    x: 7.982, z: 18.44, height: 5.302, maxWidthX: 6.4, maxDepthZ: 4.612, groundY: 0.03, rotationY: Math.PI,
    scaleX: 1.6763, scaleY: 1, scaleZ: 2.0564,
    expectedBox: Object.freeze({ minX: 6, maxX: 9.964, minZ: 16.134, maxZ: 20.746, height: 5.302 }),
  }),
  Object.freeze({
    lot: diner.id, swapsOut: 'cityPackDiner', asset: 'cornerCafe',
    // Un cafe bajo de techo plano con vidriera y puerta doble: el frente (raw +x) mira al sur con
    // rotationY PI/2, igual que el diner. Regenerado el 2026-09-13 con textura de 1024 (el primero tenia 256);
    // Tripo lo entrego casi cubico (0,95 x 0,82 x 1), el fit uniforme lo manda el ancho del lote (6,832 m) y las
    // escalas locales lo llevan a la caja del diner: scaleX (que con esta rotacion estira z) 1,65 al fondo de 7,5,
    // scaleZ 1,43 al ancho; llena el lote hasta el fondo, asi que sus decals traseros quedan DENTRO. Medido con
    // evidencia/ciudad/marcas3-ajustar.mjs.
    raw: Object.freeze([0.954, 0.824, 1]),
    x: -37, z: 42.4, height: 3.924, maxWidthX: 6.832, maxDepthZ: 7.5, groundY: 0.03, rotationY: Math.PI / 2,
    scaleX: 1.6509, scaleY: 1, scaleZ: 1.4347,
    expectedBox: Object.freeze({ minX: -40.416, maxX: -33.584, minZ: 38.65, maxZ: 46.15, height: 3.924 }),
  }),
]);

export function swappedLotIds(preset = marcasPresetById(DEFAULT_MARCAS_PRESET)) {
  return preset.swap ? BRAND_SWAPS.map(swap => swap.lot) : [];
}

// Los lotes cuyo edificio nuevo es mas corto que el viejo: el fondo y los laterales apoyados en la
// cintura vieja quedarian flotando detras, asi que main.js los pliega (matriz a escala cero).
export function hiddenDecalLots(preset = marcasPresetById(DEFAULT_MARCAS_PRESET)) {
  if (!preset.swap) return [];
  return BRAND_SWAPS.filter(swap => {
    const fp = lotBox(swap.lot), box = swap.expectedBox;
    const shorter = fp.street === 'main'
      ? (fp.side === 'east' ? box.maxX < fp.maxX - 0.05 : box.minX > fp.minX + 0.05)
      : (fp.side === 'north' ? box.maxZ < fp.maxZ - 0.05 : box.minZ > fp.minZ + 0.05);
    return shorter;
  }).map(swap => swap.lot);
}
