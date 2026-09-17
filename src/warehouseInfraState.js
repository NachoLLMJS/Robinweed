// La infraestructura del galpon: lo que hace que un cuarto se lea como un lugar donde se TRABAJA y
// no como una caja con plantas. Referencia 1 (Drug Grower Simulator): barriles de nutrientes, tanque
// IBC, controlador con pantalla, caneria de riego, bandejas de goteo, ductos desde los extractores.
//
// Todo lo que hay aca son DATOS y matematica pura: main.js los consume y construye. Las posiciones
// estan cotejadas contra los 12 colliders que el galpon ya tiene, contra la placa de muelle de la
// Tarea 76 y contra el volumen que I65 (rack de secado) y M (estanterias) van a ocupar.
import { WAREHOUSE_GROW_STATIONS, WAREHOUSE_DECOR, stationCollider } from './warehouseExpansionState.js';
import { DOCK_APRON, WAREHOUSE_FOOTPRINT } from './warehouseShellState.js';

const plateTop = DOCK_APRON.plate.position[1] + DOCK_APRON.plate.size[1] / 2;   // .135

// Copia LITERAL de las ocho cajas que main.js escribe a mano (el resto salen de funciones). El test
// las busca en el texto del fuente: si alguien mueve una alla y no aca, el test lo dice en vez de
// dejar que la infraestructura se plante encima de un obstaculo que ya no esta donde creiamos.
const LEGACY_LITERAL = Object.freeze([
  Object.freeze({ id: 'rear-bench-row', minX: -3.55, maxX: 3.55, minZ: -2.85, maxZ: -1.55 }),
  Object.freeze({ id: 'soil-pallet', minX: -6.45, maxX: -4.25, minZ: 1.75, maxZ: 4.75 }),
  Object.freeze({ id: 'recycling-bin', minX: 5.18, maxX: 6.15, minZ: 2.95, maxZ: 3.95 }),
  Object.freeze({ id: 'shelf', minX: -6.65, maxX: -3.15, minZ: -6.35, maxZ: -5.45 }),
  Object.freeze({ id: 'counter', minX: 3.4, maxX: 6, minZ: -6.1, maxZ: -5.25 }),
  Object.freeze({ id: 'vendor', minX: 4.1, maxX: 5.5, minZ: -7.35, maxZ: -6.15 }),
  Object.freeze({ id: 'column-west', minX: -5.58, maxX: -4.82, minZ: .87, maxZ: 1.63 }),
  Object.freeze({ id: 'column-east', minX: 4.82, maxX: 5.58, minZ: .87, maxZ: 1.63 }),
]);

export const WAREHOUSE_LEGACY_COLLIDERS = Object.freeze({
  literal: LEGACY_LITERAL,
  all: Object.freeze([
    ...LEGACY_LITERAL,
    ...WAREHOUSE_GROW_STATIONS.slice(4).map(stationCollider),
    WAREHOUSE_DECOR.hydroponicTower.collider,
  ]),
});

// --- Riego ---------------------------------------------------------------------------------------
// El colector va BAJO, sobre la tapa del banco y detras de las macetas, y de el sube un capilar al
// borde de cada una: asi son los sistemas de goteo reales. Colgarlo a 1,45-1,62 lo metia entre el
// follaje de las plantas maduras (1,30..2,38) o a la altura del ojo en el pasillo.
//
// El tramo de la fila de expansion va PARTIDO EN DOS: uno solo iria de x -5,4 a 5,4 y cruzaria el
// pasillo central (|x| < 1,33 = 1,05 del vano + 0,28 de radio del jugador) a 95 cm de altura.
const RAIL_Y = .95;
const RAILS = Object.freeze([
  Object.freeze({ id: 'rear', x0: -3.1, x1: 3.1, y: RAIL_Y, z: -2.6 }),
  Object.freeze({ id: 'expansion-west', x0: -5.4, x1: -2.45, y: RAIL_Y, z: -.25 }),
  Object.freeze({ id: 'expansion-east', x0: 2.45, x1: 5.4, y: RAIL_Y, z: -.25 }),
]);

export function irrigationRails() {
  return RAILS.map(rail => ({ ...rail, length: rail.x1 - rail.x0, centre: [(rail.x0 + rail.x1) / 2, rail.y, rail.z] }));
}

const railForStation = station => RAILS.find(rail => station.x >= rail.x0 && station.x <= rail.x1 && Math.abs(rail.z - station.z) < 2)
  ?? RAILS.find(rail => station.x >= rail.x0 && station.x <= rail.x1);

export function irrigationDrops(stations = WAREHOUSE_GROW_STATIONS) {
  return stations.map((station, index) => {
    const rail = railForStation(station);
    return {
      id: `drop-${index}`, railId: rail.id,
      start: [station.x, rail.y, rail.z],
      // borde de la maceta: la tierra esta en 1.302, el capilar termina justo encima
      end: [station.x, 1.32, station.z - .34],
    };
  });
}

export function dripTrayPlacements(stations = WAREHOUSE_GROW_STATIONS) {
  // la maceta apoya en .832 y la tapa del banco esta en .84: el plato le abraza la base
  return stations.map((station, index) => ({ id: `tray-${index}`, position: [station.x, .85, station.z] }));
}

// --- Ductos de los extractores -------------------------------------------------------------------
// El rotor que anima E35 vive del lado del CUARTO (fanRotorX = +-6,255). El ducto arranca del lado de
// la PARED (+-6,72), sube pegado a ella y dobla hacia el conducto de su lado. Conecta tambien el aire
// acondicionado que ya existe, para que no quede como el unico aparato huerfano de la pared oeste.
const DUCT_WALL_X = 6.72;

export function fanDuctSegments(fan, run) {
  const [fx, fy, fz] = fan.position;
  const wallX = Math.sign(fx) * DUCT_WALL_X;
  const mid = (wallX + run.x) / 2;
  const rise = [fy, fy + (run.y - fy) / 3, fy + 2 * (run.y - fy) / 3, run.y];
  const segments = [];
  for (let i = 1; i < rise.length; i++) segments.push({ from: [wallX, rise[i - 1], fz], to: [wallX, rise[i], fz] });
  segments.push({ from: [wallX, run.y, fz], to: [mid, run.y, fz] });
  segments.push({ from: [mid, run.y, fz], to: [run.x, run.y, fz] });
  return segments;
}

export const DUCT_RADIUS = .17;

// --- Pantalla del controlador ---------------------------------------------------------------------
// No lee nada del contexto (ni measureText ni getImageData) y no usa azar: la misma textura en cada
// carga, y funciona igual con el canvas real que con el doble de prueba del test.
export const CONTROLLER_SCREEN = Object.freeze({
  size: Object.freeze([256, 192]), background: '#0a140c', frame: '#1c2a1e', ink: '#38ff7a',
  readouts: Object.freeze(['TEMP 24 C', 'RH 55 %', 'CO2 1100']),
});

export function paintControllerScreen(ctx, spec = CONTROLLER_SCREEN) {
  const [width, height] = spec.size;
  ctx.fillStyle = spec.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = spec.frame;
  ctx.fillRect(0, 0, width, 26);
  ctx.fillStyle = spec.ink;
  ctx.font = `700 20px monospace`;
  ctx.fillText('GROW CTRL', 12, 19);
  spec.readouts.forEach((line, index) => {
    ctx.fillStyle = spec.frame;
    ctx.fillRect(10, 44 + index * 46, width - 20, 34);
    ctx.fillStyle = spec.ink;
    ctx.font = `700 26px monospace`;
    ctx.fillText(line, 20, 70 + index * 46);
  });
  return ctx;
}

// --- La tabla ------------------------------------------------------------------------------------
// `colors` va a la ley de materiales; `emissives` no (la ley es para material.color, nunca para un
// emisivo ni una superficie autoiluminada). `castShadow` solo en los dos volumenes que lo justifican:
// box() y mesh() proyectan sombra POR DEFECTO y el 4o argumento de legacyWarehouseBox es letra muerta,
// asi que las ~70 mallas restantes se apagan a mano despues de construirlas.
const barrelRadius = .3;
const barrelSpots = [[-5.55, 6.35], [-4.9, 6.35], [-5.55, 7.05], [-4.9, 7.05]];
const rails = irrigationRails();
const drops = irrigationDrops();
const trays = dripTrayPlacements();
const ducts = [...WAREHOUSE_DECOR.fans, WAREHOUSE_DECOR.airConditioner];

const segmentPlacement = (seg, radius, segments = 8) => {
  const dx = seg.to[0] - seg.from[0], dy = seg.to[1] - seg.from[1], dz = seg.to[2] - seg.from[2];
  const length = Math.hypot(dx, dy, dz);
  // CylinderGeometry nace a lo largo de +Y: para tumbarlo sobre X se gira -PI/2 en Z, sobre Z se gira PI/2 en X.
  const vertical = Math.abs(dy) >= Math.max(Math.abs(dx), Math.abs(dz));
  const rotation = vertical ? [0, 0, 0] : Math.abs(dx) >= Math.abs(dz) ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  return {
    position: [(seg.from[0] + seg.to[0]) / 2, (seg.from[1] + seg.to[1]) / 2, (seg.from[2] + seg.to[2]) / 2],
    rotation,
    // `height` es cuanto sube la pieza DESDE su posicion, no el largo del cilindro: un tramo
    // horizontal de 1,12 m no llega 1,12 m mas arriba, llega el radio. El largo va en la geometria.
    height: vertical ? length / 2 : radius,
    geometry: { shape: 'cylinder', radius, height: length, segments },
  };
};

export const INFRA_PROPS = Object.freeze([
  Object.freeze({
    id: 'barrels', colors: Object.freeze(['#2f5fa3']), emissives: Object.freeze([]),
    roughness: .6, metalness: .18, castShadow: true,
    geometry: Object.freeze({ shape: 'cylinder', radius: barrelRadius, height: .88, segments: 14, anchor: 'base' }),
    placements: Object.freeze(barrelSpots.map(([x, z]) => Object.freeze({ position: Object.freeze([x, plateTop, z]), height: .88 }))),
  }),
  Object.freeze({
    id: 'tote', colors: Object.freeze(['#b9bbb5']), emissives: Object.freeze([]),
    roughness: .62, metalness: .16, castShadow: true,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([1, 1.15, 1]) }),
    placements: Object.freeze([Object.freeze({ position: Object.freeze([6.05, .695, -2.0]), height: .575 })]),
  }),
  Object.freeze({
    id: 'toteCage', colors: Object.freeze(['#6f736c']), emissives: Object.freeze([]),
    roughness: .68, metalness: .22, castShadow: false,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([.03, 1.15, .03]) }),
    placements: Object.freeze([-.5, -.17, .17, .5].flatMap(dx => [-.5, .5].map(dz =>
      Object.freeze({ position: Object.freeze([6.05 + dx, .695, -2.0 + dz]), height: .575 }))).concat(
      [-.5, .5].flatMap(dx => [-.17, .17].map(dz =>
        Object.freeze({ position: Object.freeze([6.05 + dx, .695, -2.0 + dz]), height: .575 })))),
    ),
  }),
  Object.freeze({
    id: 'totePallet', colors: Object.freeze(['#5a5148']), emissives: Object.freeze([]),
    roughness: .88, metalness: .04, castShadow: false,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([1.1, .12, 1.1]) }),
    placements: Object.freeze([Object.freeze({ position: Object.freeze([6.05, .06, -2.0]), height: .06 })]),
  }),
  Object.freeze({
    // pared trasera, en la franja libre entre el cartel STOCKDEALER (x -5,9..-1,3) y el marco de la
    // pizarra de B13 (x 1,5..5,7): 5 cm a la derecha del borde del cartel.
    id: 'controller', colors: Object.freeze(['#2b302c']), emissives: Object.freeze([]),
    roughness: .7, metalness: .2, castShadow: false,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([.5, .72, .12]) }),
    placements: Object.freeze([Object.freeze({ position: Object.freeze([-1.0, 1.5, -7.79]), height: .36 })]),
  }),
  Object.freeze({
    id: 'rails', colors: Object.freeze(['#b4b2ab']), emissives: Object.freeze([]),
    roughness: .74, metalness: .12, castShadow: false,
    geometry: Object.freeze({ shape: 'cylinder', radius: .02, height: 1, segments: 8 }),
    placements: Object.freeze(rails.map(rail => Object.freeze({
      position: Object.freeze([...rail.centre]), rotation: Object.freeze([0, 0, Math.PI / 2]), height: .02,
      geometry: Object.freeze({ shape: 'cylinder', radius: .02, height: rail.length, segments: 8 }),
    }))),
  }),
  Object.freeze({
    id: 'drops', colors: Object.freeze(['#b4b2ab']), emissives: Object.freeze([]),
    roughness: .74, metalness: .12, castShadow: false,
    geometry: Object.freeze({ shape: 'cylinder', radius: .012, height: .42, segments: 6 }),
    placements: Object.freeze(drops.flatMap(drop => [
      // el capilar sube del colector al borde de la maceta y dobla hacia ella: dos tramos y un codo
      Object.freeze(segmentPlacement({ from: drop.start, to: [drop.end[0], drop.end[1], drop.start[2]] }, .012, 6)),
      Object.freeze(segmentPlacement({ from: [drop.end[0], drop.end[1], drop.start[2]], to: drop.end }, .012, 6)),
    ])),
  }),
  Object.freeze({
    id: 'risers', colors: Object.freeze(['#b4b2ab']), emissives: Object.freeze([]),
    roughness: .74, metalness: .12, castShadow: false,
    geometry: Object.freeze({ shape: 'cylinder', radius: .03, height: 1, segments: 8 }),
    placements: Object.freeze([
      // este: baja del riel al zocalo y corre por el hasta el tanque
      { from: [5.4, RAIL_Y, -.25], to: [5.4, .25, -.25] },
      { from: [5.4, .25, -.25], to: [6.0, .25, -.25] },
      { from: [6.0, .25, -.25], to: [6.0, .25, -1.4] },
      // oeste: baja del riel al zocalo y corre a la valvula de pared
      { from: [-5.4, RAIL_Y, -.25], to: [-5.4, .25, -.25] },
      { from: [-5.4, .25, -.25], to: [-6.6, .25, -.25] },
      // trasero: del colector de la fila trasera al riser oeste
      { from: [-3.1, RAIL_Y, -2.6], to: [-3.1, .25, -2.6] },
      { from: [-3.1, .25, -2.6], to: [-3.1, .25, -.25] },
      { from: [-3.1, .25, -.25], to: [-5.4, .25, -.25] },
    ].map(seg => Object.freeze(segmentPlacement(seg, .03, 8)))),
  }),
  Object.freeze({
    id: 'valve', colors: Object.freeze(['#5f6b63']), emissives: Object.freeze([]),
    roughness: .66, metalness: .24, castShadow: false,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([.14, .14, .1]) }),
    placements: Object.freeze([Object.freeze({ position: Object.freeze([-6.72, .6, -.25]), height: .07 })]),
  }),
  Object.freeze({
    id: 'valveWheel', colors: Object.freeze(['#7a4a3c']), emissives: Object.freeze([]),
    roughness: .72, metalness: .14, castShadow: false,
    geometry: Object.freeze({ shape: 'torus', radius: .09, tube: .02 }),
    placements: Object.freeze([Object.freeze({ position: Object.freeze([-6.62, .6, -.25]), rotation: Object.freeze([0, Math.PI / 2, 0]), height: .11 })]),
  }),
  Object.freeze({
    id: 'dripTrays', colors: Object.freeze(['#1d1f1c']), emissives: Object.freeze([]),
    roughness: .84, metalness: .06, castShadow: false,
    geometry: Object.freeze({ shape: 'cylinder', radius: .4, height: .02, segments: 18 }),
    placements: Object.freeze(trays.map(tray => Object.freeze({ position: Object.freeze([...tray.position]), height: .01 }))),
  }),
  Object.freeze({
    id: 'fanDucts', colors: Object.freeze(['#8d938c']), emissives: Object.freeze([]),
    roughness: .66, metalness: .24, castShadow: false,
    geometry: Object.freeze({ shape: 'cylinder', radius: DUCT_RADIUS, height: 1, segments: 10 }),
    placements: Object.freeze(ducts.flatMap(fan => {
      const run = { x: Math.sign(fan.position[0]) * 5.6, y: 3.48, radius: .22 };
      return fanDuctSegments(fan, run).map(seg => Object.freeze(segmentPlacement(seg, DUCT_RADIUS, 10)));
    })),
  }),
  Object.freeze({
    id: 'hoseReel', colors: Object.freeze(['#3e6b4a']), emissives: Object.freeze([]),
    roughness: .78, metalness: .08, castShadow: false,
    geometry: Object.freeze({ shape: 'torus', radius: .28, tube: .06 }),
    // girado para que el plano del rollo sea paralelo a la pared este: si no, sobresale 34 cm dentro del muro
    placements: Object.freeze([Object.freeze({ position: Object.freeze([6.79, 1.0, 1.9]), rotation: Object.freeze([0, Math.PI / 2, 0]), height: .34 })]),
  }),
  Object.freeze({
    // senializacion: emisivo tenue para que se lea en una pared que no recibe casi luz. Los emisivos
    // quedan fuera de la ley de materiales a proposito, igual que el LED del controlador.
    id: 'signage', colors: Object.freeze(['#2f3a33']), emissives: Object.freeze(['#8f8a6e']), emissiveIntensity: .9,
    roughness: .8, metalness: .1, castShadow: false,
    geometry: Object.freeze({ shape: 'box', size: Object.freeze([2.4, .32, .03]) }),
    // NO va centrado sobre el porton: la hoja del GLB barre x -1.088..0.999 / z 7.584..8.064 y sube 2.7 m
    // al abrirse (medido en el runtime), asi que un cartel ahi se lo traga la puerta justo cuando el
    // jugador esta lo bastante cerca para leerlo. Va sobre el panel de pared a la derecha del vano.
    placements: Object.freeze([Object.freeze({ position: Object.freeze([2.6, 3.45, 7.855]), height: .16 })]),
  }),
]);

export const SIGNAGE_TEXT = 'KEEP DOOR CLOSED  ·  GROW ROOM 01';

export function paintSignage(ctx, text = SIGNAGE_TEXT) {
  ctx.fillStyle = '#2f3a33';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#c9c2a6';
  ctx.fillRect(0, 0, 1024, 6);
  ctx.fillRect(0, 122, 1024, 6);
  ctx.font = '700 48px Arial';
  ctx.fillText(text, 40, 84);
  return ctx;
}

export const INFRA_COLLIDERS = Object.freeze([
  Object.freeze({ id: 'barrels', minX: -5.9, maxX: -4.55, minZ: 6.0, maxZ: 7.35 }),
  Object.freeze({ id: 'tote', minX: 5.45, maxX: 6.65, minZ: -2.6, maxZ: -1.4 }),
]);

export const INFRA_FOOTPRINT = WAREHOUSE_FOOTPRINT;

// --- Que la perilla no deje al jugador encerrado ---------------------------------------------------
// `setGalpon` enciende y apaga colliders EN CALIENTE. Si el jugador esta parado donde aparece una caja
// nueva, `moveCircle` rechaza todos los candidatos -- sigue dentro de la caja expandida por el radio --
// y el paso maximo de un frame (5,1 m/s a 60 fps = 8,5 cm) no alcanza a sacarlo: queda atrapado para
// siempre. Empujarlo "al borde mas cercano" tampoco basta: un borde puede SER la pared del cuarto
// (los barriles llegan a maxZ 7.35, que es el limite caminable). Hay que buscar entre candidatos y
// verificar cada uno contra TODAS las cajas y contra los limites, con la reaparicion como ultimo recurso.
const R_PLAYER = .28;
const within = (x, z, box, r) => x > box.minX - r && x < box.maxX + r && z > box.minZ - r && z < box.maxZ + r;

export function isTrapped(point, obstacles, radius = R_PLAYER) {
  return obstacles.some(box => within(point.x, point.z, box, radius));
}

export function nearestFreeSpot(point, obstacles, bounds, fallback, radius = R_PLAYER) {
  if (!isTrapped(point, obstacles, radius)) return { x: point.x, z: point.z, moved: false };
  const eps = 1e-3;
  const candidates = [];
  for (const box of obstacles) {
    if (!within(point.x, point.z, box, radius)) continue;
    candidates.push(
      { x: box.minX - radius - eps, z: point.z },
      { x: box.maxX + radius + eps, z: point.z },
      { x: point.x, z: box.minZ - radius - eps },
      { x: point.x, z: box.maxZ + radius + eps },
    );
  }
  const legal = candidates.filter(c =>
    c.x >= bounds.minX && c.x <= bounds.maxX && c.z >= bounds.minZ && c.z <= bounds.maxZ &&
    !isTrapped(c, obstacles, radius));
  if (!legal.length) return { x: fallback.x, z: fallback.z, moved: true };
  legal.sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z));
  return { x: legal[0].x, z: legal[0].z, moved: true };
}

// Volumen que BARRE la hoja del porton al abrirse (GLB medido en el runtime, no en la tabla):
// cerrada ocupa y 0..2.894 y sube 2.7 m. Nada de K puede vivir dentro de esta caja.
export const LOADING_DOOR_SWEEP = Object.freeze({ minX: -1.088, maxX: .999, minY: 0, maxY: 5.594, minZ: 7.584, maxZ: 8.064 });
