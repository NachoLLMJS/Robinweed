// El galpon como RECINTO. El defecto que se arregla aca es geometrico y esta medido:
// el piso del galpon existe (`legacyWarehouseBox([14,.25,16], mats.floor, [0,-.13,0])`) pero su
// tope queda en -0.005, y la calle se construye DESPUES y mas arriba -- pasto +0.030, calzada
// +0.020, cordones +0.120 -- asi que 0.875 m de pasto corren a lo largo de cada pared lateral y
// una banda de 8.4 x 1.875 m de calzada entra por el porton. Ver `streetIntrusions()`.
//
// La solucion NO recorta la calle (dejaria una zanja sin suelo de 1.2 m a lo largo de TODA la
// calle, entre el cordon en 6.0 y el pasto desde 7.2): sube el piso a tope +0.040 y tapa los
// cordones con una placa de muelle a +0.135. Las dos cosas son propiedades de runtime, asi que
// `setGalpon(0)` devuelve el juego de hoy bit a bit. Un recorte de datos no se puede deshacer en
// caliente y el preset 0 dejaria de ser el brazo de control.
import { STREET_LAYOUT } from './streetLifeState.js';
import { WAREHOUSE_GROW_STATIONS } from './warehouseExpansionState.js';
import { GROW_EMITTER } from './lightZoneState.js';
import { MATERIAL_LAW } from './materialLaw.js';

// Cara interior de las paredes, no la huella exterior: las paredes laterales estan en x +-7 con
// espesor .25, asi que el volumen que el jugador VE llega a +-6.875; frontal/trasera a +-7.875.
export const WAREHOUSE_FOOTPRINT = Object.freeze({
  minX: -7, maxX: 7, minZ: -8, maxZ: 8,
  wallThickness: .25, innerX: 6.875, innerZ: 7.875,
  // plantTopY: lo mas alto que llega una planta madura sobre una mesa. La mesa tiene el borde en
  // .832 y el GLB maduro mide 1,55, pero desde el paquete de cepas la planta ademas se escala por
  // genetica (0,90 a 1,14): la mas alta llega a .832 + 1,55 x 1,14 = 2,599. El 2,40 de antes ya no
  // era cierto y este numero es el que usan los tests del techo para saber que nada cuelga encima.
  ceilingFaceY: 4.02, plantTopY: 2.60,
});

export const FLOOR_SLAB = Object.freeze({ size: Object.freeze([14, .25, 16]), legacyY: -.13, raisedY: -.085 });
export const slabTop = y => y + FLOOR_SLAB.size[1] / 2;

// Copias literales de lo que main.js construye (L334 y L336). El test las compara contra el TEXTO
// del fuente para que no se desincronicen en silencio.
export const STREET_ROAD = Object.freeze({ size: Object.freeze([8.4, .08, 104]), position: Object.freeze([0, -.02, 58]) });
export const STREET_CURBS = Object.freeze([-5.1, 5.1].map(x => Object.freeze({
  size: Object.freeze([1.8, .16, 24.4]), position: Object.freeze([x, .04, 18.2]),
})));

const boxOf = (id, size, position) => ({
  id,
  minX: position[0] - size[0] / 2, maxX: position[0] + size[0] / 2,
  minZ: position[2] - size[2] / 2, maxZ: position[2] + size[2] / 2,
  topY: position[1] + size[1] / 2,
});

// Se recorta al VOLUMEN VISIBLE del cuarto (cara interior de las paredes), NO a la huella exterior:
// lo que queda entre 7.875 y 8 esta DENTRO del volumen de la pared frontal y no se ve desde adentro.
// Recortar a la huella hacia fallar el test de la placa por 12.5 cm que nadie puede mirar.
const clip = (box, f = WAREHOUSE_FOOTPRINT) => {
  const minX = Math.max(box.minX, -f.innerX), maxX = Math.min(box.maxX, f.innerX);
  const minZ = Math.max(box.minZ, -f.innerZ), maxZ = Math.min(box.maxZ, f.innerZ);
  return maxX > minX && maxZ > minZ ? { ...box, minX, maxX, minZ, maxZ } : null;
};

export function streetIntrusions(layout = STREET_LAYOUT) {
  const candidates = [
    ...layout.grass.map((patch, i) => boxOf(`grass-${patch.x < 0 ? 'west' : 'east'}${i > 1 ? '-north' : ''}`, [patch.width, .08, patch.depth], [patch.x, -.01, patch.z])),
    boxOf('road', STREET_ROAD.size, STREET_ROAD.position),
    ...STREET_CURBS.map(curb => boxOf(`curb-${curb.position[0] < 0 ? 'west' : 'east'}`, curb.size, curb.position)),
  ];
  return candidates.map(box => clip(box)).filter(Boolean);
}

// Placa de muelle contra el porton: tapa los dos bloques de cordon (tope .120) que la losa a .040
// no alcanza. La franja amarilla y negra es senializacion pintada: queda FUERA de la ley de color
// a proposito, como todo emisivo o senialetica.
export const DOCK_APRON = Object.freeze({
  plate: Object.freeze({ size: Object.freeze([12, .135, 1.95]), position: Object.freeze([0, .0675, 6.9]) }),
  ramp: Object.freeze({ length: 1.03, drop: .095, thickness: .03, zNear: 5.925 }),
  stripe: Object.freeze({ width: 12, depth: .18, z: 7.8, y: .137, colorA: '#c9a227', colorB: '#1a1a18' }),
});

// Caja fina girada sobre X. Rotar sobre X por theta manda el extremo +z a y = -sin(theta)*L/2:
// para que el extremo del lado del porton (+z) quede ARRIBA, theta tiene que ser NEGATIVO.
export function rampTransform(apron = DOCK_APRON) {
  const { length, drop, thickness, zNear } = apron.ramp;
  const high = apron.plate.position[1] + apron.plate.size[1] / 2;   // .135, tope de la placa
  const low = slabTop(FLOOR_SLAB.raisedY);                          // .040, tope de la losa
  return { position: [0, (high + low) / 2 - thickness / 2, zNear - length / 2], rotationX: -Math.atan2(drop, length) };
}

export function rampEndHeights(apron = DOCK_APRON) {
  const t = rampTransform(apron);
  const half = apron.ramp.length / 2;
  const yAt = dz => t.position[1] + apron.ramp.thickness / 2 - Math.sin(t.rotationX) * dz;
  return { nearDoor: yAt(half), farFromDoor: yAt(-half) };
}

// --- Superficies pintadas por canvas (cero archivos en public/) -------------------------------
// `lane*` son datos de MUNDO, no de la textura: la linea amarilla de circulacion va del porton a
// las mesas y se dibuja como una caja fina aparte (la textura del piso se repite 7x8 y una linea
// que se repite ocho veces no es una linea).
export const INDUSTRIAL_FLOOR = Object.freeze({
  size: 1024, base: '#5b5d55', joint: '#3d3f39', jointEveryMetres: 2, stain: '#4a4c43', stains: 14,
  laneColor: '#b3a24a', laneWidth: .12, laneFromZ: -1.2, laneToZ: 5.9,
  roughness: .93, metalness: .03, repeat: Object.freeze([7, 8]),
});

// Chapa de contenedor. La textura SOLO lleva la corrugacion y la mugre: se repite en los dos ejes,
// asi que la banda pintada, el zocalo y el estarcido -- que estan anclados a una altura del MUNDO --
// se construyen como geometria aparte en la Tarea 77 con estos mismos numeros.
export const WALL_SKIN = Object.freeze({
  size: Object.freeze([512, 512]), tile: Object.freeze({ metres: 2 }), ribPitch: .25,
  base: '#66716a', ribLight: '#75807a', ribShade: '#4f5a53', streak: '#5d6862',
  band: Object.freeze({ y: 1.2, height: .28, color: '#33443b' }),
  plinth: Object.freeze({ height: .42, color: '#2e3531' }),
  stencil: Object.freeze({ text: 'BAY 01', color: '#c9c2a6', x: .62, y: .55, scale: .11 }),
  roughness: .78, metalness: .18, bumpScale: .018,
});

export function wallSkinRepeat(lengthMetres, heightMetres = 4.2, skin = WALL_SKIN) {
  return [lengthMetres / skin.tile.metres, heightMetres / skin.tile.metres];
}

// --- Techo ------------------------------------------------------------------------------------
// Las cotas no son libres: la lampara de cultivo ocupa x +-.46 / y 3.06..4.04 / z +-.13 alrededor
// de cada estacion (fila trasera z -2.2, fila de expansion z +0.15). Vigas de 14 m no entran en
// 13.75 libres -> 13.6; la viga del medio en z=0 cruzaba las cuatro lamparas de la expansion ->
// z -1.1; las bandejas en x +-2.4 pasaban por el centro de dos lamparas de la fila trasera ->
// x +-3.9; y la fila de paneles traseros en z -2.3 pisaba las lamparas de (+-0.8, -2.2) -> z -3.4.
const PANEL_ROWS_Z = [-5.5, -3.4, 2.3, 5.5];
const PANEL_COLS_X = [-4.2, 0, 4.2];
const HALL_PANEL = Object.freeze({ color: 0xfff4d2, emissive: 0xffdca0, emissiveIntensity: 1.6 });
// Los cuadrados del techo son difusores: deben leerse como paneles blancos encendidos,
// no como placas azul-gris apagadas contra el techo negro.
const GROW_PANEL = Object.freeze({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4 });

// El motor no tiene luz de rebote y las unicas luces del cuarto miran hacia ABAJO desde y 3.72, asi
// que medido en GPU real el techo entero daba luma media 14 sobre 255: vigas, bandejas y conductos
// quedaban invisibles y el techo seguia siendo el plano negro del que se queja Jose. La chapa lleva
// un emisivo tenue que hace de rebote (el patron que A usa para los 12 faroles sin slot de luz) y el
// acero uno mas bajo, para que la estructura se recorte contra ella en vez de brillar sola.
export const CEILING_KIT = Object.freeze({
  deck: Object.freeze({ color: '#2b332e', ribColor: '#1d2420', ribPitch: .3, roughness: .9, metalness: .12, emissive: '#39433c', emissiveIntensity: .45 }),
  steel: Object.freeze({ color: '#6e776f', emissive: '#39433c', emissiveIntensity: .18, roughness: .7, metalness: .24 }),
  // Alma de .14 y no de .24, pegada a la chapa: con y 3.88 la viga ocupaba 3.73..4.00 y la del medio
  // (z -1.1) ATRAVESABA el extractor oeste, cuyo GLB llega a y 3.80 y ocupa z -1.725..-0.275 -- medido
  // en el runtime, no en la tabla. Entre el tope del ventilador y la cara del techo hay 220 mm y la
  // viga media 270. Ahora ocupa 3.845..4.015: pasa 45 mm por encima del ventilador y toca la chapa.
  beams: Object.freeze([{ z: -5 }, { z: -1.1 }, { z: 5 }].map(b => Object.freeze({
    ...b, size: Object.freeze([13.6, .14, .14]), y: 3.945, flange: Object.freeze([13.6, .03, .34]),
  }))),
  // Un techo real se apila: chapa y paneles arriba, vigas debajo, y bandejas y conductos COLGADOS de
  // las vigas. Con los conductos en y 3.62 (tope 3.84) y las bandejas en 3.95 los tres se cruzaban:
  // el conducto atravesaba las tres vigas (ala inferior en 3.73) y las bandejas entraban 22,5 mm en
  // los paneles nuevos de x +-4.2 (cara inferior 3.9575). Los dos cuelgan ahora bajo el ala.
  airRuns: Object.freeze([{ x: -5.6 }, { x: 5.6 }].map(r => Object.freeze({
    ...r, radius: .22, length: 15.4, y: 3.48, color: '#8d938c', emissive: '#39433c', emissiveIntensity: .18, diffusersAtZ: Object.freeze([-5.5, -1.8, 1.9, 5.6]),
  }))),
  // Largo 8.8 centrado en z -3.2 (z -7.6..1.2) y no 15.6: la bandeja lleva corriente a las DOS filas
  // de lamparas (z -2.2 y +0.15) y no tiene nada que hacer en el hall, donde ademas pasaba a 40 mm de
  // la campana de x +-4.2. El hall se lee limpio y calido; el cultivo, industrial.
  cableTrays: Object.freeze([{ x: -3.9 }, { x: 3.9 }].map(t => Object.freeze({
    ...t, size: Object.freeze([.28, .06, 8.8]), z: -3.2, y: 3.68, color: '#4c534d', emissive: '#39433c', emissiveIntensity: .18,
  }))),
  // Doce paneles: los tres de z=2.3 son los que main.js YA dibuja (no se re-crean). El hall es
  // calido, el cultivo frio y casi apagado -- ahi la luz la pone el magenta del paquete A.
  panels: Object.freeze(PANEL_ROWS_Z.flatMap(z => PANEL_COLS_X.map(x => Object.freeze({
    x, z,
    zone: z >= 2.3 ? 'hall' : 'grow',
    existing: z === 2.3,
    ...(z >= 2.3 ? HALL_PANEL : GROW_PANEL),
  })))),
  panelSize: Object.freeze([1.05, .045, .58]),
  panelY: 3.98,
  // `drop` es el diametro del cuello: con .28 el difusor quedaba flotando 8 cm bajo el conducto, como
  // una caja suelta. Con .12 el tope del difusor toca la panza del conducto y se lee colgado de el.
  diffuser: Object.freeze({ size: Object.freeze([.6, .12, .6]), drop: .12 }),
});

// Campanas industriales del hall. z = 3.4 y no 5.5: desde z 4.895 el suelo deja de ser la losa y
// pasa a ser la rampa y la placa, asi que un charco pintado a y=.046 bajo una campana en 5.5 queda
// tapado desde 4.96 -- solo 1.06 m de 3.20 visibles, y el centro, justo bajo la lampara, enterrado.
// Tampoco sirve 3.6: 3.6 + 1.4 de radio = 5.00, o sea 105 mm PASADA la rampa. 3.4 + 1.4 = 4.80 deja
// el charco entero sobre losa plana con 95 mm de margen, que es lo que Jose pidio ver.
export const CAMPANA = Object.freeze({
  positions: Object.freeze([[-4.2, 3.4], [0, 3.4], [4.2, 3.4]].map(p => Object.freeze(p))),
  hangY: 3.98,
  bell: Object.freeze({ radiusTop: .06, radiusBottom: .36, height: .30, color: '#1f3a2c', roughness: .6, metalness: .2 }),
  disc: Object.freeze({ radius: .3, color: '#ffe3b5', emissive: '#ffb86b', emissiveIntensity: 2.2 }),
  pool: Object.freeze({ radius: 1.4, rgb: Object.freeze([255, 196, 120]), peakAlpha: 255, y: .046 }),
});

// --- Presets ----------------------------------------------------------------------------------
// El 0 es el juego de hoy, bit a bit: es el brazo de control contra el que Jose compara.
export const GALPON_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', raisedFloor: false, apron: false, skins: false, ceiling: false, infra: false, pools: false, mist: false, led: false }),
  Object.freeze({ id: 1, key: 'enclosure', label: 'RECINTO', raisedFloor: true, apron: true, skins: true, ceiling: true, infra: true, pools: false, mist: false, led: false }),
  Object.freeze({ id: 2, key: 'alive', label: 'RECINTO VIVO', raisedFloor: true, apron: true, skins: true, ceiling: true, infra: true, pools: true, mist: true, led: true }),
]);

export const DEFAULT_GALPON_PRESET = 2;

export function galponPresetById(id) {
  return GALPON_PRESETS.find(preset => preset.id === id) ?? GALPON_PRESETS[DEFAULT_GALPON_PRESET];
}

export function readGalponPreset(search, fallback = DEFAULT_GALPON_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('galpon') ?? params.get('almacen');
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && GALPON_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

// --- Ley de materiales --------------------------------------------------------------------------
// Los numeros son los de MATERIAL_LAW (materialLaw.js, paquete B2/T9): una sola ley, derivada en
// una linea (M-5 de la VERIFICACION 2026-09-14). La ley aplica a `material.color`, NUNCA al
// emisivo ni a una superficie auto-iluminada: B hace lo mismo
// (`clampLawColor` solo toca material.color y el emisivo va por allow-list). Por eso las tablas de
// props separan `colors` (van a la ley) de `emissives` (no van).
export const MATERIAL_LIMITS = Object.freeze({ roughnessMin: MATERIAL_LAW.roughnessMin, metalnessMax: MATERIAL_LAW.metalnessMax, saturationMax: MATERIAL_LAW.saturationMax, lightnessMin: MATERIAL_LAW.lightnessMin, lightnessMax: MATERIAL_LAW.lightnessMax });

export function hexWithinLimits(hex, limits = MATERIAL_LIMITS) {
  const value = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255, g = ((value >> 8) & 255) / 255, b = (value & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : (lightness > .5 ? delta / (2 - max - min) : delta / (max + min));
  const ok = saturation <= limits.saturationMax && lightness >= limits.lightnessMin && lightness <= limits.lightnessMax;
  return { ok, saturation, lightness };
}

// --- Pintores deterministas ---------------------------------------------------------------------
// No LEEN nada del contexto (ni getImageData ni measureText): asi funcionan igual con un canvas real
// y con el doble de prueba del test. El azar sale de un LCG con semilla fija, para que dos cargas
// den la misma textura.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function paintIndustrialFloor(ctx, spec = INDUSTRIAL_FLOOR) {
  const size = spec.size;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, size, size);
  // Junta de dilatacion en dos bordes del tile: al repetir queda una retícula cada 2 m.
  const jointPx = Math.max(2, Math.round(size / 340));
  ctx.fillStyle = spec.joint;
  ctx.fillRect(0, 0, size, jointPx);
  ctx.fillStyle = spec.joint;
  ctx.fillRect(0, 0, jointPx, size);
  const random = seededRandom(1234);
  for (let i = 0; i < spec.stains; i++) {
    const x = random() * size, y = random() * size;
    const w = size * (.05 + random() * .16), h = size * (.04 + random() * .12);
    ctx.fillStyle = spec.stain;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  return ctx;
}

export function paintWallSkin(ctx, spec = WALL_SKIN) {
  const [width, height] = spec.size;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, width, height);
  // Una ranura por paso: la textura cubre `tile.metres` de pared, asi que hay metres/ribPitch ranuras.
  const ribs = Math.round(spec.tile.metres / spec.ribPitch);
  const ribWidth = width / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * ribWidth;
    ctx.fillStyle = spec.ribLight;
    ctx.fillRect(Math.round(x), 0, Math.round(ribWidth / 2), height);
    ctx.fillStyle = spec.ribShade;
    ctx.fillRect(Math.round(x + ribWidth / 2), 0, Math.round(ribWidth / 2), height);
  }
  // Mugre que CORRE por la corrugacion, no manchas sueltas: la textura se repite 8 x 2.1 veces en una
  // pared de 16 m, asi que ocho manchas cuadradas se leen como 130 calcomanias iguales. Una chorreadura
  // que baja por una ranura se lee como suciedad aunque se repita, porque sigue el ritmo de la chapa.
  const random = seededRandom(4321);
  ctx.fillStyle = spec.streak;
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * ribs) * ribWidth + ribWidth * .28;
    const top = Math.round(random() * height * .45);
    ctx.fillRect(Math.round(x), top, Math.max(2, Math.round(ribWidth * .18)), height - top);
  }
  return ctx;
}

// --- Cajas para el gate de colisiones -----------------------------------------------------------
// Una caja por estacion que envuelve la lampara Y su riel de suspension. Es la envolvente de lo que
// construye main.js (emisor 3.045..3.075, cables x+-.38 hasta 4.01, riel box([.9,.06,.12]) en 4.01):
// no es un GLB. El half-ancho y el half-fondo salen de GROW_EMITTER para que sigan a la lampara real.
const GROW_RAIL_TOP = 4.04;

export function growFixtureBoxes(stations = WAREHOUSE_GROW_STATIONS, emitter = GROW_EMITTER) {
  return stations.map((station, index) => ({
    id: `fixture-${index}`,
    minX: station.x - emitter.halfWidth, maxX: station.x + emitter.halfWidth,
    minY: emitter.y, maxY: GROW_RAIL_TOP,
    minZ: station.z - emitter.halfDepth, maxZ: station.z + emitter.halfDepth,
  }));
}

// Mide TODO lo que cuelga, no solo lo de la Tarea 77: sin las campanas aca, el gate no podia ver que
// la de x +-4.2 pasaba a 40 mm de la bandeja de cables.
export function ceilingItemBoxes(kit = CEILING_KIT, campana = CAMPANA) {
  const boxes = [];
  kit.beams.forEach((beam, index) => {
    const halfDepth = Math.max(beam.size[2], beam.flange[2]) / 2;
    boxes.push({
      id: `beam-${index}`,
      minX: -beam.size[0] / 2, maxX: beam.size[0] / 2,
      minY: beam.y - beam.size[1] / 2 - beam.flange[1], maxY: beam.y + beam.size[1] / 2,
      minZ: beam.z - halfDepth, maxZ: beam.z + halfDepth,
    });
  });
  kit.airRuns.forEach((run, index) => {
    boxes.push({
      id: `air-run-${index}`,
      minX: run.x - run.radius, maxX: run.x + run.radius,
      minY: run.y - run.radius, maxY: run.y + run.radius,
      minZ: -run.length / 2, maxZ: run.length / 2,
    });
    run.diffusersAtZ.forEach((z, j) => {
      const centreY = run.y - run.radius - kit.diffuser.drop / 2;
      boxes.push({
        id: `diffuser-${index}-${j}`,
        minX: run.x - kit.diffuser.size[0] / 2, maxX: run.x + kit.diffuser.size[0] / 2,
        minY: centreY - kit.diffuser.size[1] / 2, maxY: centreY + kit.diffuser.size[1] / 2,
        minZ: z - kit.diffuser.size[2] / 2, maxZ: z + kit.diffuser.size[2] / 2,
      });
    });
  });
  kit.cableTrays.forEach((tray, index) => {
    boxes.push({
      id: `tray-${index}`,
      minX: tray.x - tray.size[0] / 2, maxX: tray.x + tray.size[0] / 2,
      minY: tray.y - tray.size[1] / 2, maxY: tray.y + tray.size[1] / 2,
      minZ: tray.z - tray.size[2] / 2, maxZ: tray.z + tray.size[2] / 2,
    });
  });
  kit.panels.filter(panel => !panel.existing).forEach(panel => {
    boxes.push({
      id: `panel-${panel.x}:${panel.z}`,
      minX: panel.x - kit.panelSize[0] / 2, maxX: panel.x + kit.panelSize[0] / 2,
      minY: kit.panelY - kit.panelSize[1] / 2, maxY: kit.panelY + kit.panelSize[1] / 2,
      minZ: panel.z - kit.panelSize[2] / 2, maxZ: panel.z + kit.panelSize[2] / 2,
    });
  });
  // La campana se mide por su AABB (el radio de abajo), no por el radio real a cada altura: un cono
  // que "casi" no toca una bandeja igual se lee como que la atraviesa desde la camara de juego.
  campana.positions.forEach(([x, z], index) => {
    boxes.push({
      id: `campana-${index}`,
      minX: x - campana.bell.radiusBottom, maxX: x + campana.bell.radiusBottom,
      minY: campana.hangY - campana.bell.height, maxY: campana.hangY,
      minZ: z - campana.bell.radiusBottom, maxZ: z + campana.bell.radiusBottom,
    });
  });
  return boxes;
}

// --- Agua, aire y latido (preset 2) ----------------------------------------------------------------
// La niebla de riego vive 2,5 s de cada 9 (duty 27,8 %): suficiente para que el cuarto se lea vivo,
// poco para que canse. Fuera del puff `mistPhase` devuelve null y `stepMist` corta sin tocar el buffer.
export const MIST = Object.freeze({ count: 260, periodMs: 9000, puffMs: 2500, rise: .9, spread: .45, size: .075, opacity: .3 });

export function mistPhase(nowMs, spec = MIST) {
  const t = ((nowMs % spec.periodMs) + spec.periodMs) % spec.periodMs;
  return t < spec.puffMs ? t / spec.puffMs : null;
}

// Azar determinista por indice (no Math.random): dos cargas dan la misma nube y el test puede medirla.
const drop01 = (index, salt) => {
  const v = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function mistPoint(index, phase, rail, spec = MIST) {
  const a = drop01(index, 1), b = drop01(index, 2), c = drop01(index, 3);
  // cada gota entra en el puff en un momento distinto, o la niebla sube como un bloque
  const local = (phase + a) % 1;
  return {
    x: rail.x0 + a * (rail.x1 - rail.x0),
    y: rail.y + local * spec.rise,
    z: rail.z + (b * 2 - 1) * spec.spread * (.4 + .6 * c),
  };
}

export function campanaPoolMatrices(spec = CAMPANA) {
  return spec.positions.map(([x, z], index) => ({ id: `pool-${index}`, x, y: spec.pool.y, z }));
}

// El LED del controlador late en una banda que el ojo lee como "vivo", no como un estrobo.
export const LED_PULSE = Object.freeze({ base: 1.9, amplitude: .7, periodMs: 2400 });

export function ledPulse(nowMs, spec = LED_PULSE) {
  return spec.base + spec.amplitude * Math.sin(2 * Math.PI * nowMs / spec.periodMs);
}
