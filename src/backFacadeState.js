// El fondo de cada casa. Hoy es una pared lisa del GLB: se ve por cada porton abierto y por encima de
// las cercas de 1,2 m, y es lo que hace que el patio parezca de alguien y no un depósito.
//
// Los decals se apoyan en la CINTURA medida, no en el AABB. El AABB lo fija el alero -- en HOME-002 el
// muro esta 0,248 m adentro de la cornisa por lado -- asi que una puerta apoyada en el AABB quedaria
// flotando delante de la pared. Medido con scripts/measure-house-footprints.mjs (2026-09-11).
import { HOUSE_FOOTPRINTS, lots } from './lotState.js';

export const HOUSE_WAISTS = Object.freeze(new Map([
  ['HOME-019', Object.freeze({ minX: -49.148, maxX: -42.852, minZ: 39.256, maxZ: 45.544 })],
  ['cityPackDiner@-37/42.4', Object.freeze({ minX: -38.883, maxX: -35.117, minZ: 40.517, maxZ: 44.283 })],
  ['HOME-025', Object.freeze({ minX: -31.323, maxX: -25.677, minZ: 40.444, maxZ: 44.356 })],
  ['HOME-020', Object.freeze({ minX: -23.077, maxX: -16.923, minZ: 39.605, maxZ: 45.595 })],
  ['HOME-022', Object.freeze({ minX: 14.862, maxX: 21.138, minZ: 39.573, maxZ: 45.227 })],
  ['RESTAURANT', Object.freeze({ minX: 26.301, maxX: 37.699, minZ: 39.613, maxZ: 48.687 })],
  ['BLOCK-003', Object.freeze({ minX: 43.773, maxX: 50.227, minZ: 39.15, maxZ: 45.65 })],
  ['BLOCK-004', Object.freeze({ minX: -49.25, maxX: -42.75, minZ: 22.35, maxZ: 28.85 })],
  ['BLOCK-005', Object.freeze({ minX: -39.058, maxX: -34.942, minZ: 24.125, maxZ: 27.075 })],
  ['HOME-026', Object.freeze({ minX: -31.174, maxX: -25.826, minZ: 22.78, maxZ: 28.42 })],
  ['HOME-021', Object.freeze({ minX: -23.148, maxX: -16.852, minZ: 22.456, maxZ: 28.744 })],
  ['HOME-023', Object.freeze({ minX: 15.018, maxX: 20.982, minZ: 23.847, maxZ: 27.353 })],
  ['HOME-027', Object.freeze({ minX: 25.31, maxX: 28.69, minZ: 23.007, maxZ: 28.193 })],
  ['HOME-028', Object.freeze({ minX: 34.761, maxX: 39.239, minZ: 22.632, maxZ: 28.568 })],
  ['HOME-024', Object.freeze({ minX: 43.923, maxX: 50.077, minZ: 22.605, maxZ: 28.595 })],
  ['START-EAST', Object.freeze({ minX: 6.402, maxX: 11.572, minZ: 9.078, maxZ: 14.422 })],
  ['cityPackKfc@9.2/18.44', Object.freeze({ minX: 6.942, maxX: 11.458, minZ: 16.179, maxZ: 20.701 })],
  ['HOME-001', Object.freeze({ minX: 6.452, maxX: 10.348, minZ: 22.385, maxZ: 27.895 })],
  ['HOME-002', Object.freeze({ minX: 7.803, maxX: 11.547, minZ: 38.864, maxZ: 45.136 })],
  ['HOME-003', Object.freeze({ minX: 7.802, maxX: 11.248, minZ: 47.478, maxZ: 52.822 })],
  ['HOME-006', Object.freeze({ minX: 7.803, maxX: 11.547, minZ: 54.764, maxZ: 61.036 })],
  ['HOME-009', Object.freeze({ minX: 7.802, maxX: 11.248, minZ: 62.728, maxZ: 68.072 })],
  ['HOME-011', Object.freeze({ minX: 7.803, maxX: 11.547, minZ: 69.464, maxZ: 75.736 })],
  ['HOME-012', Object.freeze({ minX: 7.922, maxX: 11.428, minZ: 77.018, maxZ: 82.982 })],
  ['HOME-014', Object.freeze({ minX: 6.53, maxX: 12.52, minZ: 84.423, maxZ: 90.577 })],
  ['HOME-016', Object.freeze({ minX: 6.531, maxX: 12.819, minZ: 91.852, maxZ: 98.148 })],
  ['HOME-018', Object.freeze({ minX: 6.848, maxX: 12.502, minZ: 99.262, maxZ: 105.538 })],
  ['START-WEST', Object.freeze({ minX: -9.828, maxX: -6.772, minZ: 12.596, maxZ: 16.804 })],
  ['BLOCK-001', Object.freeze({ minX: -12.45, maxX: -7.55, minZ: 19.086, maxZ: 25.914 })],
  ['HOME-004', Object.freeze({ minX: -11.248, maxX: -7.802, minZ: 39.728, maxZ: 45.072 })],
  ['HOME-005', Object.freeze({ minX: -11.547, maxX: -7.803, minZ: 46.464, maxZ: 52.736 })],
  ['HOME-007', Object.freeze({ minX: -11.248, maxX: -7.802, minZ: 55.128, maxZ: 60.472 })],
  ['HOME-008', Object.freeze({ minX: -11.547, maxX: -7.803, minZ: 62.064, maxZ: 68.336 })],
  ['HOME-010', Object.freeze({ minX: -11.248, maxX: -7.802, minZ: 69.828, maxZ: 75.172 })],
  ['HOME-013', Object.freeze({ minX: -12.819, maxX: -6.531, minZ: 76.852, maxZ: 83.148 })],
  ['HOME-015', Object.freeze({ minX: -12.502, maxX: -6.848, minZ: 84.262, maxZ: 90.538 })],
  ['HOME-017', Object.freeze({ minX: -11.428, maxX: -7.922, minZ: 91.818, maxZ: 97.782 })],
  ['BLOCK-002', Object.freeze({ minX: -12.145, maxX: -6.905, minZ: 98.914, maxZ: 105.886 })],]));

// Cada casa lleva: una puerta trasera, una ventana encendida, una apagada (o una rejilla si la pared es
// angosta) y una bajada pluvial en una esquina.
export const BACK_KIT = Object.freeze({
  door: Object.freeze({ width: 0.92, height: 2.02, sill: 0, color: '#4a3f31', lit: false }),
  windowLit: Object.freeze({ width: 0.82, height: 0.92, sill: 1.42, color: '#ffd79a', lit: true }),
  windowDark: Object.freeze({ width: 0.74, height: 0.86, sill: 1.5, color: '#2b3238', lit: false }),
  vent: Object.freeze({ width: 0.46, height: 0.42, sill: 1.72, color: '#5a5f5c', lit: false }),
  downpipe: Object.freeze({ width: 0.11, height: 0, sill: 0, color: '#5d625e', lit: false }),
});

export const DECAL_DEPTH = 0.05;      // cuanto sobresale de la pared
export const MIN_WALL = 2.2;          // debajo de esto la pared solo aguanta puerta + rejilla
export const EDGE_CLEAR = 0.34;       // margen a las esquinas

function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
const unit = salt => hash32(`back#${salt}`) / 4294967296;

// La pared trasera de un lote, en la cintura: sobre que eje corre, en que coordenada esta su cara, de
// donde a donde llega y hacia donde mira.
export function backWall(lot) {
  const waist = HOUSE_WAISTS.get(lot.id);
  if (!waist) return null;
  const axis = lot.back.axis;                      // 'x' en la avenida, 'z' en la transversal
  const lo = axis === 'x' ? waist.minX : waist.minZ;
  const hi = axis === 'x' ? waist.maxX : waist.maxZ;
  const facesLow = lot.back.value < (lo + hi) / 2;
  return {
    id: lot.id, axis, outward: facesLow ? -1 : 1,
    face: facesLow ? lo : hi,
    from: axis === 'x' ? waist.minZ : waist.minX,
    to: axis === 'x' ? waist.maxZ : waist.maxX,
    height: lot.footprint.height,
  };
}

export function backDecals(all = lots()) {
  const out = [];
  for (const lot of all) {
    const wall = backWall(lot);
    if (!wall) continue;
    const span = wall.to - wall.from;
    const usable = span - 2 * EDGE_CLEAR;
    if (usable < 1) continue;
    const narrow = span < MIN_WALL;
    const kinds = narrow ? ['door', 'vent'] : ['door', 'windowLit', 'windowDark'];
    // se reparten sobre la pared, en el orden en que vienen, con un corrimiento propio de la casa
    const shift = (unit(`shift:${lot.id}`) - 0.5) * 0.3;
    kinds.forEach((kind, index) => {
      const spec = BACK_KIT[kind];
      const slot = (index + 0.5) / kinds.length + shift / kinds.length;
      const along = wall.from + EDGE_CLEAR + Math.min(Math.max(slot, 0.08), 0.92) * usable;
      out.push(Object.freeze({
        lot: lot.id, kind, lit: spec.lit, color: spec.color,
        x: +(wall.axis === 'x' ? wall.face + wall.outward * DECAL_DEPTH / 2 : along).toFixed(3),
        z: +(wall.axis === 'x' ? along : wall.face + wall.outward * DECAL_DEPTH / 2).toFixed(3),
        y: +(spec.sill + spec.height / 2).toFixed(3),
        width: spec.width, height: spec.height, depth: DECAL_DEPTH,
        rotationY: wall.axis === 'x' ? Math.PI / 2 : 0,
      }));
    });
    // la bajada pluvial, en la esquina que le toque
    const pipe = BACK_KIT.downpipe;
    const corner = unit(`pipe:${lot.id}`) < 0.5 ? wall.from + EDGE_CLEAR * 0.42 : wall.to - EDGE_CLEAR * 0.42;
    // se redondea ANTES de derivar el centro: con la altura cruda, `y - height/2` daba -0,0005 y el
    // test leia que la bajada se hundia en el piso
    const height = +Math.max(2.2, Math.min(wall.height * 0.92, 6)).toFixed(3);
    out.push(Object.freeze({
      lot: lot.id, kind: 'downpipe', lit: false, color: pipe.color,
      x: +(wall.axis === 'x' ? wall.face + wall.outward * DECAL_DEPTH / 2 : corner).toFixed(3),
      z: +(wall.axis === 'x' ? corner : wall.face + wall.outward * DECAL_DEPTH / 2).toFixed(3),
      y: height / 2,
      width: pipe.width, height, depth: DECAL_DEPTH,
      rotationY: wall.axis === 'x' ? Math.PI / 2 : 0,
    }));
  }
  return out;
}

export function backDecalMatrices(decals = backDecals()) {
  const out = new Float32Array(decals.length * 16);
  decals.forEach((decal, index) => {
    const cos = Math.cos(decal.rotationY), sin = Math.sin(decal.rotationY);
    const m = out.subarray(index * 16, index * 16 + 16);
    m[0] = cos * decal.width; m[2] = -sin * decal.width;
    m[5] = decal.height;
    m[8] = sin * decal.depth; m[10] = cos * decal.depth;
    m[12] = decal.x; m[13] = decal.y; m[14] = decal.z; m[15] = 1;
  });
  return out;
}
