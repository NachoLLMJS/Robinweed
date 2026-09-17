// El cruce y los fondos: cebras, rebajes y remates de vereda (?suelo=4).
//
// EL DEFECTO, medido el 2026-09-12 con 35 poses en Chrome real + GPU (evidencia/ciudad/poses-fase1.json):
//   1. La bocacalle -- el unico cruce del mapa y el lugar por el que el jugador pasa mas veces -- no tiene
//      paso de cebra ni rebaje: cuatro esquinas de cordon a 90 grados y dos rayas de carril que atraviesan el
//      cruce. El galpon SI tiene una cebra (z 12,2), asi que el juego ya sabe como se ve una.
//   2. Los tres fondos de calle (los remates de la transversal, x +-52,4, y el hoarding del norte, z 107,6) son
//      los unicos puntos donde el jugador llega al muro, y en los tres la calzada corre hasta debajo del muro
//      con la raya de carril apuntandole (capturas muro-oeste-pie, muro-este-pie, muro-norte-pie). El pie del
//      muro esta sobre ASFALTO, no sobre pasto: una cinta de tierra ahi seria un error nuevo. Lo que le da un
//      final a la calle es la vereda volviendo por el pie del muro, del ancho de la de la avenida, uniendo las
//      dos veredas -- en los DOS remates de ladrillo; el hoarding del norte no lleva (ver RETURN_RUNS).
//
// LOS NUMEROS SALEN DE LOS LITERALES DE main.js: la cebra copia la del galpon (raya 0,56 x 2,1, paso 1,1,
// y = 0,035), las rayas de carril son las dos listas de main.js, la calzada es la caja de la avenida
// (8,4 x 104 en z 6..110, tope 0,02) y STREET_LAYOUT.crossStreet (tope 0,025). tests/crossing.test.js los ancla.
//
// EL REBAJE VIVE EN LA CALZADA, no en la vereda: la vereda son literales de main.js que no se pueden inclinar,
// asi que donde la cebra toca el cordon el cordon de piedra desaparece (kerbRunsNotched) y una rampa de
// pavimento baja del nivel de la vereda (0,12) al del asfalto en 0,8 m, contra la linea del cordon, como una
// rampa de bordillo. Es una caja rotada: mergedGround aplica `rotation` antes de trasladar.
//
// Nada de esto agrega colliders: son losas y pintura, y el jugador ya camina sobre la vereda a altura fija.
import { STREET_LAYOUT } from './streetLifeState.js';
import { kerbRuns, KERB_TOP, KERB_WIDTH, KERB_THICKNESS, AVENUE_KERB } from './kerbEdgeState.js';
import { APRON_TOP, APRON_THICKNESS, APRON_TILE_METRES } from './frontApronState.js';
import { WALL_RUNS, WALL_STYLE } from './cityWallState.js';

const r4 = n => +n.toFixed(4);
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// Las dos calzadas, de los literales: box([8.4,.08,104],roadMaterial,[0,-.02,58]) y crossStreet (108 x 7,2 en z 34,
// centro -0,015). `top` es la cara de arriba del asfalto, donde termina la rampa.
const cs = STREET_LAYOUT.crossStreet;
export const ROADWAY = Object.freeze({
  main: Object.freeze({ minX: -4.2, maxX: 4.2, minZ: 6, maxZ: 110, top: 0.02 }),
  cross: Object.freeze({ minX: r4(cs.x - cs.width / 2), maxX: r4(cs.x + cs.width / 2), minZ: r4(cs.z - cs.depth / 2), maxZ: r4(cs.z + cs.depth / 2), top: 0.025 }),
});
export const ROAD_TOP = Object.freeze({ main: ROADWAY.main.top, cross: ROADWAY.cross.top });

// La rampa: 0,8 m dentro de la calzada, de la cota de la vereda a la del asfalto.
export const RAMP = Object.freeze({ run: 0.8, drop: r4(APRON_TOP - ROAD_TOP.main) });
// La cebra del galpon: for(const x of [-3.3,...,3.3])box([.56,.016,2.1],crossingMaterial,[x,.035,crossingZ]).
// `count` y `pitch` son TOPES: las rayas viven entre las dos rampas, no entre los dos cordones. La primera version
// las repartia de cordon a cordon y un refutador midio que la raya exterior de cada cebra quedaba ENTERRADA bajo la
// rampa (en la transversal, 0,50 de sus 0,56 m con la rampa por encima). Asi que el tramo util es el ancho de la
// calzada menos, de cada lado, la rampa (0,8) y un margen (0,15); entran las rayas que entren a >= `minPitch`:
// 7 a 0,99 en la avenida (8,4 m), 6 a 0,948 en la transversal (7,2 m). `setback` es cuanto se retira la cebra del
// cuadro del cruce.
export const ZEBRA = Object.freeze({ stripe: 0.56, depth: 2.1, y: 0.035, thickness: 0.016, count: 7, pitch: 1.1, minPitch: 0.9, margin: 0.15, setback: 0.6, keep: r4(RAMP.run + 0.15) });
export const RETURN_WIDTH = AVENUE_KERB.width;

// Las rayas de carril, copiadas de main.js (23 en la avenida sobre x = 0, 24 en la transversal sobre z = 34).
export const LANE_DASHES = Object.freeze({
  z: Object.freeze([9, 17, 21, 25, 29, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107]),
  x: Object.freeze([-49, -45, -41, -37, -33, -29, -25, -21, -17, -13, -9, -5, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49]),
  size: Object.freeze([2.1, 0.1]),   // largo, ancho
});

export function zebraCrossings() {
  const half = ZEBRA.depth / 2;
  const arms = [
    { id: 'south', axis: 'x', at: r4(ROADWAY.cross.minZ - ZEBRA.setback - half), road: ROADWAY.main, centre: 0 },
    { id: 'north', axis: 'x', at: r4(ROADWAY.cross.maxZ + ZEBRA.setback + half), road: ROADWAY.main, centre: 0 },
    { id: 'west', axis: 'z', at: r4(ROADWAY.main.minX - ZEBRA.setback - half), road: ROADWAY.cross, centre: STREET_LAYOUT.intersectionZ },
    { id: 'east', axis: 'z', at: r4(ROADWAY.main.maxX + ZEBRA.setback + half), road: ROADWAY.cross, centre: STREET_LAYOUT.intersectionZ },
  ];
  return arms.map(arm => {
    const width = arm.axis === 'x' ? arm.road.maxX - arm.road.minX : arm.road.maxZ - arm.road.minZ;
    // el tramo util: sin las dos rampas ni sus margenes
    const usable = width - 2 * ZEBRA.keep;
    const count = Math.max(1, Math.min(ZEBRA.count, Math.floor((usable - ZEBRA.stripe) / ZEBRA.minPitch) + 1));
    const pitch = count > 1 ? Math.min(ZEBRA.pitch, (usable - ZEBRA.stripe) / (count - 1)) : 0;
    const stripes = [];
    for (let i = 0; i < count; i++) {
      const c = arm.centre + (i - (count - 1) / 2) * pitch;
      const box = arm.axis === 'x'
        ? { minX: r4(c - ZEBRA.stripe / 2), maxX: r4(c + ZEBRA.stripe / 2), minZ: r4(arm.at - half), maxZ: r4(arm.at + half) }
        : { minX: r4(arm.at - half), maxX: r4(arm.at + half), minZ: r4(c - ZEBRA.stripe / 2), maxZ: r4(c + ZEBRA.stripe / 2) };
      stripes.push({ id: `${arm.id}#${i}`, y: ZEBRA.y, ...box });
    }
    const box = arm.axis === 'x'
      ? { minX: arm.road.minX, maxX: arm.road.maxX, minZ: r4(arm.at - half), maxZ: r4(arm.at + half) }
      : { minX: r4(arm.at - half), maxX: r4(arm.at + half), minZ: arm.road.minZ, maxZ: arm.road.maxZ };
    return { id: arm.id, axis: arm.axis, at: arm.at, count, pitch: r4(pitch), ...box, stripes };
  });
}

// La cara del cordon de la transversal que mira a la calzada: crossCurbs z +- depth/2 (30,405 y 37,595). El de
// la avenida es el borde de la calzada (|x| = 4,2), donde termina la vereda de main.js.
function crossKerbFaces() {
  const curbs = STREET_LAYOUT.crossCurbs;
  const south = Math.max(...curbs.filter(c => c.z < STREET_LAYOUT.intersectionZ).map(c => c.z + c.depth / 2));
  const north = Math.min(...curbs.filter(c => c.z > STREET_LAYOUT.intersectionZ).map(c => c.z - c.depth / 2));
  return { south: r4(south), north: r4(north) };
}

// El tramo de cordon (kerbRuns) que pasa por `high` a lo largo del tramo [a0, a1] de la cebra.
function kerbAt(axis, high, a0, a1) {
  const mid = (a0 + a1) / 2;
  // el cordon esta del lado de AFUERA de la linea (|x| mayor en la avenida; z menor al sur y mayor al norte)
  const probe = axis === 'x'
    ? { x: high + Math.sign(high) * KERB_WIDTH / 2, z: mid }
    : { x: mid, z: high + (high < STREET_LAYOUT.intersectionZ ? -1 : 1) * KERB_WIDTH / 2 };
  return kerbRuns().find(run => probe.x >= run.minX && probe.x <= run.maxX && probe.z >= run.minZ && probe.z <= run.maxZ);
}

// Ocho rampas: dos por cebra, una en cada cordon que la cebra toca. `high` es la linea del cordon (donde la rampa
// esta al ras de la vereda), `dir` hacia donde baja (hacia la calzada), `axis` el eje a lo largo del cual baja.
export function kerbRamps() {
  const faces = crossKerbFaces();
  const ramps = [];
  for (const zebra of zebraCrossings()) {
    if (zebra.axis === 'x') {
      for (const [side, high, dir] of [['west', ROADWAY.main.minX, 1], ['east', ROADWAY.main.maxX, -1]]) {
        const kerb = kerbAt('x', high, zebra.minZ, zebra.maxZ);
        const low = r4(high + dir * RAMP.run);
        ramps.push({
          id: `${zebra.id}-${side}`, crossing: zebra.id, kerb: kerb?.id ?? null, axis: 'x', dir, high, low,
          topHigh: APRON_TOP, topLow: ROAD_TOP.main,
          minX: Math.min(high, low), maxX: Math.max(high, low), minZ: zebra.minZ, maxZ: zebra.maxZ,
        });
      }
    } else {
      for (const [side, high, dir] of [['south', faces.south, 1], ['north', faces.north, -1]]) {
        const kerb = kerbAt('z', high, zebra.minX, zebra.maxX);
        const low = r4(high + dir * RAMP.run);
        ramps.push({
          id: `${zebra.id}-${side}`, crossing: zebra.id, kerb: kerb?.id ?? null, axis: 'z', dir, high, low,
          topHigh: APRON_TOP, topLow: ROAD_TOP.cross,
          minX: zebra.minX, maxX: zebra.maxX, minZ: Math.min(high, low), maxZ: Math.max(high, low),
        });
      }
    }
  }
  return ramps;
}

// EL DESEMBARCO de cada rampa: la franja de vereda donde la cebra deja al peaton, del ancho de la cebra y LANDING
// metros hacia adentro desde la linea del cordon. Se reserva en occupiedBoxes (streetDressingState) como la boca del
// nicho y los umbrales: un refutador midio que, con la vereda re-repartida, un hidrante y un cantero solidos dejaban
// 0,585 m de luz al pie de la rampa oeste-norte (el jugador mide 0,56) y un cartel de 1,63 m tapaba el desembarco de
// la cebra este (blando: se atravesaba).
export const LANDING = 1.2;
export function crossingLandings() {
  return kerbRamps().map(r => (r.axis === 'x'
    ? { id: `desembarco-${r.id}`, ramp: r.id, minX: r4(Math.min(r.high, r.high - r.dir * LANDING)), maxX: r4(Math.max(r.high, r.high - r.dir * LANDING)), minZ: r.minZ, maxZ: r.maxZ }
    : { id: `desembarco-${r.id}`, ramp: r.id, minX: r.minX, maxX: r.maxX, minZ: r4(Math.min(r.high, r.high - r.dir * LANDING)), maxZ: r4(Math.max(r.high, r.high - r.dir * LANDING)) }));
}

// Donde hay rampa, el cordon de piedra se corta: la muesca es el tramo de la rampa a lo largo de SU cordon. Y donde
// hay remate, tambien: los cordones de la transversal siguen hasta x +-54, por dentro del muro, y sin muesca corrian
// ENTRE la losa del remate (0,12) y cada vereda (0,12) como una cresta de piedra de 4 cm -- medido por un refutador
// (1,95 m por lado). Con la muesca, losa y vereda se tocan al ras y el cordon del remate cierra el lado de la calzada.
export function kerbNotches() {
  const ramps = kerbRamps().map(r => (r.axis === 'x'
    ? { kerb: r.kerb, ramp: r.id, along: 'z', from: r.minZ, to: r.maxZ }
    : { kerb: r.kerb, ramp: r.id, along: 'x', from: r.minX, to: r.maxX }));
  const faces = crossKerbFaces();
  const returns = deadEndReturns().flatMap(r => [faces.south, faces.north].map(face => {
    const kerb = kerbAt('z', face, r.slab.minX, r.slab.maxX);
    return { kerb: kerb?.id ?? null, ramp: null, ret: r.id, along: 'x', from: r.slab.minX, to: r.slab.maxX };
  }));
  return [...ramps, ...returns];
}

// El cordon entero (kerbEdgeState) partido en las muescas: 8 tramos -> 20 (8 muescas de rampa, 4 de remate). Mismo
// contrato que kerbRuns(), asi que kerbGeometrySpecs() lo fusiona igual. Los presets 1..3 siguen usando el entero.
export function kerbRunsNotched() {
  const notches = kerbNotches();
  const out = [];
  for (const run of kerbRuns()) {
    const along = run.street === 'main' ? 'z' : 'x';
    const lo = along === 'z' ? run.minZ : run.minX, hi = along === 'z' ? run.maxZ : run.maxX;
    const cuts = notches.filter(n => n.kerb === run.id).map(n => [Math.max(lo, n.from), Math.min(hi, n.to)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    let cursor = lo, index = 0;
    const piece = (a, b) => {
      if (b - a < 1e-6) return;
      const box = along === 'z' ? { minX: run.minX, maxX: run.maxX, minZ: r4(a), maxZ: r4(b) } : { minX: r4(a), maxX: r4(b), minZ: run.minZ, maxZ: run.maxZ };
      out.push({ ...run, id: `${run.id}[${index++}]`, ...box, length: r4(b - a) });
    };
    for (const [a, b] of cuts) { piece(cursor, a); cursor = Math.max(cursor, b); }
    piece(cursor, hi);
  }
  return out;
}

// Los dos remates de la transversal. La losa arranca en el EJE del muro (los paneles vaivenean +-0,035 rad y desde
// la cara quedaria una rendija) y llega RETURN_WIDTH mas alla de la cara interior; el cordon de piedra va en el
// borde que mira a la calzada, como en la avenida.
// EL FONDO NORTE NO LLEVA REMATE, a proposito: la camioneta recorre la avenida hasta z 107 (STREET_LAYOUT.vehicleRoute)
// y da la vuelta a 0,55 m del hoarding, asi que una vereda ahi la tendria pasando por encima del cordon cuatro veces
// por minuto. Y un hoarding es una valla de obra: que la calzada muera contra ella, con el galibo a rayas al pie, es
// justo lo que se ve en una calle cortada por una obra. Los remates van donde la calle termina contra un muro de
// verdad: los dos de ladrillo de la transversal.
export const RETURN_RUNS = Object.freeze(['cap-west', 'cap-east']);
export function deadEndReturns() {
  const faces = crossKerbFaces();
  const out = [];
  for (const id of RETURN_RUNS) {
    const spec = WALL_RUNS.find(w => w.id === id);
    if (!spec) continue;
    const t = WALL_STYLE[spec.style].thickness;
    if (spec.axis === 'z') {
      const sign = Math.sign(spec.at);
      const face = r4(spec.at - sign * t / 2), inner = r4(face - sign * RETURN_WIDTH);
      const slab = { minX: Math.min(spec.at, inner), maxX: Math.max(spec.at, inner), minZ: faces.south, maxZ: faces.north, top: APRON_TOP };
      const kerb = { minX: sign < 0 ? inner - KERB_WIDTH : inner, maxX: sign < 0 ? inner : inner + KERB_WIDTH, minZ: faces.south, maxZ: faces.north, top: KERB_TOP };
      out.push({ id: `return-${id}`, run: id, face, inner, slab: r4Box(slab), kerb: r4Box(kerb) });
    } else {
      const face = r4(spec.at - t / 2), inner = r4(face - RETURN_WIDTH);
      const slab = { minX: ROADWAY.main.minX, maxX: ROADWAY.main.maxX, minZ: inner, maxZ: spec.at, top: APRON_TOP };
      const kerb = { minX: ROADWAY.main.minX, maxX: ROADWAY.main.maxX, minZ: inner, maxZ: inner + KERB_WIDTH, top: KERB_TOP };
      out.push({ id: `return-${id}`, run: id, face, inner, slab: r4Box(slab), kerb: r4Box(kerb) });
    }
  }
  return out;
}
const r4Box = b => ({ ...b, minX: r4(b.minX), maxX: r4(b.maxX), minZ: r4(b.minZ), maxZ: r4(b.maxZ) });

// Todo lo nuevo, como cajas en planta, para medir que raya queda debajo.
function newGround() {
  return [
    ...zebraCrossings().map(z => ({ id: `cebra ${z.id}`, minX: z.minX, maxX: z.maxX, minZ: z.minZ, maxZ: z.maxZ })),
    ...kerbRamps().map(r => ({ id: `rampa ${r.id}`, minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ })),
    ...deadEndReturns().flatMap(r => [{ id: `remate ${r.run}`, ...r.slab }, { id: `cordon ${r.run}`, ...r.kerb }]),
  ];
}

// Las rayas de carril que quedan debajo de una cebra o de un remate se esconden en el preset 4: una raya
// atravesando una cebra, o asomando por debajo de la vereda del remate, es peor que ninguna.
export function hiddenDashes() {
  const [length, width] = LANE_DASHES.size;
  const pieces = newGround();
  const dashes = [
    ...LANE_DASHES.z.map(at => ({ axis: 'z', at, x: 0, z: at, minX: -width / 2, maxX: width / 2, minZ: at - length / 2, maxZ: at + length / 2 })),
    ...LANE_DASHES.x.map(at => ({ axis: 'x', at, x: at, z: STREET_LAYOUT.intersectionZ, minX: at - length / 2, maxX: at + length / 2, minZ: STREET_LAYOUT.intersectionZ - width / 2, maxZ: STREET_LAYOUT.intersectionZ + width / 2 })),
  ];
  return dashes.map(d => ({ ...d, under: pieces.filter(p => overlaps(d, p)).map(p => p.id) })).filter(d => d.under.length);
}
let hiddenKeys = null;
export function dashHidden(x, z) {
  if (!hiddenKeys) hiddenKeys = new Set(hiddenDashes().map(d => `${d.x}|${d.z}`));
  return hiddenKeys.has(`${x}|${z}`);
}

// --- Geometria para mergedGround ------------------------------------------------------------------
export function zebraGeometrySpecs(zebras = zebraCrossings()) {
  return zebras.flatMap(z => z.stripes.map(s => ({
    id: s.id,
    size: [r4(s.maxX - s.minX), ZEBRA.thickness, r4(s.maxZ - s.minZ)],
    position: [r4((s.minX + s.maxX) / 2), ZEBRA.y, r4((s.minZ + s.maxZ) / 2)],
    uv: [1, 1],
  })));
}

// La rampa es una caja de largo hypot(run, drop) rotada theta, corrida (T/2) sin(theta) hacia el cordon para que
// su arista de arriba caiga exactamente en la linea del cordon (sin el corrimiento queda 1 cm de rendija).
export function rampGeometrySpecs(ramps = kerbRamps()) {
  const T = APRON_THICKNESS;
  return ramps.map(r => {
    const drop = r.topHigh - r.topLow;
    const theta = Math.atan(drop / RAMP.run);
    const L = Math.hypot(RAMP.run, drop);
    const centreAlong = r.high + r.dir * (RAMP.run / 2 - (T / 2) * Math.sin(theta));
    const y = (r.topHigh + r.topLow) / 2 - (T / 2) * Math.cos(theta);
    const span = r.axis === 'x' ? r.maxZ - r.minZ : r.maxX - r.minX;
    return r.axis === 'x'
      ? { id: r.id, size: [L, T, r4(span)], rotation: [0, 0, -r.dir * theta], position: [r4(centreAlong), r4(y), r4((r.minZ + r.maxZ) / 2)], uv: [L / APRON_TILE_METRES, span / APRON_TILE_METRES] }
      : { id: r.id, size: [r4(span), T, L], rotation: [r.dir * theta, 0, 0], position: [r4((r.minX + r.maxX) / 2), r4(y), r4(centreAlong)], uv: [span / APRON_TILE_METRES, L / APRON_TILE_METRES] };
  });
}

const slabSpec = (id, b, top, thickness) => {
  const sx = r4(b.maxX - b.minX), sz = r4(b.maxZ - b.minZ);
  return { id, size: [sx, thickness, sz], position: [r4((b.minX + b.maxX) / 2), r4(top - thickness / 2), r4((b.minZ + b.maxZ) / 2)], uv: [sx / APRON_TILE_METRES, sz / APRON_TILE_METRES] };
};
export function returnGeometrySpecs(returns = deadEndReturns()) {
  return returns.map(r => slabSpec(r.id, r.slab, APRON_TOP, APRON_THICKNESS));
}
export function returnKerbGeometrySpecs(returns = deadEndReturns()) {
  return returns.map(r => slabSpec(`${r.id}-kerb`, r.kerb, KERB_TOP, KERB_THICKNESS));
}
