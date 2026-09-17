// Los LATERALES de cada casa. El frente lo trae el GLB y el fondo lo vistio L con 152 decals; los dos
// laterales no tenian nada, y son lo que el jugador tiene mas cerca: medido con linea de vista real
// desde el piso pisable (evidencia/ciudad/caras-desnudas.mjs), las 76 laterales se ven a 8 m o menos,
// siete a menos de 70 cm, ~1.245 m2 de pared en blanco. Es lo unico que Jose se paro a mirar en el video.
//
// Donde se apoya cada decal: en el MAPA MEDIDO de la pared (src/sideWallMap.js, generado por
// scripts/measure-side-walls.mjs contra la geometria real de los GLB): la cara dominante, el tramo con pared
// plana y, por cada columna de 25 cm, donde empieza y termina esa pared. El primer corte usaba una cara, el
// tramo de la cintura y la altura del AABB, y un refutador fresco lo destrozo con rayos: bajadas pluviales
// paradas en el aire delante de porches retranqueados (casas E, infill 2 y 4), canos por encima del alero en
// 15 lotes (el AABB es la cumbrera), un aire acondicionado colgado sobre el techo de HOME-028, una ventana
// dentro de un pilar en las tres casas E. Ahora un decal solo existe si CADA columna que toca lo aguanta
// entre su base y su tope (`wallFits`); si no cabe donde el reparto lo manda, se corre por la pared o no va.
//
// Y lo que el fondo no tenia que mirar y aca si: un decal lateral puede nacer DENTRO de una cerca lateral
// (hay 30), de un cierre de frente que monta 0,16 m sobre la casa, de un rincon que monta 0,32, de un
// garage del kit que tapa el hueco de la transversal, o del delantal del vecino. Se cruza contra todas
// esas listas (`sideObstacles`).
import { HOUSE_FOOTPRINTS, lots } from './lotState.js';
import { HOUSE_WAISTS, DECAL_DEPTH, EDGE_CLEAR, MIN_WALL, backDecalMatrices } from './backFacadeState.js';
import { SIDE_WALL_MAP, SIDE_WALL_STEP } from './sideWallMap.js';
import { LOT_FENCE_COLLIDERS, fenceLeaves, fencePosts } from './lotFenceState.js';
import { yardBoxes } from './yardDressingState.js';
import { frontAprons } from './frontApronState.js';
import { dressingPlacements, veredaPresetById } from './streetDressingState.js';
import { CITY_PERIMETER } from './cityBoundsState.js';
import { STREET_LAYOUT } from './streetLifeState.js';
import { propColliders, solidosPresetById } from './propColliderState.js';

// `gear` es lo que solo entra en el preset 2. `depth` es cuanto sobresale: un decal plano sobresale
// DECAL_DEPTH; un aire acondicionado, 0,38 m, y por eso va por encima de la cabeza (HEAD_CLEAR).
export const SIDE_KIT = Object.freeze({
  windowLit: Object.freeze({ width: 0.82, height: 0.92, sill: 1.42, depth: DECAL_DEPTH, color: '#ffd79a', lit: true, gear: false }),
  windowDark: Object.freeze({ width: 0.74, height: 0.86, sill: 1.5, depth: DECAL_DEPTH, color: '#2b3238', lit: false, gear: false }),
  vent: Object.freeze({ width: 0.46, height: 0.42, sill: 1.72, depth: DECAL_DEPTH, color: '#5a5f5c', lit: false, gear: false }),
  downpipe: Object.freeze({ width: 0.11, height: 0, sill: 0, depth: DECAL_DEPTH, color: '#5d625e', lit: false, gear: false }),
  ac: Object.freeze({ width: 0.72, height: 0.62, sill: 2.45, depth: 0.38, color: '#7b827f', lit: false, gear: true }),
  meter: Object.freeze({ width: 0.34, height: 0.5, sill: 1.25, depth: 0.1, color: '#6b6f5e', lit: false, gear: true }),
  lamp: Object.freeze({ width: 0.16, height: 0.24, sill: 2.35, depth: 0.12, color: '#ffe2b0', lit: true, gear: true }),
});
const WINDOW_KINDS = new Set(['windowLit', 'windowDark', 'vent']);

// Por debajo de esto, nada sobresale mas de WALL_PROUD_MAX: siete laterales estan a menos de 70 cm del
// piso pisable y un aparato a la altura del pecho seria una pared invisible nueva.
export const HEAD_CLEAR = 2.05;
export const WALL_PROUD_MAX = 0.12;
export const ROW_STEP = 2.7;            // segunda fila de ventanas en las casas de dos plantas
export const SLIDE_STEP = 0.1;          // de a cuanto se corre un decal que no cabe donde el reparto lo manda
export const MIN_PIPE = 2.2;            // una bajada mas corta que esto no se pone
export const PIPE_GAP = 0.05;           // la bajada termina este poco por debajo del tope de la pared

// Mirados de los cuatro lados (evidencia/ciudad/ver4.mjs, 2026-09-11). `windows`/`fixtures` dicen en que
// lados del mundo va cada cosa: 'all', una lista, o [] (nada). Las casas ciegas (C, D, B, la tienda, el
// KFC) no figuran: toman el default. Las que ya traen ventanas en el lateral solo llevan bajada, aire y
// medidor -- un decal encima seria una ventana sobre otra. Las cajas de vidrio del city pack y el
// restaurante fotoescaneado no llevan nada. Las que tienen UN lateral ciego se listan por lote, porque
// el mismo GLB rota distinto en cada colocacion (la casa E apunta su lado ciego al norte en HOME-012,
// al sur en HOME-017 y al este en HOME-023). Donde ADEMAS cabe cada cosa, lo dice el mapa medido.
export const SIDE_RULES = Object.freeze({
  byAsset: Object.freeze({
    cityPackDiner: Object.freeze({ windows: [], fixtures: [] }),
    cityPackCommercialPurple: Object.freeze({ windows: [], fixtures: [] }),
    cityPackCommercialTower: Object.freeze({ windows: [], fixtures: [] }),
    cityPackResidential: Object.freeze({ windows: [], fixtures: [] }),
    cityPackHighrise: Object.freeze({ windows: [], fixtures: [] }),
    restaurant: Object.freeze({ windows: [], fixtures: [] }),
    simpleHouseF: Object.freeze({ windows: [], fixtures: 'all' }),
    simpleHouseG: Object.freeze({ windows: [], fixtures: 'all' }),
    simpleHouseH: Object.freeze({ windows: [], fixtures: 'all' }),
    infillHouse1: Object.freeze({ windows: [], fixtures: 'all' }),
    infillHouse2: Object.freeze({ windows: [], fixtures: 'all' }),
    infillHouse3: Object.freeze({ windows: [], fixtures: 'all' }),
    cityHouse: Object.freeze({ windows: [], fixtures: 'all' }),
  }),
  byLot: Object.freeze({
    // el motel: el norte trae ventanas; el sur es un muro verde ciego cuya planta baja sobresale 20 cm y
    // cuyo ultimo piso se retranquea 1,21 m: el mapa lo sabe, las ventanas arrancan en la segunda fila
    'BLOCK-001': Object.freeze({ windows: ['south'], fixtures: [], firstRow: 1 }),
    'HOME-028': Object.freeze({ windows: ['west'], fixtures: 'all' }),         // infill 4: el este trae dos ventanas y el porche
    'HOME-012': Object.freeze({ windows: ['north'], fixtures: 'all' }),        // casa E
    'HOME-017': Object.freeze({ windows: ['south'], fixtures: 'all' }),        // casa E
    'HOME-023': Object.freeze({ windows: ['east'], fixtures: 'all' }),         // casa E
    // la tienda: su cara SUR es el fondo del GLB (dos ventanas y una buhardilla); la norte es ciega
    'START-WEST': Object.freeze({ windows: ['north'], fixtures: ['north'] }),
  }),
});
const DEFAULT_RULE = Object.freeze({ windows: 'all', fixtures: 'all' });
export function ruleFor(lot) {
  return SIDE_RULES.byLot[lot.id] ?? SIDE_RULES.byAsset[lot.footprint.asset] ?? DEFAULT_RULE;
}
const allows = (rule, side) => rule === 'all' || rule.includes(side);

// --- La perilla -----------------------------------------------------------------------------------
export const LATERALES_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', windows: false, gear: false }),
  Object.freeze({ id: 1, key: 'windows', label: 'VENTANAS', windows: true, gear: false }),
  Object.freeze({ id: 2, key: 'equipped', label: 'EQUIPADAS', windows: true, gear: true }),
]);
export const DEFAULT_LATERALES_PRESET = 2;
export function lateralesPresetById(id) {
  return LATERALES_PRESETS.find(preset => preset.id === id) ?? LATERALES_PRESETS[DEFAULT_LATERALES_PRESET];
}
export function readLateralesPreset(search, fallback = DEFAULT_LATERALES_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('laterales') ?? params.get('lados');
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && LATERALES_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
const unit = salt => hash32(`side#${salt}`) / 4294967296;
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// Las dos paredes laterales de un lote, con su mapa medido. Son perpendiculares al fondo: en la avenida
// el fondo es una cara x, asi que los laterales son las caras z (sur y norte); en la transversal, al reves.
// `frontEnd` es el extremo que da a la calle: las ventanas se cargan hacia ahi, que es lo que se ve.
// Sin mapa (no paso hoy, pero puede pasar con un GLB nuevo) la pared no es `usable` y no lleva nada.
export function sideWalls(lot) {
  const waist = HOUSE_WAISTS.get(lot.id);
  if (!waist) return [];
  const entry = SIDE_WALL_MAP.get(lot.id) ?? {};
  const axis = lot.back.axis === 'x' ? 'z' : 'x';
  const frontValue = lot.front.value;
  return [-1, 1].map(outward => {
    const side = axis === 'z' ? (outward < 0 ? 'south' : 'north') : (outward < 0 ? 'west' : 'east');
    const m = entry[side] ?? null;
    const waistFace = axis === 'z' ? (outward < 0 ? waist.minZ : waist.maxZ) : (outward < 0 ? waist.minX : waist.maxX);
    const from = m ? m.from : (axis === 'z' ? waist.minX : waist.minZ);
    const to = m ? m.to : (axis === 'z' ? waist.maxX : waist.maxZ);
    const frontEnd = Math.abs(from - frontValue) <= Math.abs(to - frontValue) ? from : to;
    const tops = m ? m.top.filter(t => t !== null) : [];
    return Object.freeze({
      id: `${lot.id}/${side}`, lot: lot.id, axis, side, outward, from, to, frontEnd,
      face: m ? m.face : waistFace, usable: Boolean(m) && tops.length > 0,
      base: m ? m.base : Object.freeze([]), top: m ? m.top : Object.freeze([]), ledges: m ? m.ledges : Object.freeze([]),
      height: tops.length ? Math.max(...tops) : lot.footprint.height,
    });
  });
}

// ¿Cabe un rectangulo [a0, a1] x [y0, y1] apoyado en pared plana? Cada columna de 25 cm que toca tiene
// que existir y aguantarlo entre su base y su tope -- que el mapa redondea medio paso hacia afuera, asi
// que se exige ese margen (MAP_MARGIN) menos 2 cm de tolerancia -- y sin una repisa horizontal adentro.
export const MAP_MARGIN = SIDE_WALL_STEP / 2;
// Una bajada pluvial puede cruzar un zocalo o una moldura por debajo de esta altura: un cano que entra
// un centimetro en el zocalo se lee como un cano. Una ventana o un aparato, no.
export const PIPE_LEDGE_FLOOR = 0.8;
export function wallFits(wall, a0, a1, y0, y1, tol = 0.02, ledgeFloor = 0) {
  if (!wall.usable || a0 < wall.from - 1e-6 || a1 > wall.to + 1e-6) return false;
  const i0 = Math.max(0, Math.floor((a0 - wall.from) / SIDE_WALL_STEP + 1e-6));
  const i1 = Math.min(wall.top.length - 1, Math.ceil((a1 - wall.from) / SIDE_WALL_STEP - 1e-6) - 1);
  for (let i = i0; i <= i1; i++) {
    if (wall.top[i] === null || wall.base[i] + MAP_MARGIN > y0 + tol || wall.top[i] - MAP_MARGIN < y1 - tol) return false;
    if ((wall.ledges[i] ?? []).some(h => h >= ledgeFloor && h > y0 + tol && h < y1 - tol)) return false;
  }
  return true;
}
// La base mas alta y el tope mas bajo de las columnas que toca [a0, a1] (para la bajada, que va de una a otro).
function columnBand(wall, a0, a1) {
  const i0 = Math.max(0, Math.floor((a0 - wall.from) / SIDE_WALL_STEP + 1e-6));
  const i1 = Math.min(wall.top.length - 1, Math.ceil((a1 - wall.from) / SIDE_WALL_STEP - 1e-6) - 1);
  let base = 0, top = Infinity;
  for (let i = i0; i <= i1; i++) {
    if (wall.top[i] === null) return null;
    base = Math.max(base, wall.base[i]); top = Math.min(top, wall.top[i]);
  }
  return top === Infinity ? null : { base, top };
}

// La caja XZ que ocupa un decal, con su rotacion. Sirve para cruzarlo contra lo que ya ocupa suelo.
export function decalBox(decal) {
  const turned = Math.abs(decal.rotationY) > 1e-6;
  const halfX = (turned ? decal.depth : decal.width) / 2, halfZ = (turned ? decal.width : decal.depth) / 2;
  return { minX: decal.x - halfX, maxX: decal.x + halfX, minZ: decal.z - halfZ, maxZ: decal.z + halfZ };
}

// TODO lo que ya ocupa suelo cerca de una pared, de las diez fuentes. Se calcula una vez.
let obstaclesCache = null;
export function sideObstacles() {
  if (obstaclesCache) return obstaclesCache;
  const out = [];
  const push = (b, from, id) => { if (b && Number.isFinite(b.minX)) out.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, from, id }); };
  for (const f of HOUSE_FOOTPRINTS) push(f, 'casa', f.id);
  for (const c of LOT_FENCE_COLLIDERS) push(c, 'cerca', c.id);
  for (const lf of fenceLeaves()) {
    const c = Math.abs(Math.cos(lf.yaw)), s = Math.abs(Math.sin(lf.yaw));
    const L = (lf.length ?? lf.width ?? 1) / 2, T = 0.1;
    push({ minX: lf.x - (c * L + s * T), maxX: lf.x + (c * L + s * T), minZ: lf.z - (s * L + c * T), maxZ: lf.z + (s * L + c * T) }, 'hoja', lf.id);
  }
  for (const p of fencePosts()) push({ minX: p.x - 0.09, maxX: p.x + 0.09, minZ: p.z - 0.09, maxZ: p.z + 0.09 }, 'poste', p.id);
  // los postes y las prendas del tendedero vienen con x/z/width/depth y sin `box`: se les arma la caja
  for (const y of yardBoxes()) {
    const b = y.box ?? (Number.isFinite(y.minX) ? y : { minX: y.x - (y.width ?? 0.2) / 2, maxX: y.x + (y.width ?? 0.2) / 2, minZ: y.z - (y.depth ?? 0.2) / 2, maxZ: y.z + (y.depth ?? 0.2) / 2 });
    push(b, 'patio', `${y.lot}/${y.kind}`);
  }
  for (const a of frontAprons()) push(a, 'delantal', a.id);
  for (const p of dressingPlacements(veredaPresetById(2))) push(p.box, 'vestido', p.id);
  for (const p of CITY_PERIMETER) push(p, 'perimetro', p.id);
  for (const o of STREET_LAYOUT.obstacles) {
    if (HOUSE_FOOTPRINTS.some(f => overlaps(o, f))) continue;     // las cajas de casa son un TOPE; la huella medida ya entro arriba
    push(o, 'obstaculo', o.kind ?? 'street');
  }
  for (const c of propColliders(solidosPresetById(2))) push(c, 'prop', c.id);
  obstaclesCache = Object.freeze(out.map(Object.freeze));
  return obstaclesCache;
}

function conflicts(decal, lotId, obstacles) {
  const box = decalBox(decal);
  const bottom = decal.y - decal.height / 2;
  for (const o of obstacles) {
    if (o.from === 'casa' && o.id === lotId) continue;
    if (o.from === 'delantal' && bottom > 0.3) continue;   // el delantal mide 12 cm: solo frena lo que toca el piso
    if (overlaps(box, o)) return o;
  }
  return null;
}

function decalAt(wall, kind, along, sill, height) {
  const spec = SIDE_KIT[kind];
  const face = wall.face + wall.outward * spec.depth / 2;
  return Object.freeze({
    lot: wall.lot, side: wall.side, kind, lit: spec.lit, color: spec.color,
    x: +(wall.axis === 'z' ? along : face).toFixed(3),
    z: +(wall.axis === 'z' ? face : along).toFixed(3),
    y: +(sill + height / 2).toFixed(3),
    width: spec.width, height, depth: spec.depth,
    rotationY: wall.axis === 'z' ? 0 : Math.PI / 2,
  });
}
const vertOverlap = (a, b) => !(a.y + a.height / 2 <= b.y - b.height / 2 || b.y + b.height / 2 <= a.y - a.height / 2);

// Coloca un decal a `fraction` del frente de la pared (0 = esquina de la calle, 1 = esquina del fondo), a
// `edge` de las esquinas. Si donde cae no hay pared plana que lo aguante (mapa), o nace dentro de algo
// (obstaculos), o pisa otro decal de la misma pared, se corre de a SLIDE_STEP hacia los dos lados hasta
// medio tramo; si no hay lugar, no se pone. Para la bajada (`height` null) el pie y el tope los dan las
// columnas: nace medio paso sobre la base de la pared (la base esta redondeada hacia abajo y el zocalo de
// la casa E sobresale 9 cm justo ahi) y sube hasta medio paso mas PIPE_GAP bajo su tope; solo va si mide MIN_PIPE.
function place(wall, kind, fraction, sill, height, obstacles, out, edge = EDGE_CLEAR) {
  const spec = SIDE_KIT[kind];
  const lo = wall.from + edge + spec.width / 2, hi = wall.to - edge - spec.width / 2;
  if (!wall.usable || hi < lo) return null;
  const dir = wall.frontEnd === wall.from ? 1 : -1;
  const base = wall.frontEnd + dir * (edge + fraction * (wall.to - wall.from - 2 * edge));
  const reach = Math.ceil((hi - lo) / 2 / SLIDE_STEP);
  const offsets = [0];
  for (let k = 1; k <= reach; k++) offsets.push(k * SLIDE_STEP, -k * SLIDE_STEP);
  const tried = new Set();
  for (const offset of offsets) {
    const along = +Math.min(hi, Math.max(lo, base + offset)).toFixed(3);
    if (tried.has(along)) continue;
    tried.add(along);
    let y0 = sill, h = height;
    if (height === null) {
      const band = columnBand(wall, along - spec.width / 2, along + spec.width / 2);
      if (!band) continue;
      y0 = +(band.base + MAP_MARGIN).toFixed(3); h = +(band.top - MAP_MARGIN - PIPE_GAP - y0).toFixed(2);
      if (h < MIN_PIPE) continue;
    }
    if (!wallFits(wall, along - spec.width / 2, along + spec.width / 2, y0, y0 + h, 0.02, kind === 'downpipe' ? PIPE_LEDGE_FLOOR : 0)) continue;
    const decal = decalAt(wall, kind, along, y0, h);
    if (conflicts(decal, wall.lot, obstacles)) continue;
    if (out.some(d => d.lot === decal.lot && d.side === decal.side && overlaps(decalBox(d), decalBox(decal)) && vertOverlap(d, decal))) continue;
    out.push(decal);
    return decal;
  }
  return null;
}

export function sideDecals(all = lots(), preset = lateralesPresetById(DEFAULT_LATERALES_PRESET)) {
  const out = [];
  if (!preset.windows) return out;
  const obstacles = sideObstacles();
  for (const lot of all) {
    const walls = sideWalls(lot).filter(wall => wall.usable);
    if (!walls.length) continue;
    const rule = ruleFor(lot);
    // La bajada va en UNA pared, en la esquina de la calle, elegida entre las que admiten accesorios: el
    // motel solo admite el sur, y sortear entre las dos lo dejaba sin bajada la mitad de las veces.
    const fixtureWalls = walls.filter(wall => allows(rule.fixtures, wall.side));
    const pipeSide = fixtureWalls.length ? fixtureWalls[unit(`pipe:${lot.id}`) < 0.5 ? 0 : fixtureWalls.length - 1].side : null;
    const single = fixtureWalls.length === 1;
    for (const wall of walls) {
      const span = wall.to - wall.from;
      if (allows(rule.windows, wall.side) && span - 2 * EDGE_CLEAR >= 1) {
        // filas: una a la altura de la vista, y otra cada ROW_STEP mientras quepa bajo el tope mas alto de
        // la pared; donde el tope local es mas bajo (alero, cornisa, retranqueo) `wallFits` la rechaza
        const rows = [];
        for (let sill = SIDE_KIT.windowLit.sill + ROW_STEP * (rule.firstRow ?? 0); rows.length < 3 && sill + SIDE_KIT.windowLit.height <= wall.height - 0.15; sill += ROW_STEP) rows.push(sill);
        const slots = span < MIN_WALL ? [[0.5, 'vent']] : span < 3.6 ? [[0.45, null]] : [[0.3, null], [0.68, null]];
        const before = out.length;
        rows.forEach((sill, row) => slots.forEach(([fraction, forced], slot) => {
          const kind = forced ?? (unit(`lit:${lot.id}:${wall.side}:${row}:${slot}`) < 0.55 ? 'windowLit' : 'windowDark');
          const spec = SIDE_KIT[kind];
          place(wall, kind, fraction, sill + (spec.sill - SIDE_KIT.windowLit.sill), spec.height, obstacles, out);
        }));
        // de noche lo que se lee es la ventana ENCENDIDA, y una por pared: en el primer corte, la
        // lateral mas expuesta del mapa (HOME-002 sur, a 0,31 m de la vereda) salio con las dos apagadas
        if (!out.slice(before).some(d => d.lit)) {
          const dark = out.findIndex((d, i) => i >= before && d.kind === 'windowDark');
          if (dark >= 0) out[dark] = relight(out[dark]);
        }
      }
      if (allows(rule.fixtures, wall.side)) {
        const pipeWall = wall.side === pipeSide;
        if (pipeWall) {
          // a EDGE_CLEAR/2 de la esquina de la calle: el cierre de frente monta 0,16 m sobre la casa y el
          // rincon 0,32; si igual choca, o si ahi la pared es un porche, `place` la corre hacia adentro
          place(wall, 'downpipe', 0, 0, null, obstacles, out, EDGE_CLEAR / 2);
          if (preset.gear) place(wall, 'meter', 0.22, SIDE_KIT.meter.sill, SIDE_KIT.meter.height, obstacles, out, EDGE_CLEAR / 2);
        }
        if (preset.gear && (!pipeWall || single)) {
          place(wall, 'ac', 0.6, SIDE_KIT.ac.sill, SIDE_KIT.ac.height, obstacles, out);
          if (unit(`lamp:${lot.id}`) < 0.4) place(wall, 'lamp', 0.12, SIDE_KIT.lamp.sill, SIDE_KIT.lamp.height, obstacles, out);
        }
      }
    }
  }
  return out;
}

// Una ventana apagada que pasa a encendida: mismo lugar, el tamano y el antepecho del kit encendido.
function relight(d) {
  const spec = SIDE_KIT.windowLit;
  return Object.freeze({ ...d, kind: 'windowLit', lit: true, color: spec.color, width: spec.width, height: spec.height, y: +(d.y - d.height / 2 - (SIDE_KIT.windowDark.sill - spec.sill) + spec.height / 2).toFixed(3) });
}

export const sideDecalMatrices = (decals = sideDecals()) => backDecalMatrices(decals);
export const isWindowKind = kind => WINDOW_KINDS.has(kind);

// Las cuatro mallas de main.js: apagados y encendidos, por normal y por equipo. Los encendidos van con
// MeshBasicMaterial (su color ES su radiancia); el equipo se apaga solo con el preset 1.
export function sideDecalGroups(decals = sideDecals(lots(), lateralesPresetById(2))) {
  const gear = d => SIDE_KIT[d.kind].gear;
  return {
    dark: decals.filter(d => !d.lit && !gear(d)),
    lit: decals.filter(d => d.lit && !gear(d)),
    gearDark: decals.filter(d => !d.lit && gear(d)),
    gearLit: decals.filter(d => d.lit && gear(d)),
  };
}
