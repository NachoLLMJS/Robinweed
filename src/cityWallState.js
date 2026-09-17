// The 13 runs below are the faces of CITY_PERIMETER the player can walk up to: 365 linear units.
//
// A panel is a BoxGeometry(length, height, thickness): its long side lies on X and its normal is +Z at
// rotationY = 0. rotationY here always points the normal AT THE FORBIDDEN SIDE, so tests/cityWall.test.js can
// verify the orientation of all 99 panels on its own instead of trusting a screenshot.
export const WALL_STYLE = Object.freeze({
  plank: Object.freeze({ length: 4, height: 1.9, thickness: 0.14, post: 0.16, color: 0x6b5b45, roughness: 0.92 }),
  brick: Object.freeze({ length: 4, height: 2.2, thickness: 0.3, post: 0, color: 0x5a534b, roughness: 0.96 }),
  hoarding: Object.freeze({ length: 4, height: 2.4, thickness: 0.1, post: 0, color: 0x2f4f3a, roughness: 0.88 }),
});

// yaw whose normal (sin, cos) points at the named world direction
const FACE_N = 0, FACE_E = Math.PI / 2, FACE_S = Math.PI, FACE_W = -Math.PI / 2;
const run = (id, style, axis, at, from, to, rotationY) =>
  Object.freeze({ id, style, axis, at, from, to, rotationY });

export const WALL_RUNS = Object.freeze([
  // avenue, south of the intersection -- the forbidden side is always the LOWER z / the OUTER x
  run('avenue-west-south', 'plank', 'z', -15.5, 18.1, 19.5, FACE_W),
  run('backlot-sw-front', 'plank', 'x', 19.5, -52, -15.5, FACE_S),
  run('pocket-sw-front', 'plank', 'x', 18.1, -15.5, -10.6, FACE_S),
  run('backlot-se-front', 'plank', 'x', 19.5, 15.5, 52, FACE_S),
  run('pocket-se-east', 'plank', 'z', 15.5, 19.5, 22, FACE_W),
  run('pocket-se-front', 'plank', 'x', 22, 12.45, 15.5, FACE_S),
  // avenue, north of the intersection
  run('avenue-west-north', 'plank', 'z', -15.5, 51, 107.6, FACE_W),
  run('backlot-nw-front', 'plank', 'x', 51, -52, -15.5, FACE_N),
  run('avenue-east-north', 'plank', 'z', 15.5, 51, 107.6, FACE_E),
  run('backlot-ne-front', 'plank', 'x', 51, 15.5, 52, FACE_N),
  // the two ends of the cross street and the far end of the avenue
  run('cap-west', 'brick', 'z', -52.4, 19.5, 51, FACE_W),
  run('cap-east', 'brick', 'z', 52.4, 19.5, 51, FACE_E),
  run('dead-end-north', 'hoarding', 'x', 107.6, -15.5, 15.5, FACE_N),
]);

function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
// FNV-1a casi no mueve los bits BAJOS cuando dos salts difieren solo en el ultimo caracter, y el
// `& 0xffff` original se quedaba justo con esos. Medido: el rango de cinco valores consecutivos era
// 0,037 donde cinco uniformes dan ~0,67 -- 18 veces comprimido. Sobre un rango autorado de 26 m de
// altura, cada tramo usaba ~1 m: `cap-east` eran ocho cajas de 30,1 +-0,6 m y 7,5 m de ancho, o sea
// UNA losa de 30 m. Las 46 siluetas no eran 46: eran 8 losas. Por eso el anillo del domo se lee como
// skyline y esto se leia como pared -- el domo usa un LCG con estado (horizonState.js), no un hash
// por indice. La avalancha final (murmur3 fmix32) arregla los bits bajos sin cambiar la interfaz.
const unit = (seed, salt) => {
  let hash = hash32(`${seed}#${salt}`);
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
};

export function wallPanels(options = {}) {
  const { seed = 'stockdealer', sagBudget = 0.035 } = options;
  const panels = [];
  for (const spec of WALL_RUNS) {
    const style = WALL_STYLE[spec.style];
    const span = spec.to - spec.from;
    const count = Math.ceil(span / style.length);
    // the last panel overlaps INWARD instead of sticking out: no gap and nothing hanging over walkable ground
    const step = count > 1 ? (span - style.length) / (count - 1) : 0;
    const lengthScale = count > 1 ? 1 : span / style.length;
    for (let index = 0; index < count; index++) {
      const along = spec.from + (style.length * lengthScale) / 2 + step * index;
      const sag = (unit(seed, `${spec.id}:${index}`) * 2 - 1) * sagBudget;
      panels.push(Object.freeze({
        run: spec.id,
        style: spec.style,
        index,
        x: spec.axis === 'x' ? along : spec.at,
        z: spec.axis === 'x' ? spec.at : along,
        rotationY: spec.rotationY + sag,
        lengthScale,
        height: style.height,
      }));
    }
  }
  return panels;
}

// Silhouettes: dark boxes standing 8 to 22 metres beyond the wall, over the grass patches that already exist
// (they reach |x| = 106 and z = -50..110.5), so nothing new has to be added to the ground.
// Un tramo corto NO lleva silueta. Con la version del paquete, `avenue-west-south` (1,4 m de largo) y
// `pocket-se-east` (2,5 m) ponian su silueta 8 a 22 m detras de la pared, y detras de esas dos paredes no
// hay 8 m de nada: hay la calle transversal y la avenida. Las dos silueas terminaban PLANTADAS EN LA CALLE
// (x -34,11 z 19,92 y x 4,14 z 22,09), medido. Los tramos de menos de MIN_SKYLINE_RUN son remiendos entre
// edificios y no tienen fondo detras.
const MIN_SKYLINE_RUN = 8;
// Cuanto tiene que despegar la cara mas cercana de la silueta respecto de la linea del muro. El
// panel mas grueso mide 0,3 (brick), asi que 0,75 deja 0,6 libres entre la caja y la cara del muro.
const FOOTPRINT_CLEARANCE = 0.75;
const carriesSkyline = spec => spec.style !== 'hoarding' && spec.to - spec.from >= MIN_SKYLINE_RUN;

export function skylineBlocks(options = {}) {
  const { seed = 'stockdealer', count = 48, minSetback = 8, maxSetback = 22 } = options;
  const total = WALL_RUNS.reduce((sum, spec) => sum + (carriesSkyline(spec) ? spec.to - spec.from : 0), 0);
  const blocks = [];
  for (const spec of WALL_RUNS) {
    if (!carriesSkyline(spec)) continue;   // el fondo norte es una obra, no un skyline; los remiendos no tienen fondo
    const span = spec.to - spec.from;
    const share = Math.max(1, Math.round(count * span / total));
    for (let index = 0; index < share; index++) {
      const width = 5 + unit(seed, `w:${spec.id}:${index}`) * 9;
      const depth = 5 + unit(seed, `d:${spec.id}:${index}`) * 9;
      const rotationY = (unit(seed, `r:${spec.id}:${index}`) * 2 - 1) * 0.35;
      // El retiro y el jitter se median al CENTRO, y una caja de hasta 14 m puede tener el centro
      // afuera y una esquina adentro: medido, dos de las 46 metian esquina en la cuadra caminable
      // (x 27,39 z 49,92 sobre la calle transversal y x 11,33 z 64,61 sobre la avenida). El test de
      // J68 no lo veia porque solo mira el centro. Se recorta la HUELLA entera, en los dos ejes:
      // `reach` es cuanto sobresale hacia el muro y `flank` cuanto sobresale por las puntas del tramo.
      const turn = rotationY - spec.rotationY;
      const reach = (width / 2) * Math.abs(Math.sin(turn)) + (depth / 2) * Math.abs(Math.cos(turn));
      const flank = (width / 2) * Math.abs(Math.cos(turn)) + (depth / 2) * Math.abs(Math.sin(turn));
      // el jitter se recorta al propio tramo: sin esto una silueta se escapa por la punta del tramo
      // y aparece del lado caminable aunque el tramo sea largo
      const wanted = spec.from + span * ((index + 0.5) / share)
        + (unit(seed, `sky:${spec.id}:${index}`) * 2 - 1) * 3;
      const room = Math.max(0, (span - 2 * (flank + FOOTPRINT_CLEARANCE)) / 2);
      const middle = (spec.from + spec.to) / 2;
      const along = Math.min(middle + room, Math.max(middle - room, wanted));
      const setback = Math.max(
        minSetback + unit(seed, `set:${spec.id}:${index}`) * (maxSetback - minSetback),
        reach + FOOTPRINT_CLEARANCE);
      blocks.push(Object.freeze({
        run: spec.id,
        index,
        x: (spec.axis === 'x' ? along : spec.at) + Math.sin(spec.rotationY) * setback,
        z: (spec.axis === 'x' ? spec.at : along) + Math.cos(spec.rotationY) * setback,
        width,
        depth,
        height: 6 + unit(seed, `h:${spec.id}:${index}`) * 26,
        rotationY,
      }));
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// Que el limite SE VEA. Medido en esta rama con Chrome real + GPU (ANGLE NVIDIA D3D11, 1320x840,
// preset de luz 2 "NOCHE CERRADA", que es el default), con la mascara que sale de apagar las
// mallas y diferir los dos frames: el hoarding del fondo norte ocupa el 38,2 % del cuadro con
// luma mediana 2,9 y el 56,1 % de sus pixeles en <= 4, y las siluetas llegan al 49,9 % del cuadro
// con mediana 5,8. Es una masa negra, no un limite.
//
// La causa no es el albedo. La luna vive en azimut 145 / elevacion 38,8 (moonShadowState.js), asi
// que seis de los trece tramos miran al lado contrario y su cara visible recibe SOLO hemisferica
// (peso 0,5 en una cara vertical) + ambiente. Ese valor cae debajo del "toe" de
// ACESFilmicToneMapping y sale rgb 0,0,0 literal: con el albedo 3,5 veces mas claro la cara
// seguia midiendo luma 1. Tampoco la salva la distancia -- a 60 m la niebla aporta el 43 % y la
// cara sigue en luma 13,3. El unico lever sin sumar una PointLight (y el test de arriba la
// prohibe) es `emissive`, que se suma DESPUES del albedo. Es el mismo arreglo que levanto el
// techo del galpon (warehouseShellState.js, CEILING_KIT.deck) y la ley de materiales no lo
// alcanza a proposito: la ley es de `material.color` (warehouseShellState.js:201).
//
// Un emisivo plano, solo, deja una losa lisa ocupando el 38 % del cuadro. Por eso el lift viaja
// en un `emissiveMap` que es la MISMA textura pintada del muro: el rebote sigue los tablones, las
// juntas y el zocalo en vez de aplanarlos.
//
// Los tres presets son la perilla que pide el plan maestro: 0 es el juego de hoy bit a bit.
export const WALL_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', skin: false, lift: false, haze: false, windows: false }),
  Object.freeze({ id: 1, key: 'legible', label: 'LEGIBLE', skin: true, lift: true, haze: true, windows: false }),
  Object.freeze({ id: 2, key: 'city', label: 'CIUDAD', skin: true, lift: true, haze: true, windows: true }),
]);

export const DEFAULT_WALL_PRESET = 2;

export function wallPresetById(id) {
  return WALL_PRESETS.find(preset => preset.id === id) ?? WALL_PRESETS[DEFAULT_WALL_PRESET];
}

export function readWallPreset(search, fallback = DEFAULT_WALL_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('muro') ?? params.get('medianera');
  // `?muro=` sin valor devuelve '' y Number('') es 0: sin este chequeo un signo igual de mas
  // seleccionaba el brazo de CONTROL en silencio. readLightingPreset ya lo contempla; readGalponPreset no.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && WALL_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

// Una textura por estilo. `tile.metresX` es cuantos metros de muro cubre el canvas: el panel mide
// 4 m, asi que con 4 la textura NO se repite dentro de un panel y los tablones miden lo que dicen.
export const WALL_SKINS = Object.freeze({
  plank: Object.freeze({
    size: Object.freeze([512, 256]), tile: Object.freeze({ metresX: 4, metresY: 1.9 }),
    base: '#6b5b45', boards: 9, boardLight: '#79674f', boardDark: '#5f5140', groove: '#4d4235',
    rails: Object.freeze([0.32, 0.72]), railColor: '#5b4d3c', railHeight: 0.035,
    plinth: Object.freeze({ height: 0.11, color: '#463a2c' }),
    cap: Object.freeze({ height: 0.05, color: '#8a7659' }),
    knots: 5, knotColor: '#54483a',
    emissive: '#45403a', emissiveIntensity: 0.62, roughness: 0.92, metalness: 0, bumpScale: 0.014,
  }),
  brick: Object.freeze({
    size: Object.freeze([512, 288]), tile: Object.freeze({ metresX: 4, metresY: 2.2 }),
    base: '#5a534b', courses: 9, blockLight: '#5c554c', blockDark: '#45403a', mortar: '#575249',
    plinth: Object.freeze({ height: 0.09, color: '#35312c' }),
    cap: Object.freeze({ height: 0.045, color: '#666058' }),
    stains: 14, stainColor: '#413c35',
    emissive: '#414548', emissiveIntensity: 0.44, roughness: 0.96, metalness: 0, bumpScale: 0.01,
  }),
  hoarding: Object.freeze({
    size: Object.freeze([512, 320]), tile: Object.freeze({ metresX: 4, metresY: 2.4 }),
    base: '#2f4f3a', sheets: 4, sheetLight: '#375c44', sheetDark: '#28442f', seam: '#1d3324',
    band: Object.freeze({ y: 0.46, height: 0.14, color: '#c7c2ad' }),
    hazard: Object.freeze({ height: 0.1, color: '#b8a14e', stripes: 16, dark: '#24382a' }),
    // chico y al margen: a 4 m de paso, un estarcido centrado aparecia TRES veces en un mismo cuadro
    stencil: Object.freeze({ text: 'SITE 07', color: '#365a41', x: 0.035, y: 0.75, scale: 0.045 }),
    emissive: '#3b4a42', emissiveIntensity: 0.53, roughness: 0.88, metalness: 0, bumpScale: 0.008,
  }),
});

// El `emissiveMap` NO puede ser la misma textura del albedo. three lo decodifica de sRGB y lo
// multiplica por el emisivo, y el albedo de un muro nocturno vive en 0,10 lineal: el primer intento
// uso el mismo canvas y midio mediana 5,6 en el fondo norte, ocho veces por debajo del objetivo.
// El mapa de rebote es la MISMA estructura con paleta clara: el rebote del cielo pega fuerte arriba,
// se apaga en las ranuras y muere en el zocalo. main.js normaliza la intensidad por la media medida
// del canvas, asi que `emissiveIntensity` sigue siendo el numero fisico que se resolvio.
function liftPalette(skin, colours) {
  const lift = { ...skin, ...colours };
  if (skin.plinth) lift.plinth = Object.freeze({ ...skin.plinth, color: colours.plinthColor ?? skin.plinth.color });
  if (skin.cap) lift.cap = Object.freeze({ ...skin.cap, color: colours.capColor ?? skin.cap.color });
  if (skin.band) lift.band = Object.freeze({ ...skin.band, color: colours.bandColor ?? skin.band.color });
  if (skin.hazard) lift.hazard = Object.freeze({ ...skin.hazard, color: colours.hazardColor ?? skin.hazard.color, dark: colours.hazardDark ?? skin.hazard.dark });
  if (skin.stencil) lift.stencil = Object.freeze({ ...skin.stencil, color: colours.stencilColor ?? skin.stencil.color });
  return Object.freeze(lift);
}

export const WALL_LIFT_SKINS = Object.freeze({
  plank: liftPalette(WALL_SKINS.plank, {
    base: '#c6c6c6', boardLight: '#d6d6d6', boardDark: '#b6b6b6', groove: '#9c9c9c',
    railColor: '#b0b0b0', knotColor: '#c6c6c6', plinthColor: '#6a6a6a', capColor: '#f0f0f0',
  }),
  brick: liftPalette(WALL_SKINS.brick, {
    mortar: '#c4c4c4', blockLight: '#dcdcdc', blockDark: '#a4a4a4', stainColor: '#8c8c8c',
    plinthColor: '#565656', capColor: '#d0d0d0',
  }),
  hoarding: liftPalette(WALL_SKINS.hoarding, {
    base: '#bdbdbd', sheetLight: '#e4e4e4', sheetDark: '#9d9d9d', seam: '#3d3d3d',
    bandColor: '#ffffff', hazardColor: '#d8d8d8', hazardDark: '#4c4c4c', stencilColor: '#5a5a5a',
    plinthColor: '#4a4a4a',
  }),
});

// Cuantas veces se repite la textura en un panel de `lengthMetres`. El alto es 1: el canvas cubre
// el panel entero, asi que el zocalo esta al pie y la tapa arriba, una sola vez.
export function wallSkinRepeat(lengthMetres, skin) {
  return [lengthMetres / skin.tile.metresX, 1];
}

// LCG con semilla fija: dos cargas pintan la misma textura, y el doble de prueba ve la misma
// secuencia de llamadas. Ningun pintor LEE del contexto (ni getImageData ni measureText).
function skinRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function paintPartyWall(ctx, spec = WALL_SKINS.plank) {
  const [width, height] = spec.size;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, width, height);
  const random = skinRandom(80517);
  const boardWidth = width / spec.boards;
  const grooveWidth = Math.max(1, Math.round(boardWidth * 0.07));
  for (let i = 0; i < spec.boards; i++) {
    const x = Math.round(i * boardWidth);
    // el tablon alterna claro/oscuro y un tercio queda a tono base: sin esa variacion el muro se
    // lee como una chapa lisa y no como madera
    const pick = random();
    ctx.fillStyle = pick < 0.38 ? spec.boardLight : pick < 0.72 ? spec.boardDark : spec.base;
    ctx.fillRect(x, 0, Math.round(boardWidth) - grooveWidth, height);
    ctx.fillStyle = spec.groove;
    ctx.fillRect(x + Math.round(boardWidth) - grooveWidth, 0, grooveWidth, height);
  }
  // los dos travesanos: la sombra que deja el larguero contra el tablon
  ctx.fillStyle = spec.railColor;
  for (const at of spec.rails) {
    ctx.fillRect(0, Math.round(height * (1 - at)), width, Math.max(1, Math.round(height * spec.railHeight)));
  }
  ctx.fillStyle = spec.knotColor;
  for (let i = 0; i < spec.knots; i++) {
    const x = Math.round(random() * width), y = Math.round(height * 0.2 + random() * height * 0.6);
    const r = Math.max(2, Math.round(boardWidth * (0.16 + random() * 0.14)));
    ctx.fillRect(x, y, r, r);
  }
  ctx.fillStyle = spec.plinth.color;
  ctx.fillRect(0, Math.round(height * (1 - spec.plinth.height)), width, Math.ceil(height * spec.plinth.height));
  ctx.fillStyle = spec.cap.color;
  ctx.fillRect(0, 0, width, Math.max(1, Math.round(height * spec.cap.height)));
}

export function paintSiteWall(ctx, spec = WALL_SKINS.brick) {
  const [width, height] = spec.size;
  ctx.fillStyle = spec.mortar;
  ctx.fillRect(0, 0, width, height);
  const random = skinRandom(31337);
  const courseHeight = height / spec.courses;
  const joint = Math.max(1, Math.round(courseHeight * 0.09));
  for (let row = 0; row < spec.courses; row++) {
    const y = Math.round(row * courseHeight);
    // hilada trabada: sin el corrimiento de media pieza el muro se lee como una grilla, no como obra
    const offset = row % 2 === 0 ? 0 : -width / 8;
    for (let col = -1; col < 5; col++) {
      const x = Math.round(offset + col * (width / 4));
      ctx.fillStyle = random() < 0.5 ? spec.blockLight : spec.blockDark;
      ctx.fillRect(x, y, Math.round(width / 4) - joint, Math.round(courseHeight) - joint);
    }
  }
  ctx.fillStyle = spec.stainColor;
  for (let i = 0; i < spec.stains; i++) {
    const x = Math.round(random() * width), y = Math.round(random() * height * 0.85);
    ctx.fillRect(x, y, Math.round(width * (0.03 + random() * 0.09)), Math.round(height * (0.02 + random() * 0.06)));
  }
  ctx.fillStyle = spec.plinth.color;
  ctx.fillRect(0, Math.round(height * (1 - spec.plinth.height)), width, Math.ceil(height * spec.plinth.height));
  ctx.fillStyle = spec.cap.color;
  ctx.fillRect(0, 0, width, Math.max(1, Math.round(height * spec.cap.height)));
}

export function paintHoarding(ctx, spec = WALL_SKINS.hoarding) {
  const [width, height] = spec.size;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, width, height);
  const random = skinRandom(9091);
  const sheetWidth = width / spec.sheets;
  const seamWidth = Math.max(2, Math.round(sheetWidth * 0.03));
  for (let i = 0; i < spec.sheets; i++) {
    const x = Math.round(i * sheetWidth);
    ctx.fillStyle = random() < 0.5 ? spec.sheetLight : spec.sheetDark;
    ctx.fillRect(x, 0, Math.round(sheetWidth) - seamWidth, height);
    ctx.fillStyle = spec.seam;
    ctx.fillRect(x + Math.round(sheetWidth) - seamWidth, 0, seamWidth, height);
  }
  ctx.fillStyle = spec.band.color;
  ctx.fillRect(0, Math.round(height * (1 - spec.band.y - spec.band.height)), width, Math.round(height * spec.band.height));
  // galibo a rayas al pie: es lo que hace que se lea "valla de obra" y no "pared verde"
  const stripeWidth = width / spec.hazard.stripes;
  const hazardY = Math.round(height * (1 - spec.hazard.height));
  const hazardHeight = Math.ceil(height * spec.hazard.height);
  for (let i = 0; i < spec.hazard.stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? spec.hazard.color : spec.hazard.dark;
    ctx.fillRect(Math.round(i * stripeWidth), hazardY, Math.ceil(stripeWidth), hazardHeight);
  }
  ctx.fillStyle = spec.stencil.color;
  ctx.font = String(Math.round(height * spec.stencil.scale)) + 'px monospace';
  ctx.fillText(spec.stencil.text, Math.round(width * spec.stencil.x), Math.round(height * spec.stencil.y));
}

// --- Las siluetas -------------------------------------------------------------------------------
// A 8-22 m del muro, una caja sin luz es negro puro: la niebla aporta el 1,0 % a 8 m y el 7,3 % a
// 22 m. Alejarlas no alcanza (a 60 m siguen en luma 13,3), asi que el lift tambien aca es emisivo,
// calibrado para que queden POR DEBAJO del muro (mas lejos = mas apagado) y la profundidad se lea.
export const SKYLINE_KIT = Object.freeze({
  color: 0x1d2430, roughness: 1, metalness: 0,
  // Una silueta se lee por CONTRASTE contra lo que tapa, no por su luma absoluta. Con 0,30 la cara
  // que mira a la luna salia en 30,1 sobre un cielo de 26,8: contraste 1,8 y el edificio desaparecia
  // -- medido en la tapa este. Con 0,20 la cara sin luna queda en 13,4 y la iluminada en 18,8 contra
  // un cielo de 26 a 37: contraste 8 a 24 en todas las poses, y ni un pixel en negro puro.
  emissive: '#39434f', emissiveIntensity: 0.2,
  // Una ventana es un plano chico con MeshBasicMaterial: no participa de la iluminacion, asi que su
  // color ES su radiancia, y `instanceColor` (que multiplica el difuso) da la variacion por ventana
  // sin costar un draw call mas. Un emisivo instanciado no podria variar: `emissive` es del material.
  windows: Object.freeze({
    size: Object.freeze([0.62, 0.92]), offset: 0.08,
    pitchX: 2.4, pitchY: 3.4, marginX: 1.2, sillY: 2.6, maxCols: 4, maxRows: 7,
    // Sin `sillJitter` todos los edificios arrancan su primera fila a la misma altura y la grilla
    // sigue derecho a traves de la junta entre dos torres: se lee como una planilla, no como una
    // ciudad. Con `darkShare`, uno de cada cinco edificios queda entero apagado.
    sillJitter: 2.1, litShare: 0.34, darkShare: 0.2,
    warm: Object.freeze([1, 0.76, 0.45]), cool: Object.freeze([0.66, 0.79, 1]), coolShare: 0.28,
    dim: Object.freeze([0.02, 0.025, 0.035]), gain: Object.freeze([0.45, 1]),
  }),
});

// Las cuatro caras verticales de una caja rotada `rotationY`: la que mejor mira a `towards` es la
// que ve el jugador. Las siluetas de J68 se rotan alrededor de Y sin mirar a su tramo, asi que en
// los tramos este/oeste la cara visible es la del LADO CORTO: elegirla a ojo pondria las ventanas
// en el canto.
function facingSide(block, towardsX, towardsZ) {
  const sides = [
    { angle: block.rotationY, span: block.width, depth: block.depth },
    { angle: block.rotationY + Math.PI / 2, span: block.depth, depth: block.width },
    { angle: block.rotationY + Math.PI, span: block.width, depth: block.depth },
    { angle: block.rotationY - Math.PI / 2, span: block.depth, depth: block.width },
  ];
  let best = sides[0], bestDot = -Infinity;
  for (const side of sides) {
    const dot = Math.sin(side.angle) * towardsX + Math.cos(side.angle) * towardsZ;
    if (dot > bestDot) { bestDot = dot; best = side; }
  }
  return best;
}

export function skylineWindows(options = {}) {
  const { seed = 'stockdealer', kit = SKYLINE_KIT.windows, blocks = skylineBlocks(options) } = options;
  const runById = new Map(WALL_RUNS.map(spec => [spec.id, spec]));
  const windows = [];
  for (const block of blocks) {
    const spec = runById.get(block.run);
    if (!spec) continue;
    // el jugador esta del lado OPUESTO al que mira la normal del tramo
    const towardsX = -Math.sin(spec.rotationY), towardsZ = -Math.cos(spec.rotationY);
    const side = facingSide(block, towardsX, towardsZ);
    const sill = kit.sillY + unit(seed, `sill:${block.run}:${block.index}`) * kit.sillJitter;
    const dark = unit(seed, `dark:${block.run}:${block.index}`) < kit.darkShare;
    const cols = Math.max(1, Math.min(kit.maxCols, Math.floor((side.span - 2 * kit.marginX) / kit.pitchX) + 1));
    const rows = Math.max(1, Math.min(kit.maxRows, Math.floor((block.height - sill - 1) / kit.pitchY) + 1));
    const reach = side.depth / 2 + kit.offset;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const along = (col - (cols - 1) / 2) * kit.pitchX;
        const salt = `${block.run}:${block.index}:${row}:${col}`;
        const roll = unit(seed, `win:${salt}`);
        const lit = !dark && roll < kit.litShare;
        const tint = lit && unit(seed, `cool:${salt}`) < kit.coolShare ? kit.cool : kit.warm;
        const gain = kit.gain[0] + unit(seed, `gain:${salt}`) * (kit.gain[1] - kit.gain[0]);
        windows.push(Object.freeze({
          run: block.run, block: block.index, row, col,
          x: block.x + Math.sin(side.angle) * reach + Math.cos(side.angle) * along,
          y: sill + row * kit.pitchY,
          z: block.z + Math.cos(side.angle) * reach - Math.sin(side.angle) * along,
          rotationY: side.angle,
          color: lit ? Object.freeze(tint.map(channel => channel * gain)) : kit.dim,
          lit,
        }));
      }
    }
  }
  return windows;
}
