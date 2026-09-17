// La calle deja de estar barrida.
//
// EL DEFECTO, medido el 2026-09-11: 37 obstaculos en 10.773 m2, y de eso 18 son faroles. Cero
// basura, cero autos estacionados, cero bicicletas, cero canteros, cero buzones. Una cuadra real
// esta sucia y ocupada; esta esta barrida, y por eso se lee como maqueta.
//
// POR QUE ESTE MODULO NO REPITE EL ERROR DEL PAQUETE J. El `scatterProps` de J70 consultaba dos
// listas -- `STREET_LAYOUT.obstacles` (37) y `CITY_PERIMETER` (9) -- y no sabia de las 77 cajas de
// cerca, las 82 hojas, los 74 postes ni los 130 objetos de patio que el paquete L agrego DESPUES de
// que J se escribiera. La auditoria lo midio: 31 props atravesando las cercas recien arregladas y 11
// encerrados dentro de patios cerrados, con los tests en verde. Aca la ocupacion se arma en UN solo
// lugar, `occupiedBoxes()`, y el test cuenta que estan las ocho fuentes.
//
// DONDE HAY LUGAR, medido con el moveCircle del juego (paso 0,5 m, exigiendo ademas que el sitio se
// VEA desde el piso pisable): vereda de la avenida 443 sitios al oeste y 430 al este, vereda de la
// transversal 198 por lado, y 199 lugares de auto en cada carril de estacionamiento.
//
// LOS AUTOS VAN EN LA TRANSVERSAL Y NO EN LA AVENIDA. La camioneta recorre la avenida entera por
// x = +-2,72 (`STREET_LAYOUT.vehicleRoute`): un auto estacionado contra el cordon ocuparia
// x 2,35..4,25 y la camioneta lo atravesaria cuatro veces por minuto. La transversal no tiene ruta
// de vehiculo, mide 108 m y es justamente el tramo vacio por el que camino Jose.
import { STREET_LAYOUT, STREET_WALKERS } from './streetLifeState.js';
import { HOUSE_FOOTPRINTS, SIDEWALK_EDGE } from './lotState.js';
import { LOT_FENCE_COLLIDERS, fenceLeaves, fencePosts } from './lotFenceState.js';
import { yardBoxes } from './yardDressingState.js';
import { CITY_PERIMETER } from './cityBoundsState.js';
import { propColliders, solidosPresetById, spawnPoints, SPAWN_CLEARANCE } from './propColliderState.js';
import { KIT_RAW } from './kitRawSizes.js';
import { fitScaleForWorldBox } from './assetFit.js';
import { doorKeepouts } from './doorStoopState.js';
import { crossingLandings } from './crossingState.js';

// Margen alrededor de cada pieza. Menos que esto y dos piezas vecinas se tocan a la vista.
export const CLEARANCE = 0.18;

// El TOPE que la pieza no puede superar en el mundo, en metros [ancho, alto, fondo]. El GLB se ajusta
// a esta caja con `fitScaleForWorldBox` (escala UNIFORME: manda la cota mas restrictiva), igual que
// `loadStreetSet` hace con los faroles: lo que devuelva el generador no decide la escala de la ciudad.
// Y por eso `size` NO es el tamano: el tamano real es `bakedKitSize(id)`. Medido el 2026-09-12 antes de
// este ajuste, seis piezas no median lo que el kit creia (la tapia 0,05 x 0,11 m, el cartel 0,15 de alto,
// la bici 0,31, el hatchback de 1,72 x 1,06 y atravesado, el seto 1,94 y no 4, el cobertizo 1,43), porque
// Tripo entrega cada modelo con los ejes que se le ocurren y el tope apretaba el eje equivocado.
//
// `rawYaw` gira la geometria EN EL HORNEADO (antes de medir y ajustar) hasta la convencion del kit: el
// FRENTE de la pieza en +z y su LARGO en x. Con eso "mira a la calle" del colocador vale para todas:
// el banco tenia el respaldo en +z (PI), el cartel el panel de cara a x (-PI/2), la bici y el hatchback
// el largo en x cuando el colocador espera el largo de un auto en z (+-PI/2), la tapia el largo en z y
// la reja de cara a x, el cobertizo y la cochera la puerta en +x (-PI/2 los tres). Los topes se eligen
// para que mande el eje que importa (el largo de un auto, el alto de un hidrante, el ancho de un cartel).
// `rise` estira en alto al colocar (solo el seto: hornea a 1,12 m y como cierre tiene que tapar).
// `solid` dice si frena al jugador. Un auto atravesable seria el mismo defecto que se acaba de
// arreglar con los faroles; una bolsa de basura que te frena, en cambio, molesta.
export const DRESSING_KIT = Object.freeze({
  bin: Object.freeze({ url: '/models-v40/dressing/bin.glb', size: [0.75, 1.15, 0.85], banda: 'vereda', solid: true, peso: 3 }),
  bags: Object.freeze({ url: '/models-v40/dressing/bags.glb', size: [1.0, 0.7, 0.8], banda: 'vereda', solid: false, peso: 3 }),
  crates: Object.freeze({ url: '/models-v40/dressing/crates.glb', size: [0.6, 1.3, 0.45], banda: 'vereda', solid: true, peso: 2 }),
  // el hidrante crudo es rechoncho (0,58 de ancho por 1 de alto): manda el alto, 0,75 m como uno real
  hydrant: Object.freeze({ url: '/models-v40/dressing/hydrant.glb', size: [0.5, 0.75, 0.5], banda: 'vereda', solid: true, peso: 1 }),
  mailbox: Object.freeze({ url: '/models-v40/dressing/mailbox.glb', size: [0.6, 1.15, 0.5], banda: 'vereda', solid: true, peso: 1 }),
  // panel de cara a x en el crudo (ancho en z): rawYaw lo pone de cara a la calle; manda el alto, 2 m
  sign: Object.freeze({ url: '/models-v40/dressing/sign.glb', size: [1.7, 2.0, 0.4], banda: 'vereda', solid: false, peso: 1, rawYaw: -Math.PI / 2 }),
  // respaldo en +z en el crudo: media vuelta y el asiento mira a +z. Manda el alto (0,85): 1,19 m de largo
  bench: Object.freeze({ url: '/models-v40/dressing/bench.glb', size: [1.4, 0.85, 0.6], banda: 'vereda', solid: true, peso: 2, rawYaw: Math.PI }),
  // largo en z en el crudo; manda el largo, 1,7 m
  bike: Object.freeze({ url: '/models-v40/dressing/bike.glb', size: [1.7, 1.05, 0.8], banda: 'vereda', solid: false, peso: 2, rawYaw: -Math.PI / 2 }),
  planter: Object.freeze({ url: '/models-v40/dressing/planter.glb', size: [0.9, 0.9, 0.9], banda: 'vereda', solid: true, peso: 2 }),
  litterbin: Object.freeze({ url: '/models-v40/dressing/litterbin.glb', size: [0.4, 1.0, 0.4], banda: 'vereda', solid: true, peso: 2 }),
  sedan: Object.freeze({ url: '/models-v40/dressing/sedan.glb', size: [1.8, 1.45, 4.4], banda: 'estacionamiento', solid: true, peso: 3 }),
  // largo en x y frente en +x en el crudo; es un microauto alto (0,79 de alto por 1 de largo): manda el alto
  hatchback: Object.freeze({ url: '/models-v40/dressing/hatchback.glb', size: [1.8, 1.9, 3.4], banda: 'estacionamiento', solid: true, peso: 3, rawYaw: -Math.PI / 2 }),
  pickup: Object.freeze({ url: '/models-v40/dressing/pickup.glb', size: [1.9, 1.75, 5.1], banda: 'estacionamiento', solid: true, peso: 2 }),
  // EL FONDO. Cierran los huecos de 2,5 a 5,5 m que quedan entre los edificios sueltos de las filas
  // de la transversal. Por ahi es por donde el jugador se cuela a los bolsones ciegos contra el muro,
  // donde la pantalla entera es una losa a un metro de la cara -- la peor imagen del juego, y se
  // llega caminando. Se estiran en X hasta el ancho del hueco, asi que su largo horneado es el NOMINAL.
  // tapia baja de revoque, sin reja (Tripo, 2026-09-13, 62 KB): largo en z en el crudo; manda el largo (4 m -> 1,19 de
  // alto y 0,35 de grosor). La anterior traia una reja encima.
  wall: Object.freeze({ url: '/models-v40/dressing/wall.glb', size: [4.0, 2.2, 0.6], banda: 'fondo', solid: true, peso: 3, rawYaw: -Math.PI / 2 }),
  // seto largo (Tripo, 2026-09-13, 54 KB): largo en z en el crudo, 3,8:1,3:1; manda el largo (4 m -> 1,38 de alto y
  // 1,06 de fondo) y `rise` 1,3 lo lleva a 1,8 m. El anterior horneaba 1,94 x 1,12 y se estiraba x1,4 en alto.
  hedge: Object.freeze({ url: '/models-v40/dressing/hedge.glb', size: [4.0, 1.9, 1.1], banda: 'fondo', solid: true, peso: 3, rise: 1.3, rawYaw: -Math.PI / 2 }),
  // el seto ANTERIOR, tal cual, para el rincon del spawn (?isla=2, aprobado por Jose): sus cuatro tramos se dimensionan con
  // este horneado (1,94 x 1,12 x 0,8) y con el seto largo se comprimian a 0,56 y se metian en el banco. Banda propia:
  // no entra en el reparto de las puntas.
  hedgeShort: Object.freeze({ url: '/models-v40/dressing/hedge-short.glb', size: [4.0, 1.9, 0.8], banda: 'rincon', solid: true, peso: 0, rise: 1.4 }),
  // puerta en +x en el crudo; manda el ancho
  garage: Object.freeze({ url: '/models-v40/dressing/garage.glb', size: [3.2, 2.6, 5.2], banda: 'fondo', solid: true, peso: 2, rawYaw: -Math.PI / 2 }),
  shed: Object.freeze({ url: '/models-v40/dressing/shed.glb', size: [2.4, 2.3, 2.2], banda: 'fondo', solid: true, peso: 2, rawYaw: -Math.PI / 2 }),
});

// El tamano REAL que tiene la pieza en el mundo: el crudo del GLB (src/kitRawSizes.js, GENERADO por
// scripts/measure-kit-raw.mjs) por la escala uniforme que le aplica bakeKitGeometry en main.js. `size` es un
// TOPE: la cota que lo toca es la mas restrictiva y las otras dos quedan por debajo -- a veces MUY por
// debajo (medido el 2026-09-12: la tapia hornea a 0,05 x 0,11 m porque Tripo la entrego con el largo en z,
// el cartel a 0,15 m de alto, el hatchback atravesado de 1,72 x 1,06, el seto a 1,94 m y no 4). Los
// colliders de este modulo siguen usando la caja nominal (mas grande que la pieza, nunca mas chica) hasta
// que el kit se re-ajuste; el rincon del spawn ya coloca con el tamano real.
export function bakedKitSize(id) {
  const raw = KIT_RAW[id], spec = DRESSING_KIT[id];
  if (!raw || !spec) return null;
  // el crudo YA girado por rawYaw, que es como lo mide bakeKitGeometry: un cuarto de vuelta cambia x por z
  const [rx, ry, rz] = Math.abs(Math.abs(spec.rawYaw ?? 0) - Math.PI / 2) < 1e-9 ? [raw[2], raw[1], raw[0]] : raw;
  const k = fitScaleForWorldBox({ x: rx, y: ry, z: rz }, { maxWidthX: spec.size[0], maxDepthZ: spec.size[2], maxHeight: spec.size[1] });
  return [+(rx * k).toFixed(4), +(ry * k).toFixed(4), +(rz * k).toFixed(4)];
}

// Los carriles. Los de vereda se recorren a lo largo; los de estacionamiento son los 2,2 m contra
// cada cordon de la transversal (la primera version les dio 1,90 -- el ancho exacto de un auto -- y
// el barrido devolvio CERO sitios porque no quedaba un milimetro de margen).
export const BANDS = Object.freeze({
  vereda: Object.freeze([
    // La primera version puso el eje en |x| = 5,72 con 1,3 m de ancho y la banda caia justo encima de
    // los faroles (jardinera 4,689..5,512) y de los cierres de frente (|x| >= 6,15): quedaban 0,6 m
    // utiles y entraban 4 piezas por lado en 92 m. Corrida al delantal, que es piso duro y esta libre
    // delante de cada casa, entran las que tienen que entrar y los huecos entre casas se rechazan
    // solos porque ahi SI hay cerca.
    Object.freeze({ id: 'av-O', eje: 'z', fijo: -6.45, desde: 12, hasta: 104, ancho: 1.5, mira: Math.PI / 2 }),
    Object.freeze({ id: 'av-E', eje: 'z', fijo: 6.45, desde: 12, hasta: 104, ancho: 1.5, mira: -Math.PI / 2 }),
    Object.freeze({ id: 'tr-S', eje: 'x', fijo: 29.9, desde: -49, hasta: 49, ancho: 0.8, mira: 0 }),
    Object.freeze({ id: 'tr-N', eje: 'x', fijo: 38.1, desde: -49, hasta: 49, ancho: 0.8, mira: Math.PI }),
  ]),
  estacionamiento: Object.freeze({
    sur: Object.freeze([30.45, 32.65]),
    norte: Object.freeze([35.35, 37.55]),
  }),
});

export const VEREDA_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', vereda: false, autos: false, fondo: false }),
  Object.freeze({ id: 1, key: 'vereda', label: 'VEREDA', vereda: true, autos: false, fondo: false }),
  Object.freeze({ id: 2, key: 'completa', label: 'COMPLETA', vereda: true, autos: true, fondo: true }),
]);
export const DEFAULT_VEREDA_PRESET = 2;

export function veredaPresetById(id) {
  return VEREDA_PRESETS.find(p => p.id === id) ?? VEREDA_PRESETS[DEFAULT_VEREDA_PRESET];
}

export function readVeredaPreset(search, fallback = DEFAULT_VEREDA_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('vestida') ?? params.get('dressing');
  // `?vestida=` sin valor devuelve '' y Number('') es 0: la trampa de las otras siete perillas.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && VEREDA_PRESETS.some(p => p.id === value) ? value : fallback;
}

function hash32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  return (hash ^ (hash >>> 16)) >>> 0;
}
const unit = salt => hash32(`dressing#${salt}`) / 4294967296;
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// TODO lo que ya ocupa suelo, de las OCHO fuentes. Los delantales NO entran: son piso duro, y una
// bolsa de basura apoyada sobre el pavimento de una casa es exactamente lo que se quiere.
export function occupiedBoxes() {
  const out = [];
  const push = (b, from) => { if (b && Number.isFinite(b.minX)) out.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, from }); };
  for (const f of HOUSE_FOOTPRINTS) push(f, 'casa');
  for (const c of LOT_FENCE_COLLIDERS) push(c, 'cerca');
  // Solo los obstaculos que NO son de casa. Los de casa son la caja DECLARADA, que sobresale hasta
  // 1,42 m de la fachada real: usarlos aca haria que el vestido esquive 172 m2 de vereda que desde
  // `16acbd6` son perfectamente pisables. Las casas ya entraron arriba con su huella MEDIDA.
  for (const o of STREET_LAYOUT.obstacles) {
    if (HOUSE_FOOTPRINTS.some(f => o.minX < f.maxX && o.maxX > f.minX && o.minZ < f.maxZ && o.maxZ > f.minZ)) continue;
    push(o, 'obstaculo');
  }
  for (const p of CITY_PERIMETER) push(p, 'perimetro');
  for (const y of yardBoxes()) push(y.box ?? y, 'patio');
  for (const c of propColliders(solidosPresetById(2))) push(c, 'prop');
  // Las hojas de cerca viven rotadas: se usa su AABB, que es lo que el jugador ve ocupar espacio.
  for (const lf of fenceLeaves()) {
    const c = Math.abs(Math.cos(lf.yaw)), s = Math.abs(Math.sin(lf.yaw));
    const L = (lf.length ?? lf.width ?? 1) / 2, T = 0.1;
    push({ minX: lf.x - (c * L + s * T), maxX: lf.x + (c * L + s * T), minZ: lf.z - (s * L + c * T), maxZ: lf.z + (s * L + c * T) }, 'hoja');
  }
  for (const p of fencePosts()) push({ minX: p.x - 0.09, maxX: p.x + 0.09, minZ: p.z - 0.09, maxZ: p.z + 0.09 }, 'poste');
  push(NOOK_MOUTH, 'boca');
  // delante de cada puerta medida (frontDoorMap) no nace nada: un tacho en la puerta es lo que no queremos
  for (const k of doorKeepouts()) push(k, 'umbral');
  // ni donde la cebra deja al peaton (crossingState): un hidrante y un cantero dejaban 0,585 m al pie de una rampa
  for (const l of crossingLandings()) push(l, 'desembarco');
  return out;
}

// EL CUELLO. La vereda de la transversal mide 1,05 m mas el delantal; una pieza de 0,85 de fondo en el medio deja
// 0,18 de un lado y 0,02 del otro, y el jugador (0,56) tiene que bajar a la calzada para pasarla. Medido por un
// refutador: tres piezas de la vereda norte dejaban 0,36 / 0,46 / 0,53 m. Una pieza de vereda solo nace si deja, del
// lado del cordon o del lado de las casas, un paso de PASSAGE (el jugador mas el margen de cada lado) hasta la
// primera estructura (huella de casa o cerca) que le queda enfrente.
export const PASSAGE = +(0.56 + 2 * CLEARANCE).toFixed(3);
// Cuanto hay que correr una caja para dejarla a KERB_SNAP del cordon de su banda, del lado de la vereda.
const KERB_SNAP = 0.05;
export function snapToKerb(box, banda) {
  if (banda.eje === 'z') {
    const kerb = Math.sign(banda.fijo) * 4.2;
    return { dx: +(banda.fijo < 0 ? (kerb - KERB_SNAP) - box.maxX : (kerb + KERB_SNAP) - box.minX).toFixed(4), dz: 0 };
  }
  const south = banda.fijo < STREET_LAYOUT.intersectionZ;
  const kerb = south ? 30.405 : 37.595;
  return { dx: 0, dz: +(south ? (kerb - KERB_SNAP) - box.maxZ : (kerb + KERB_SNAP) - box.minZ).toFixed(4) };
}
export function neckFor(box, banda) {
  const structures = [...HOUSE_FOOTPRINTS, ...LOT_FENCE_COLLIDERS];
  if (banda.eje === 'z') {
    // avenida: el cordon en |x| = 4,2, las casas mas afuera
    const kerb = Math.sign(banda.fijo) * 4.2;
    const out = Math.sign(banda.fijo);
    const gapKerb = out > 0 ? box.minX - kerb : kerb - box.maxX;
    const behind = structures.filter(s => s.minZ < box.maxZ && s.maxZ > box.minZ && (out > 0 ? s.minX >= box.maxX - 1e-6 : s.maxX <= box.minX + 1e-6));
    const wall = behind.length ? (out > 0 ? Math.min(...behind.map(s => s.minX)) : Math.max(...behind.map(s => s.maxX))) : null;
    const gapWall = wall === null ? Infinity : (out > 0 ? wall - box.maxX : box.minX - wall);
    return +Math.max(gapKerb, gapWall).toFixed(3);
  }
  // transversal: el cordon en z 30,405 (sur) o 37,595 (norte), las casas mas afuera
  const south = banda.fijo < STREET_LAYOUT.intersectionZ;
  const kerb = south ? 30.405 : 37.595;
  const gapKerb = south ? kerb - box.maxZ : box.minZ - kerb;
  const behind = structures.filter(s => s.minX < box.maxX && s.maxX > box.minX && (south ? s.maxZ <= box.minZ + 1e-6 : s.minZ >= box.maxZ - 1e-6));
  const wall = behind.length ? (south ? Math.max(...behind.map(s => s.maxZ)) : Math.min(...behind.map(s => s.minZ))) : null;
  const gapWall = wall === null ? Infinity : (south ? box.minZ - wall : wall - box.maxZ);
  return +Math.max(gapKerb, gapWall).toFixed(3);
}

// Los carriles por los que ya pasa algo. Plantar un prop ahi es peor que no plantarlo: se ve
// atravesado cuatro veces por minuto.
const LANES = Object.freeze([
  Object.freeze({ minX: -3.82, maxX: -1.62, minZ: 11, maxZ: 108 }),
  Object.freeze({ minX: 1.62, maxX: 3.82, minZ: 11, maxZ: 108 }),
  Object.freeze({ minX: -4.95, maxX: -3.95, minZ: STREET_LAYOUT.foxWalker.minZ, maxZ: STREET_LAYOUT.foxWalker.maxZ }),
  Object.freeze({ minX: 3.95, maxX: 4.95, minZ: STREET_LAYOUT.neonCatWalker.minZ, maxZ: STREET_LAYOUT.neonCatWalker.maxZ }),
  // T48: los cuatro caminantes del roster, con el mismo ±0,5 de los dos de arriba. Medido el 2026-09-14: ninguna
  // pieza puesta (presets 1 y 2) pisaba estos carriles, asi que el reparto del vestido no cambia.
  ...STREET_WALKERS.map(walker => Object.freeze({ minX: walker.lane - 0.5, maxX: walker.lane + 0.5, minZ: walker.minZ, maxZ: walker.maxZ })),
]);

// La bocacalle: el unico cruce que hay. Un auto parado ahi tapa el paso entre las dos mitades.
const BOCACALLE = Object.freeze({ minX: -8, maxX: 8, minZ: 28, maxZ: 40 });

// LA CALZADA DEL CRUCE. La banda av-O corre de z 12 a 104 y la tr-N de x -49 a 49, y ninguna sabia que en el
// medio esta el cruce: medido el 2026-09-12 (evidencia/ciudad/medir-cruce.mjs), un hidrante nacia en
// (-6,1 / 32,9), sobre el asfalto de la transversal, y un cantero en (0,5 / 38,2), en el medio de la avenida.
// Una pieza de vereda solo nace con vereda (o delantal) debajo: entera dentro de una de estas ocho zonas. Cada
// zona va del borde interior del cordon (|x| = 4,2 en la avenida, z 30,4 / 37,6 en la transversal, que son las
// caras de las cajas de asfalto de main.js) hasta 1,8 m por fuera del borde exterior de la vereda, que es hasta
// donde llega el delantal mas hondo (1,67 m); las huellas de las casas, que ya estan en `occupiedBoxes`, frenan
// antes. Se cortan en el cruce: ahi no hay vereda, hay asfalto.
const AVENUE_ROAD_EDGE = 4.2, CROSS_ROAD = Object.freeze({ minZ: 30.4, maxZ: 37.6 }), APRON_REACH = 1.8;
export const SIDEWALK_ZONES = Object.freeze([
  Object.freeze({ id: 'av-O-sur', minX: -SIDEWALK_EDGE.main - APRON_REACH, maxX: -AVENUE_ROAD_EDGE, minZ: 6, maxZ: CROSS_ROAD.minZ }),
  Object.freeze({ id: 'av-O-norte', minX: -SIDEWALK_EDGE.main - APRON_REACH, maxX: -AVENUE_ROAD_EDGE, minZ: CROSS_ROAD.maxZ, maxZ: 110 }),
  Object.freeze({ id: 'av-E-sur', minX: AVENUE_ROAD_EDGE, maxX: SIDEWALK_EDGE.main + APRON_REACH, minZ: 6, maxZ: CROSS_ROAD.minZ }),
  Object.freeze({ id: 'av-E-norte', minX: AVENUE_ROAD_EDGE, maxX: SIDEWALK_EDGE.main + APRON_REACH, minZ: CROSS_ROAD.maxZ, maxZ: 110 }),
  Object.freeze({ id: 'tr-S-oeste', minX: -54, maxX: -AVENUE_ROAD_EDGE, minZ: SIDEWALK_EDGE.cross.south - APRON_REACH, maxZ: CROSS_ROAD.minZ }),
  Object.freeze({ id: 'tr-S-este', minX: AVENUE_ROAD_EDGE, maxX: 54, minZ: SIDEWALK_EDGE.cross.south - APRON_REACH, maxZ: CROSS_ROAD.minZ }),
  Object.freeze({ id: 'tr-N-oeste', minX: -54, maxX: -AVENUE_ROAD_EDGE, minZ: CROSS_ROAD.maxZ, maxZ: SIDEWALK_EDGE.cross.north + APRON_REACH }),
  Object.freeze({ id: 'tr-N-este', minX: AVENUE_ROAD_EDGE, maxX: 54, minZ: CROSS_ROAD.maxZ, maxZ: SIDEWALK_EDGE.cross.north + APRON_REACH }),
]);
const within = (b, z) => b.minX >= z.minX && b.maxX <= z.maxX && b.minZ >= z.minZ && b.maxZ <= z.maxZ;
const onSidewalk = box => SIDEWALK_ZONES.some(zone => within(box, zone));

const cajaDe = (x, z, w, d) => ({ minX: +(x - w / 2).toFixed(4), maxX: +(x + w / 2).toFixed(4), minZ: +(z - d / 2).toFixed(4), maxZ: +(z + d / 2).toFixed(4) });
const inflar = (b, m) => ({ minX: b.minX - m, maxX: b.maxX + m, minZ: b.minZ - m, maxZ: b.maxZ + m });

function libre(caja, ocupado, puestas, puntos) {
  const conMargen = inflar(caja, CLEARANCE);
  if (ocupado.some(o => overlaps(conMargen, o))) return false;
  if (puestas.some(p => overlaps(conMargen, p.box))) return false;
  if (LANES.some(l => overlaps(caja, l))) return false;
  for (const s of puntos) {
    const d = Math.hypot(Math.max(caja.minX - s.x, 0, s.x - caja.maxX), Math.max(caja.minZ - s.z, 0, s.z - caja.maxZ));
    if (d < SPAWN_CLEARANCE) return false;
  }
  return true;
}

// REPARTO POR ROTACION, no por ruleta. La version anterior sorteaba por peso con un hash, y lo que
// Jose vio en el video del 2026-09-11 fue OCHO de quince autos iguales con tandas de TRES seguidos,
// y nueve canteros sobre cuarenta y cinco props de vereda. Una ruleta no reparte: acumula. Y acumular
// el mismo modelo en fila es exactamente el defecto de copiar y pegar del que se quejo al principio
// ("cinco casas iguales en fila se leen como un error de copiar y pegar"), reintroducido por el
// modulo que venia a arreglarlo.
//
// El rotador recorre los ids desde un cursor propio de cada banda, prueba el siguiente si el primero
// no entra, y **avanza el cursor solo cuando una pieza se coloca**: contandolo en cada intento, los
// rechazos (una cerca, una casa, un spawn) se comen el reparto y vuelven las tandas. Sigue siendo
// determinista -- sin `Math.random` -- porque si la colocacion fuera aleatoria el gate mediria una
// ciudad y el jugador veria otra.
// Ademas de rotar, el rotador ofrece PRIMERO lo menos usado. Rotar a secas no alcanzaba: cuando el
// candidato de turno no entra se prueba el siguiente, y las piezas CHICAS (los cajones miden
// 0,60 x 0,45) entran en huecos donde las grandes no, asi que se comian los lugares apretados --
// medido: cajones x4 de 14 en la vereda oeste. Ordenando por uso, la pieza que ya salio cuatro veces
// se ofrece ultima.
function crearRotador(ids) {
  let cursor = 0;
  const usos = new Map(ids.map(id => [id, 0]));
  return {
    // y nadie va DOS por delante del que menos salio: con el cuello de la transversal rechazando las piezas hondas, el
    // cesto (el mas chico) salia cuatro veces en catorce; con esta cota el maximo por banda queda en ceil(n/ids) + 1
    candidatos: () => {
      const menor = Math.min(...usos.values());
      return ids
        .map((_, i) => ids[(cursor + i) % ids.length])
        .filter(id => usos.get(id) <= menor + 1)
        .sort((a, b) => usos.get(a) - usos.get(b));
    },
    avanzar: (id) => { cursor += 1; if (id) usos.set(id, usos.get(id) + 1); },
    usosDe: (id) => usos.get(id) ?? 0,
  };
}

// Los huecos de las dos filas de la transversal, con su linea de frente. Un hueco util mide entre
// FONDO_MIN y FONDO_MAX: por debajo no cabe nada y por encima es la bocacalle (31,5 m), que tiene
// que quedar abierta porque es el unico cruce del mapa.
// El minimo no es un gusto: el jugador mide 0,56 m de ancho (radio 0,28). Un hueco de 0,9 m lo deja
// pasar, asi que se cierra. La primera version puso 2,2 y dejaba abiertas las dos puntas del ESTE,
// que miden 2,1 m entre el ultimo edificio y el muro.
export const FONDO_MIN = 0.9, FONDO_MAX = 7.5;
// compresion minima de un relleno de punta respecto de su largo horneado
export const FONDO_MIN_SCALE = 0.5;
// El rectangulo jugable, de `boundsForLocation('street')`. Se escribe aca para no importar
// navigationState y crear un ciclo: el test lo ancla contra el valor vivo.
export const BOUNDS = Object.freeze({ mapa: Object.freeze({ minX: -54, maxX: 54, minZ: 8.65, maxZ: 108.4 }) });

// LA BOCA DEL NICHO DEL SPAWN. Entre la tienda (START-WEST) y el borde sur del mapa hay un nicho de 4,6 x 3,4 m
// (el del diorama de mobiliario: ?isla). Su unica entrada es por el borde de la vereda, y el vestido ponia justo
// ahi unos cajones (av-O, z 11,1..11,8) que, con la jardinera del arbusto de (-5,35 / 9,7), dejaban un cuello de
// 0,76 m -- un refutador lo midio con el moveCircle del juego; el jugador mide 0,56 y el margen del vestido es
// 0,18 por lado. La boca queda RESERVADA: ninguna pieza del vestido nace en ella. Arranca 1,05 m por encima
// del borde del mapa para dejarle la esquina al hidrante del rincon (con su margen de cada lado).
const shopSW = HOUSE_FOOTPRINTS.find(f => f.id === 'START-WEST');
export const NOOK_MOUTH = Object.freeze({
  id: 'boca-rincon',
  minX: -SIDEWALK_EDGE.main - 1.4, maxX: -SIDEWALK_EDGE.main,
  minZ: +(BOUNDS.mapa.minZ + 1.05).toFixed(3), maxZ: shopSW.minZ,
});
export function crossRowGaps() {
  const huecos = [];
  for (const side of ['south', 'north']) {
    const fila = HOUSE_FOOTPRINTS.filter(f => f.street === 'cross' && f.side === side).sort((a, b) => a.minX - b.minX);
    for (let i = 0; i < fila.length - 1; i++) {
      const luz = fila[i + 1].minX - fila[i].maxX;
      if (luz < FONDO_MIN || luz > FONDO_MAX) continue;
      const frente = side === 'south'
        ? Math.max(fila[i].maxZ, fila[i + 1].maxZ)
        : Math.min(fila[i].minZ, fila[i + 1].minZ);
      huecos.push({ id: `${side}-${fila[i].id}->${fila[i + 1].id}`, side, x: (fila[i].maxX + fila[i + 1].minX) / 2, luz: +luz.toFixed(3), frente: +frente.toFixed(3) });
    }
    // LAS PUNTAS DE FILA, que es el agujero de verdad. Los huecos ENTRE edificios ya los cierra el
    // paquete L con sus 37 cierres de frente, y por eso los rellenos de arriba se auto-rechazan. Pero
    // el extremo de la fila NO tiene vecino con quien cerrar: entre el ultimo edificio y el muro del
    // mapa quedan 4,75 m al oeste y 3,70 m al este, y por ahi el jugador rodea la fila entera y cae
    // en los bolsones ciegos de x +-44..52, donde la pantalla es una losa a un metro de la cara.
    const primero = fila[0], ultimo = fila[fila.length - 1];
    // El limite NO es el rectangulo jugable (|x| = 54) sino la cara interior del muro de la ciudad:
    // `CITY_PERIMETER` lo pone en |x| = 52,4. Tirar el relleno hasta 54 lo metia 1,6 m dentro del
    // muro y los cuatro se auto-rechazaban.
    const zFila = side === 'south' ? primero.maxZ : primero.minZ;
    const muro = (lado) => {
      const cajas = CITY_PERIMETER.filter(o => o.minZ <= zFila && o.maxZ >= zFila && (lado === 'O' ? o.maxX <= 0 : o.minX >= 0));
      if (!cajas.length) return lado === 'O' ? BOUNDS.mapa.minX : BOUNDS.mapa.maxX;
      return lado === 'O' ? Math.max(...cajas.map(o => o.maxX)) : Math.min(...cajas.map(o => o.minX));
    };
    for (const [borde, edificio, lado] of [[muro('O'), primero, 'O'], [muro('E'), ultimo, 'E']]) {
      const luz = lado === 'O' ? edificio.minX - borde : borde - edificio.maxX;
      if (luz < FONDO_MIN || luz > FONDO_MAX) continue;
      // El tramo va del MURO a la cara del edificio, y el margen se come del lado del muro, nunca del
      // lado de la casa: sumarlo a los dos lados metia el relleno 0,12 m dentro del vecino y los
      // cuatro se auto-rechazaban.
      const desde = lado === 'O' ? borde + CLEARANCE + 0.01 : edificio.maxX + CLEARANCE + 0.01;
      const hasta = lado === 'O' ? edificio.minX - CLEARANCE - 0.01 : borde - CLEARANCE - 0.01;
      huecos.push({
        id: `${side}-punta${lado}`, side, punta: true,
        x: +((desde + hasta) / 2).toFixed(4),
        spanX: +(hasta - desde).toFixed(4),
        luz: +luz.toFixed(3),
        frente: +(side === 'south' ? edificio.maxZ : edificio.minZ).toFixed(3),
      });
    }
  }
  return huecos;
}

export function dressingPlacements(preset = veredaPresetById(DEFAULT_VEREDA_PRESET)) {
  const puestas = [];
  if (!preset.vereda && !preset.autos && !preset.fondo) return puestas;
  const ocupado = occupiedBoxes();
  const puntos = spawnPoints();

  if (preset.vereda) {
    const ids = Object.keys(DRESSING_KIT).filter(id => DRESSING_KIT[id].banda === 'vereda');
    for (const banda of BANDS.vereda) {
      const PASO = 2.6;
      let n = 0;
      const rotador = crearRotador(ids);
      for (let t = banda.desde; t <= banda.hasta; t += PASO) {
        const salt = `${banda.id}#${t.toFixed(1)}`;
        // no se llena cada hueco: una vereda con un objeto cada 3 m tampoco es una calle
        if (unit(`${salt}#hay`) > 0.52) continue;
        // jitter a lo ancho de la banda y a lo largo, para que no quede una fila de soldados
        const corrido = (unit(`${salt}#a`) - 0.5) * (banda.ancho - 0.35);
        const largo = (unit(`${salt}#b`) - 0.5) * PASO * 0.6;
        const x = banda.eje === 'z' ? banda.fijo + corrido : t + largo;
        const z = banda.eje === 'z' ? t + largo : banda.fijo + corrido;
        // el prop mira a la calle, con un desvio para que no esten todos en escuadra
        const yaw = banda.mira + (unit(`${salt}#g`) - 0.5) * 0.7;
        const cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
        let puesto = null;
        for (const id of rotador.candidatos()) {
          // la caja es la de la pieza HORNEADA, no el tope: un banco de 1,19 m no ocupa 1,7
          const baked = bakedKitSize(id);
          const w = cs * baked[0] + sn * baked[2];
          const d = sn * baked[0] + cs * baked[2];
          const box = cajaDe(x, z, w, d);
          // dejando pasar al jugador por un lado o por el otro: si en el medio de la vereda no deja paso, la pieza va
          // contra el cordon (donde va un tacho en una vereda angosta) y se vuelve a medir
          let caja = box, px = x, pz = z;
          if (neckFor(caja, banda) < PASSAGE) {
            const corrida = snapToKerb(caja, banda);
            px = +(px + corrida.dx).toFixed(3); pz = +(pz + corrida.dz).toFixed(3);
            caja = cajaDe(px, pz, w, d);
          }
          if (neckFor(caja, banda) < PASSAGE) continue;
          // con vereda debajo, entera: la banda cruza la bocacalle y ahi no hay vereda, hay asfalto
          if (!onSidewalk(caja)) continue;
          if (!libre(caja, ocupado, puestas, puntos)) continue;
          puesto = { id: `${banda.id}-${id}-${n++}`, asset: id, x: px, z: pz, rotationY: +yaw.toFixed(4), box: caja, banda: banda.id };
          break;
        }
        if (!puesto) continue;
        rotador.avanzar(puesto.asset);
        puestas.push(puesto);
      }
    }
  }

  if (preset.autos) {
    const ids = Object.keys(DRESSING_KIT).filter(id => DRESSING_KIT[id].banda === 'estacionamiento');
    for (const [lado, rango] of Object.entries(BANDS.estacionamiento)) {
      const zc = (rango[0] + rango[1]) / 2;
      const PASO = 7.0;
      let n = 0;
      const rotador = crearRotador(ids);
      for (let x = -47; x <= 47; x += PASO) {
        const salt = `auto#${lado}#${x.toFixed(1)}`;
        if (unit(`${salt}#hay`) > 0.62) continue;
        const cx = x + (unit(`${salt}#j`) - 0.5) * 1.4;
        // mirando a lo largo de la calle, para un lado o para el otro
        const yaw = (unit(`${salt}#d`) > 0.5 ? 1 : -1) * Math.PI / 2;
        let puesto = null;
        for (const id of rotador.candidatos()) {
          const baked = bakedKitSize(id);
          // el auto va a lo largo de la calle: el LARGO corre en X y el ANCHO en Z
          const box = cajaDe(cx, zc, baked[2], baked[0]);
          if (box.minZ < rango[0] - 0.01 || box.maxZ > rango[1] + 0.01) continue;
          if (overlaps(box, BOCACALLE)) continue;
          if (!libre(box, ocupado, puestas, puntos)) continue;
          puesto = { id: `${lado}-${id}-${n++}`, asset: id, x: +cx.toFixed(3), z: +zc.toFixed(3), rotationY: +yaw.toFixed(4), box, banda: `park-${lado}` };
          break;
        }
        if (!puesto) continue;
        rotador.avanzar(puesto.asset);
        puestas.push(puesto);
      }
    }
  }
  if (preset.fondo) {
    const ids = Object.keys(DRESSING_KIT).filter(id => DRESSING_KIT[id].banda === 'fondo');
    const rotadorFondo = crearRotador(ids);
    for (const hueco of crossRowGaps()) {
      // El relleno se estira en X hasta el hueco. Los huecos ENTRE edificios solapan un pelo sobre los
      // vecinos para que no quede rendija; las PUNTAS ya vienen con su tramo calculado y no se tocan.
      const ancho = hueco.spanX ?? (hueco.luz + 0.24);
      // Reparto por rotacion y no por ruleta: con cuatro puntas y cuatro piezas, el hash daba dos
      // cobertizos y dos setos iguales, que es el mismo defecto de copiar y pegar del que se quejo
      // Jose. Y el indice avanza SOLO cuando una pieza entra: contandolo en cada intento, los rechazos
      // de los huecos que L ya cierra con cercas se comian el reparto.
      let puesto = null;
      // Con cuatro puntas y cinco piezas, el orden manda: entre las menos usadas va primero la que menos se deforma
      // (la mas cerca de su largo horneado). Solo por rotacion, el seto largo de 4 m caia en la punta de 1,74 m
      // (comprimido a 0,44) y el cobertizo se estiraba a 1,2.
      const porAjuste = rotadorFondo.candidatos()
        .map(id => ({ id, escala: ancho / bakedKitSize(id)[0] }))
        .filter(c => c.escala >= FONDO_MIN_SCALE && c.escala <= 1.6)
        .sort((a, b) => (rotadorFondo.usosDe(a.id) - rotadorFondo.usosDe(b.id)) || (Math.abs(a.escala - 1) - Math.abs(b.escala - 1)))
        .map(c => c.id);
      for (const id of porAjuste) {
        if (puesto) break;
        const pieza = DRESSING_KIT[id], baked = bakedKitSize(id);
        const fondoZ = baked[2];
        // la cara que da a la calle se apoya en la linea de frente; la pieza crece hacia adentro,
        // donde hay 10 m de pasto sellado, asi que el fondo de la pieza no limita nada
        const z = hueco.side === 'south' ? hueco.frente - fondoZ / 2 : hueco.frente + fondoZ / 2;
        const box = cajaDe(hueco.x, z, ancho, fondoZ);
        if (!libre(box, ocupado, puestas, puntos)) continue;
        // el estiramiento se mide contra el largo HORNEADO: contra el nominal, el seto (1,94 m) cubria el 48 % de su punta
        puesto = { id: `fondo-${hueco.id}`, asset: id, x: +hueco.x.toFixed(3), z: +z.toFixed(3), rotationY: hueco.side === 'south' ? 0 : Math.PI, escalaX: +(ancho / baked[0]).toFixed(4), ...(pieza.rise ? { escalaY: pieza.rise } : {}), box, banda: `fondo-${hueco.side}` };
      }
      if (!puesto) continue;
      rotadorFondo.avanzar(puesto.asset);
      puestas.push(puesto);
    }
  }
  return puestas;
}

export function dressingColliders(preset = veredaPresetById(DEFAULT_VEREDA_PRESET)) {
  return dressingPlacements(preset)
    .filter(p => DRESSING_KIT[p.asset].solid)
    .map(p => ({ id: p.id, ...p.box }));
}
