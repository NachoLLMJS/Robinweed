// El umbral delante de cada puerta.
//
// EL DEFECTO (diagnostico 2026-09-11): "ninguna casa tiene camino de entrada, la puerta abre directo al cesped".
// El delantal (?suelo) puso pavimento del cordon a la pared; lo que falta es que la puerta se lea como puerta: un
// escalon de piedra de 1,0 x 0,30 m y 8 cm delante de cada hoja (el zocalo de la casa C esta a 26 cm y el delantal a
// 12: medio escalon; con 4 cm no se leia desde la calle), apoyado en el delantal (o en el pasto, si el
// lote no tiene delantal). No hay retiro para un camino de entrada (22 de 38 casas a menos de 1,2 m del cordon).
//
// DONDE ESTA LA PUERTA no lo sabia nadie: los GLB son una malla por modelo y los spawns de propiedad nacen en el
// centro del lote. scripts/measure-front-doors.mjs la mide con rayos contra el frente (jambas que llegan al piso,
// dintel sobre pared plana, hoja rehundida; la casa G va por tabla porque su puerta es solo textura) y escribe
// src/frontDoorMap.js. El umbral arranca en la cara del ZOCALO (la pared mas lo que sobresale a nivel del piso),
// no en el AABB: el AABB es el alero.
//
// QUIEN NO LLEVA UMBRAL: las casas con porche o plataforma propios (zocalo > 0,3 m: casa E, infill 2, 3 y 4, casa
// H), las que ya tienen escalones (frontY > 5 cm: la tienda, la casa del jugador), las cajas del city pack y el
// restaurante (entradas propias) y las puertas fuera de 0,7..1,8 m (un porton no es una puerta).
import { lots as allLots } from './lotState.js';
import { frontAprons, APRON_TOP, GRASS_TOP } from './frontApronState.js';
import { frontMeasureFor } from './frontFaceState.js';

export const STOOP = Object.freeze({ width: 1.0, depth: 0.30, height: 0.08 });
// Un zocalo mas hondo que esto es un porche o una plataforma, no un zocalo: la casa ya tiene su entrada.
export const PLINTH_MAX = 0.3;
export const OWN_STEP_MIN = 0.05;
export const DOOR_WIDTH = Object.freeze({ min: 0.7, max: 1.8 });
// Lo que el vestido tiene que dejar libre delante de una puerta: la puerta con margen a los lados y 0,6 m hacia la
// calle. Un tacho delante de una puerta es exactamente lo que no queremos.
export const KEEPOUT = Object.freeze({ side: 0.3, out: 0.6 });

const r4 = n => +n.toFixed(4);
// el tramo del frente del lote a lo largo de la fachada: nada sale de ahi (una reserva que asome 3,5 cm fuera de la
// torre comercial le robaba el sitio al relleno de la punta oeste de la fila)
const facadeSpan = (lot, m) => (m.axis === 'x' ? [lot.footprint.minZ, lot.footprint.maxZ] : [lot.footprint.minX, lot.footprint.maxX]);
const clampAlong = (lot, m, half) => { const [a0, a1] = facadeSpan(lot, m); return [Math.max(a0, m.along - half), Math.min(a1, m.along + half)]; };
// el borde del delantal que toca la casa
const apronInner = (lot, a) => (lot.footprint.street === 'main' ? (lot.footprint.side === 'west' ? a.minX : a.maxX) : (lot.footprint.side === 'south' ? a.minZ : a.maxZ));

export function stoopEligibility(lot) {
  const m = frontMeasureFor(lot);
  if (!m) return { ok: false, why: 'sin medicion' };
  if (/^cityPack|^RESTAURANT$|^START-/.test(lot.id)) return { ok: false, why: 'entrada propia del modelo' };
  if (m.width < DOOR_WIDTH.min || m.width > DOOR_WIDTH.max) return { ok: false, why: `ancho ${m.width}` };
  if (m.plinth > PLINTH_MAX) return { ok: false, why: `porche o plataforma de ${m.plinth} m` };
  if (m.frontY > OWN_STEP_MIN) return { ok: false, why: `escalones propios de ${m.frontY} m` };
  return { ok: true, why: '' };
}

// Un umbral por lote elegible. `inner` es la cota del frente donde apoya (cara + zocalo), `outer` la de la calle.
export function doorStoops(lotList = allLots()) {
  const aprons = new Map(frontAprons(lotList).map(a => [a.id, a]));
  const out = [];
  for (const lot of lotList) {
    if (!stoopEligibility(lot).ok) continue;
    const m = frontMeasureFor(lot), apron = aprons.get(lot.id);
    // sobre el delantal, el umbral arranca donde termina el delantal (la cara del zocalo mas saliente del frente);
    // sin delantal, en la cara del zocalo de la puerta
    const inner = apron ? apronInner(lot, apron) : m.face + m.outward * m.plinth;
    const outer = inner + m.outward * STOOP.depth;
    const baseY = apron ? APRON_TOP : GRASS_TOP;
    let [l0, l1] = clampAlong(lot, m, STOOP.width / 2);
    // y sobre el delantal, dentro del delantal, que ya viene recortado 0,12 m de cada lado del lote (el motel
    // tiene la puerta a 60 cm de la esquina y el umbral asomaba 1,9 cm fuera del pavimento)
    if (apron) { const [p0, p1] = m.axis === 'x' ? [apron.minZ, apron.maxZ] : [apron.minX, apron.maxX]; l0 = Math.max(l0, p0); l1 = Math.min(l1, p1); }
    const box = m.axis === 'x'
      ? { minX: r4(Math.min(inner, outer)), maxX: r4(Math.max(inner, outer)), minZ: r4(l0), maxZ: r4(l1) }
      : { minX: r4(l0), maxX: r4(l1), minZ: r4(Math.min(inner, outer)), maxZ: r4(Math.max(inner, outer)) };
    out.push({
      id: lot.id, axis: m.axis, along: m.along, inner: r4(inner), outer: r4(outer), outward: m.outward,
      x: r4((box.minX + box.maxX) / 2), z: r4((box.minZ + box.maxZ) / 2),
      baseY, topY: r4(baseY + STOOP.height), onApron: Boolean(apron), rule: m.rule, ...box,
    });
  }
  return out;
}

// La misma forma que apronGeometrySpecs: cajas para mergedGround con el material del cordon (piedra), para que
// el escalon se lea distinto del pavimento.
export function stoopGeometrySpecs(stoops = doorStoops(), tile = 1.6) {
  return stoops.map(s => {
    const sx = s.maxX - s.minX, sz = s.maxZ - s.minZ;
    return { id: `stoop-${s.id}`, size: [sx, STOOP.height, sz], position: [s.x, s.baseY + STOOP.height / 2, s.z], uv: [sx / tile, sz / tile] };
  });
}

// Lo que se reserva delante de cada puerta medida (todas las 38, lleven umbral o no): el vestido no nace ahi.
export function doorKeepouts(lotList = allLots()) {
  const out = [];
  for (const lot of lotList) {
    const m = frontMeasureFor(lot);
    if (!m) continue;
    const inner = m.face + m.outward * m.plinth, outer = inner + m.outward * KEEPOUT.out;
    const [l0, l1] = clampAlong(lot, m, m.width / 2 + KEEPOUT.side);
    out.push(m.axis === 'x'
      ? { id: `puerta-${lot.id}`, minX: r4(Math.min(inner, outer)), maxX: r4(Math.max(inner, outer)), minZ: r4(l0), maxZ: r4(l1) }
      : { id: `puerta-${lot.id}`, minX: r4(l0), maxX: r4(l1), minZ: r4(Math.min(inner, outer)), maxZ: r4(Math.max(inner, outer)) });
  }
  return out;
}
