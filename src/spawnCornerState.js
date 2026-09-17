// El rincon del spawn: el diorama de mobiliario deja de ser un diorama.
//
// EL DEFECTO, medido el 2026-09-12. `street-furniture-cluster.glb` (STREET_LAYOUT.furniture, en
// -10,5 / 10,5) es un banco, un cesto, un buzon, un hidrante y un cartel PEGADOS a un disco hexagonal
// de piedra que flota 5 cm sobre el pasto. Es lo primero que se ve al salir del galpon y girar a la
// izquierda, y es el mismo defecto de tarima que Jose vio en el kit del vestido (evidencia/ciudad/
// detectar-tarima.mjs): un asset que trae su propio suelo se lee como maqueta, no como calle.
// Colocado como lo coloca el runtime (normalizeAsset a 1,8 m, y = 0,08, rotationY PI/2) ocupa
// x -11,62..-9,38 / z 9,03..11,97: el 46 % del disco (1,02 de 2,25 m) queda dentro del bolsillo
// sellado (`pocket-sw`, x < -10,6) donde el jugador no llega. Y es UNA sola malla de 5.279 triangulos, asi
// que no se puede esconder solo la tarima: se esconde entero.
//
// LO QUE ENTRA. Las cuatro piezas del kit que ya existen (`bench`, `litterbin`, `mailbox`, `hydrant`,
// generadas con Tripo sin base), sueltas, en el nicho de pasto que queda entre la pared sur de la
// tienda (z 12,07), el borde de la vereda (x -6, 9 cm mas alta), el borde del mapa (z 8,65) y la
// cara del bolsillo (x -10,6). El 2 ademas pavimenta el nicho a la cota del cordon (el delantal ya
// paga esa regla: misma cota = misma superficie) y lo cierra con setos por el oeste y el sur (dos tramos
// por lado), que es por donde hoy se ve el pasto sellado hasta el horizonte (salida A del diagnostico).
//
// TAMANOS REALES, NO NOMINALES. `DRESSING_KIT[id].size` es un tope y la escala uniforme la fija la cota
// mas restrictiva: el seto hornea a 1,94 m de largo y 1,12 de alto (no 4 x 1,9), el banco a 1,19 m (no
// 1,7). Cada caja de aca sale de `bakedKitSize`, que es lo que de verdad se ve. El banco tenia el
// RESPALDO en +z del crudo (medido: +0,169 m en el tercio superior): el kit lo gira media vuelta al hornear
// (rawYaw), asi que con yaw PI/2 el asiento mira a +x, la calle, y el respaldo queda contra el seto.
//
// POR QUE NO SON INSTANCIAS DEL VESTIDO. Las mallas de `?vestida` se esconden enteras cuando el
// preset no las usa; si las piezas del rincon fueran instancias de esas mallas, `?vestida=0` se las
// llevaria y las dos perillas quedarian atadas. Son Meshes propios, horneados con la misma receta.
//
// Perilla como las otras once: ?isla=0|1|2 (alias ?rincon=), el 0 es el juego de hoy bit a bit (el
// diorama se sigue cargando y solo se esconde), se conmuta en caliente desde ?qa y __robinweedQA.
import { HOUSE_FOOTPRINTS, SIDEWALK_EDGE } from './lotState.js';
import { LOT_FENCE_COLLIDERS } from './lotFenceState.js';
import { CITY_PERIMETER } from './cityBoundsState.js';
import { STREET_LAYOUT } from './streetLifeState.js';
import { DRESSING_KIT, CLEARANCE, BOUNDS, occupiedBoxes, dressingPlacements, dressingColliders, veredaPresetById, bakedKitSize } from './streetDressingState.js';
import { PROP_FOOTPRINTS, propColliders, solidosPresetById, spawnPoints, SPAWN_CLEARANCE, tightenedStreetBase } from './propColliderState.js';
import { APRON_TOP, APRON_THICKNESS, APRON_TILE_METRES, GRASS_TOP } from './frontApronState.js';
import { SIDE_WALL_MAP } from './sideWallMap.js';

export const ISLA_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', island: true, pieces: false, pad: false, hedges: false }),
  Object.freeze({ id: 1, key: 'loose', label: 'SUELTAS', island: false, pieces: true, pad: false, hedges: false }),
  Object.freeze({ id: 2, key: 'corner', label: 'RINCON', island: false, pieces: true, pad: true, hedges: true }),
]);
export const DEFAULT_ISLA_PRESET = 2;

export function islaPresetById(id) {
  return ISLA_PRESETS.find(preset => preset.id === id) ?? ISLA_PRESETS[DEFAULT_ISLA_PRESET];
}

export function readIslaPreset(search, fallback = DEFAULT_ISLA_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('isla') ?? params.get('rincon');
  // `?isla=` sin valor devuelve '' y Number('') es 0: la trampa de las otras once perillas.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && ISLA_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

export const hidesIsland = preset => !preset.island;

// La cota del pasto vive en frontApronState (con la del cordon); se re-exporta para el test y los probes.
export { GRASS_TOP };
// El solado va a la cota del cordon, igual que el delantal: misma cota, misma superficie.
export const PAD_TOP = APRON_TOP;
export const PAD_TILE_METRES = APRON_TILE_METRES;
// Lo que necesita el jugador (0,56 de ancho) para entrar sin rozar: su ancho mas el margen de cada lado.
export const PASSAGE_MIN = +(0.56 + 2 * CLEARANCE).toFixed(3);
// Cuanto se estira el seto en alto. Hornea a 1,12 m: desde el ojo (1,68 m) a 3 m, el pasto sellado de atras
// se ve a partir de 9 m; a 1,57 m (x1,4) recien a partir de 28 m, y el arbol de (-17 / 9,5) sigue asomando.
export const HEDGE_RISE = 1.4;
// Donde termina la caja de la vereda de la avenida en main.js (`box([1.8,.16,24.4],curbMaterial,[x,.04,18.2])`:
// 18,2 + 12,2). BoxGeometry pone v = 0 en la cara +z, asi que las baldosas de la vereda arrancan ahi y se
// repiten cada 1,6 m hacia el sur; el solado corre su v para que las juntas coincidan en la costura x = -6.
export const SIDEWALK_Z_END = 30.4;

const r4 = n => +n.toFixed(4);
const r3 = n => +n.toFixed(3);
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const inflar = (b, m) => ({ minX: b.minX - m, maxX: b.maxX + m, minZ: b.minZ - m, maxZ: b.maxZ + m });

// El diorama, tal como lo coloca y lo colisiona el juego de hoy.
const furniture = PROP_FOOTPRINTS.furniture;
export const ISLAND = Object.freeze({
  placement: STREET_LAYOUT.furniture,
  colliderId: 'furniture',
  // la misma cuenta que `caja()` en propColliderState, para que el filtro de main.js encuentre la caja
  colliderBox: Object.freeze({
    minX: r4(furniture.cx - furniture.x / 2), maxX: r4(furniture.cx + furniture.x / 2),
    minZ: r4(furniture.cz - furniture.z / 2), maxZ: r4(furniture.cz + furniture.z / 2),
  }),
  // MEDIDO con el GLB colocado como el runtime (scratchpad/medir-isla.mjs, 2026-09-12)
  visualBox: Object.freeze({ minX: -11.624, maxX: -9.376, minZ: 9.032, maxZ: 11.968, minY: 0.08, maxY: 1.88 }),
  tris: 5279,
});

// El rincon sale de los modulos vivos, no de numeros sueltos: si la tienda o el bolsillo se mueven,
// el rincon se mueve con ellos y el test lo vuelve a medir.
const pocket = CITY_PERIMETER.find(o => o.kind === 'pocket-sw');
const shop = HOUSE_FOOTPRINTS.find(f => f.id === 'START-WEST');
// La pared sur REAL de la tienda, medida con rayos contra el GLB (scripts/measure-side-walls.mjs): esta
// 0,38 m mas adentro que el borde del AABB, porque el AABB lo fija el alero. El primer corte cerro el seto
// en el AABB y quedo una rendija de 0,38 m entre el seto y la pared por la que se veia el pasto de atras.
const shopSouthWall = SIDE_WALL_MAP.get('START-WEST')?.south?.face ?? shop.minZ;
export const CORNER = Object.freeze({
  minX: pocket.maxX,            // la cara del bolsillo sellado
  maxX: -SIDEWALK_EDGE.main,    // el borde de la vereda
  minZ: BOUNDS.mapa.minZ,       // el borde del mapa
  maxZ: shop.minZ,              // el collider de la tienda (su AABB): las piezas sueltas se quedan de este lado
  wallZ: shopSouthWall,         // la pared real: hasta aca llegan el solado y el seto, por debajo del alero
});

// Cuanto se sale el cierre del rincon hacia el pasto sellado. Los setos no se apoyan DENTRO del nicho
// (se comerian medio metro del piso) sino montados sobre su borde: medio seto adentro, medio afuera.
const HEDGE_OVERHANG = 0.65;
// Del borde de la vereda hacia adentro, en baldosas enteras: 3 x 1,6 = 4,8 m, que cubre los 4,6 del
// nicho y los 0,15 que el seto oeste asoma sobre la linea del bolsillo. Ancho entero de baldosas para
// que el dibujo del cordon siga sin costura en x = -6.
const PAD_TILES = 3;

const cajaDe = (x, z, w, d) => ({ minX: r4(x - w / 2), maxX: r4(x + w / 2), minZ: r4(z - d / 2), maxZ: r4(z + d / 2) });

function pieza(id, asset, x, z, rotationY, extra = {}) {
  const kit = DRESSING_KIT[asset], baked = bakedKitSize(asset);
  const escalaX = extra.escalaX ?? 1;
  const cs = Math.abs(Math.cos(rotationY)), sn = Math.abs(Math.sin(rotationY));
  const w = cs * baked[0] * escalaX + sn * baked[2];
  const d = sn * baked[0] * escalaX + cs * baked[2];
  const out = { id, asset, x: r3(x), z: r3(z), rotationY, box: cajaDe(x, z, w, d), height: r3(baked[1] * (extra.escalaY ?? 1)), solid: kit.solid, hedge: false, ...extra };
  if (out.escalaX !== undefined) out.escalaX = r4(out.escalaX);
  if (out.escalaY !== undefined) out.escalaY = r4(out.escalaY);
  return out;
}

// Un seto que corre de `a` a `b` a lo largo de `eje`, con su otra cota centrada en `fijo`.
function seto(id, eje, a, b, fijo) {
  const largo = b - a, escalaX = largo / bakedKitSize('hedgeShort')[0];
  const centro = (a + b) / 2;
  return eje === 'x'
    ? pieza(id, 'hedgeShort', centro, fijo, 0, { escalaX, escalaY: HEDGE_RISE, hedge: true })
    : pieza(id, 'hedgeShort', fijo, centro, Math.PI / 2, { escalaX, escalaY: HEDGE_RISE, hedge: true });
}

// LA COLOCACION. Todo relativo a los bordes del rincon. El banco mira a la calle (frente en +z tras el
// rawYaw del kit; yaw PI/2 lo manda a +x: espalda al oeste, asiento al este), el cesto a su lado contra la tienda, el
// buzon en la pared sur de la tienda con las ranuras a lo largo de la pared (PI: quedan en +-x, una mira
// a la entrada del nicho), y el hidrante en la esquina sureste, a 60 cm de la vereda. La BOCA del nicho
// (NOOK_MOUTH, x -7,4..-6 / z 9,65..12,07) queda libre: ni el vestido ni el rincon ponen nada ahi, y por eso
// el buzon va a 2,6 m de la cara del bolsillo y no pegado a la vereda.
export function cornerPieces(preset = islaPresetById(DEFAULT_ISLA_PRESET)) {
  if (!preset.pieces) return [];
  const { minX: W, maxX: E, minZ: S, maxZ: N } = CORNER;
  const piezas = [
    pieza('rincon-bench', 'bench', W + 1.15, S + 1.65, Math.PI / 2),
    pieza('rincon-litterbin', 'litterbin', W + 1.15, N - 0.47, Math.PI / 2),
    pieza('rincon-mailbox', 'mailbox', W + 2.6, N - 0.42, Math.PI),
    pieza('rincon-hydrant', 'hydrant', E - 0.6, S + 0.6, Math.PI / 2),
  ];
  if (preset.hedges) {
    const hedgeDepth = bakedKitSize('hedgeShort')[2];
    // Dos tramos por lado, sin solaparse: el seto hornea a 1,94 m y cada lado mide ~4; un solo tramo
    // estirado al doble deforma el follaje, dos tramos casi nominales (x1,02-1,04) no.
    // El oeste: de mas alla del borde sur hasta la pared de la tienda, montado sobre la linea del bolsillo.
    const xO = W + hedgeDepth / 2 - 0.15, z0 = S - HEDGE_OVERHANG, zMid = (z0 + CORNER.wallZ) / 2;
    const oeste1 = seto('rincon-seto-oeste-1', 'z', z0, zMid, xO), oeste2 = seto('rincon-seto-oeste-2', 'z', zMid, CORNER.wallZ, xO);
    // El sur: desde la cara este del seto oeste hasta el borde de la vereda, montado sobre el borde del mapa.
    const zS = z0 + hedgeDepth / 2, x0 = oeste1.box.maxX, xMid = (x0 + E) / 2;
    piezas.push(oeste1, oeste2, seto('rincon-seto-sur-1', 'x', x0, xMid, zS), seto('rincon-seto-sur-2', 'x', xMid, E, zS));
  }
  return piezas;
}

export function cornerColliders(preset = islaPresetById(DEFAULT_ISLA_PRESET)) {
  return cornerPieces(preset).filter(p => p.solid).map(p => ({ id: p.id, ...p.box }));
}

export const cornerPieceY = preset => (preset.pad ? PAD_TOP : GRASS_TOP);

export function cornerPad(preset = islaPresetById(DEFAULT_ISLA_PRESET)) {
  if (!preset.pad) return null;
  return {
    minX: r4(CORNER.maxX - PAD_TILES * PAD_TILE_METRES), maxX: CORNER.maxX,
    minZ: r4(CORNER.minZ - HEDGE_OVERHANG), maxZ: CORNER.wallZ,
  };
}

// La misma forma que `apronGeometrySpecs`: main.js lo fusiona con `mergedGround` y lo pinta con el
// material del cordon. Se construye siempre (el preset solo lo muestra o lo esconde).
export function cornerPadSpecs() {
  const pad = cornerPad(islaPresetById(2));
  const sx = pad.maxX - pad.minX, sz = pad.maxZ - pad.minZ;
  // en x las juntas ya coinciden (el ancho es entero en baldosas y arranca en x = -6); en z se corre v
  const desfase = (SIDEWALK_Z_END - pad.maxZ) / PAD_TILE_METRES;
  return [{
    id: 'corner-pad',
    size: [sx, APRON_THICKNESS, sz],
    position: [(pad.minX + pad.maxX) / 2, APRON_TOP - APRON_THICKNESS / 2, (pad.minZ + pad.maxZ) / 2],
    uv: [sx / PAD_TILE_METRES, sz / PAD_TILE_METRES],
    uvOffset: [0, r4(desfase - Math.floor(desfase))],
  }];
}

const sameBox = (a, b) => a.minX === b.minX && a.maxX === b.maxX && a.minZ === b.minZ && a.maxZ === b.maxZ;
// La tienda para el chequeo de los setos: su AABB con el borde sur llevado a la pared real. Un seto puede
// meterse bajo el alero (entre el AABB y la pared) pero no cruzar la pared.
const shopBox = { minX: shop.minX, maxX: shop.maxX, minZ: shop.minZ, maxZ: shop.maxZ };
const shopWall = { ...shopBox, minZ: CORNER.wallZ };
const distanciaACaja = (c, p) => Math.hypot(Math.max(c.minX - p.x, 0, p.x - c.maxX), Math.max(c.minZ - p.z, 0, p.z - c.maxZ));

// Cada pieza cruzada contra TODO lo que ocupa suelo (las ocho fuentes de `occupiedBoxes`), contra el
// vestido del preset 2, contra las demas piezas y contra los 39 puntos de aparicion. Lo unico que se
// descuenta es la caja del diorama, que en estos presets no esta. Las piezas llevan el margen del
// vestido (CLEARANCE); los setos no: cerrar es tocar la pared y montar sobre la linea del bolsillo.
export function cornerConflicts(preset = islaPresetById(DEFAULT_ISLA_PRESET), extra = []) {
  const piezas = [...cornerPieces(preset), ...extra.map(e => ({ hedge: false, ...e }))];
  const ocupado = occupiedBoxes().filter(o => !(o.from === 'prop' && sameBox(o, ISLAND.colliderBox)));
  const vestido = dressingPlacements(veredaPresetById(2));
  const puntos = spawnPoints();
  const choques = [];
  piezas.forEach((p, i) => {
    const caja = p.hedge ? p.box : inflar(p.box, CLEARANCE);
    for (const o of ocupado) {
      if (p.hedge && o.from === 'perimetro') continue;
      if (p.hedge && o.from === 'casa' && sameBox(o, shopBox)) { if (overlaps(caja, shopWall)) choques.push({ id: p.id, contra: 'pared de la tienda' }); continue; }
      if (overlaps(caja, o)) choques.push({ id: p.id, contra: o.from });
    }
    for (const v of vestido) if (overlaps(caja, v.box)) choques.push({ id: p.id, contra: `vestido ${v.id}` });
    for (let j = i + 1; j < piezas.length; j++) {
      const q = piezas[j];
      const margen = p.hedge && q.hedge ? 0 : CLEARANCE;
      if (overlaps(inflar(p.box, margen), q.box)) choques.push({ id: p.id, contra: `pieza ${q.id}` });
    }
    for (const s of puntos) if (distanciaACaja(p.box, s) < SPAWN_CLEARANCE) choques.push({ id: p.id, contra: `spawn ${s.id}` });
  });
  return choques;
}

// Que el rincon siga siendo un lugar al que se ENTRA. Flood-fill de radio de jugador, paso 0,1 m,
// contra la MISMA composicion de colision que arma main.js (base ajustada, cercas, perimetro, props,
// vestido de ?vestida=2 y el rincon), desde la vereda hasta el centro del nicho.
// `width` es la LUZ REAL DEL CAMINO: el doble del mayor radio con el que el centro sigue llegando
// (barrido de 0,28 en adelante). La primera version media el tramo libre en UNA columna (x = -6,55) y daba
// 1,64 m; un refutador midio con moveCircle que el cuello estaba en otro lado -- entre la jardinera del
// arbusto y los cajones del vestido, 0,76 m -- y el test no podia ponerse rojo. Ahora la boca esta reservada
// (NOOK_MOUTH) y la luz se mide por donde de verdad se pasa.
// Los props van con ?solidos=1 (el poste, que es el preset recomendado). Con el 2 tambien se llega, pero
// con margen cero (0,56 m entre la jardinera del farol y lo que haya en la vereda).
export function cornerPassage(preset = islaPresetById(DEFAULT_ISLA_PRESET)) {
  const fuentes = {
    base: tightenedStreetBase(STREET_LAYOUT.obstacles),
    cercas: LOT_FENCE_COLLIDERS,
    perimetro: CITY_PERIMETER,
    props: propColliders(solidosPresetById(1)).filter(c => !(hidesIsland(preset) && c.id === ISLAND.colliderId)),
    vestido: dressingColliders(veredaPresetById(2)),
    rincon: cornerColliders(preset),
  };
  const obstaculos = Object.values(fuentes).flat();
  const b = BOUNDS.mapa;
  const libre = (x, z, R) => x - R >= b.minX && x + R <= b.maxX && z - R >= b.minZ && z + R <= b.maxZ
    && !obstaculos.some(o => x > o.minX - R && x < o.maxX + R && z > o.minZ - R && z < o.maxZ + R);
  const PASO = 0.1, X0 = CORNER.minX - 0.5, X1 = CORNER.maxX + 2, Z0 = CORNER.minZ, Z1 = CORNER.maxZ + 2;
  const nx = Math.round((X1 - X0) / PASO) + 1, nz = Math.round((Z1 - Z0) / PASO) + 1;
  const celda = (i, j) => [X0 + i * PASO, Z0 + j * PASO];
  // desde la vereda frente a la puerta de la tienda (0,35 m al este del spawn de shop-exit, que nace 3 cm
  // dentro del collider ajustado de la tienda -- preexistente) hasta el centro del nicho
  const zMedio = (CORNER.minZ + CORNER.maxZ) / 2 - 0.05;
  const inicio = [Math.round((CORNER.maxX + 0.4 - X0) / PASO), Math.round((CORNER.maxZ + 1.13 - Z0) / PASO)];
  const meta = [Math.round((CORNER.minX + 2.2 - X0) / PASO), Math.round((zMedio - Z0) / PASO)];
  const llega = (R) => {
    if (!libre(...celda(...inicio), R)) return false;
    const visto = new Uint8Array(nx * nz);
    const cola = [inicio];
    visto[inicio[0] * nz + inicio[1]] = 1;
    while (cola.length) {
      const [i, j] = cola.shift();
      if (i === meta[0] && j === meta[1]) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz || visto[ni * nz + nj]) continue;
        if (!libre(...celda(ni, nj), R)) continue;
        visto[ni * nz + nj] = 1;
        cola.push([ni, nj]);
      }
    }
    return false;
  };
  const reachable = llega(0.28 + 0.02);
  let rMax = 0;
  if (reachable) for (let R = 0.28; R <= 1.2; R = +(R + 0.01).toFixed(2)) { if (!llega(R)) break; rMax = R; }
  return { reachable, width: r3(2 * rMax), sources: Object.keys(fuentes) };
}
