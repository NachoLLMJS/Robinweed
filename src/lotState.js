// El lote: la unidad que hace que una manzana se lea construida. Todo lo de aca sale de HUELLAS MEDIDAS,
// no de las cajas declaradas de STREET_LAYOUT, que son un TOPE y no la huella (hasta 2,8 veces mas grandes).
//
//   Medido el 2026-09-11 con: node scripts/measure-house-footprints.mjs
//   three 0.185.1, replicando el fit del runtime (uno por set, desde placements[0] y con SU rotationY).
//
// Tres edificios no pasan por el fit y se escalan solo por altura -- `fitted: false`.
export const HOUSE_FOOTPRINTS = Object.freeze([
  fp('HOME-019', 'simpleHouseF', -46, 42.4, -49.25, -42.75, 39.15, 45.65, 3.493, 'cross', 'north', true),
  fp('cityPackDiner@-37/42.4', 'cityPackDiner', -37, 42.4, -40.416, -33.584, 38.65, 46.15, 3.924, 'cross', 'north', true),
  fp('HOME-025', 'infillHouse1', -28.5, 42.4, -31.75, -25.25, 40.201, 44.599, 4.197, 'cross', 'north', true),
  fp('HOME-020', 'simpleHouseG', -20, 42.6, -23.275, -16.725, 39.325, 45.875, 6.546, 'cross', 'north', true),
  fp('HOME-022', 'simpleHouseH', 18, 42.4, 14.75, 21.25, 39.293, 45.507, 4.451, 'cross', 'north', true),
  fp('RESTAURANT', 'restaurant', 32, 44.15, 25.749, 38.251, 39.15, 49.15, 4.458, 'cross', 'north', true),
  fp('BLOCK-003', 'cityPackResidential', 47, 42.4, 43.773, 50.227, 39.15, 45.65, 9.955, 'cross', 'north', true),
  fp('BLOCK-004', 'cityPackCommercialTower', -46, 25.6, -49.25, -42.75, 22.35, 28.85, 11.945, 'cross', 'south', true),
  fp('BLOCK-005', 'cityPackCommercialPurple', -37, 25.6, -40.275, -33.725, 23.276, 27.924, 5.643, 'cross', 'south', true),
  fp('HOME-026', 'infillHouse2', -28.5, 25.6, -31.506, -25.494, 22.611, 28.589, 5.5, 'cross', 'south', true),
  fp('HOME-021', 'simpleHouseF', -20, 25.6, -23.25, -16.75, 22.35, 28.85, 3.493, 'cross', 'south', true),
  fp('HOME-023', 'simpleHouseE', 18, 25.6, 14.75, 21.25, 23.367, 27.833, 4.869, 'cross', 'south', true),
  fp('HOME-027', 'infillHouse3', 27, 25.6, 25.084, 28.916, 22.35, 28.85, 3.717, 'cross', 'south', true),
  fp('HOME-028', 'infillHouse4', 37, 25.6, 34.265, 39.735, 22.35, 28.85, 3.443, 'cross', 'south', true),
  fp('HOME-024', 'simpleHouseG', 47, 25.6, 43.725, 50.275, 22.325, 28.875, 6.546, 'cross', 'south', true),
  fp('START-EAST', 'cityHouse', 8.987, 11.75, 6, 11.974, 8.66, 14.84, 5.8, 'main', 'east', false),
  fp('cityPackKfc@9.2/18.44', 'cityPackKfc', 9.2, 18.44, 6, 12.4, 16.134, 20.746, 5.302, 'main', 'east', true),
  fp('HOME-001', 'simpleHouseB', 8.4, 25.14, 6.028, 10.772, 22.036, 28.244, 7, 'main', 'east', false),
  fp('HOME-002', 'simpleHouseC', 9.675, 42, 7.555, 11.795, 38.75, 45.25, 4.24, 'main', 'east', true),
  fp('HOME-003', 'simpleHouseD', 9.525, 50.15, 7.669, 11.381, 47.309, 52.991, 7.2, 'main', 'east', true),
  fp('HOME-006', 'simpleHouseC', 9.675, 57.9, 7.555, 11.795, 54.65, 61.15, 4.24, 'main', 'east', true),
  fp('HOME-009', 'simpleHouseD', 9.525, 65.4, 7.669, 11.381, 62.559, 68.241, 7.2, 'main', 'east', true),
  fp('HOME-011', 'simpleHouseC', 9.675, 72.6, 7.555, 11.795, 69.35, 75.85, 4.24, 'main', 'east', true),
  fp('HOME-012', 'simpleHouseE', 9.675, 80, 7.442, 11.908, 76.75, 83.25, 4.869, 'main', 'east', true),
  fp('HOME-014', 'simpleHouseG', 9.525, 87.5, 6.25, 12.8, 84.225, 90.775, 6.546, 'main', 'east', true),
  fp('HOME-016', 'simpleHouseF', 9.675, 95, 6.425, 12.925, 91.75, 98.25, 3.493, 'main', 'east', true),
  fp('HOME-018', 'simpleHouseH', 9.675, 102.4, 6.568, 12.782, 99.15, 105.65, 4.451, 'main', 'east', true),
  fp('START-WEST', 'cityShop', -8.3, 14.7, -10.4, -6.2, 12.07, 17.33, 5.017, 'main', 'west', false),
  fp('BLOCK-001', 'cityPackMotel', -10, 22.5, -12.509, -7.491, 18.762, 26.238, 12.2, 'main', 'west', true),
  fp('HOME-004', 'simpleHouseD', -9.525, 42.4, -11.381, -7.669, 39.559, 45.241, 7.2, 'main', 'west', true),
  fp('HOME-005', 'simpleHouseC', -9.675, 49.6, -11.795, -7.555, 46.35, 52.85, 4.24, 'main', 'west', true),
  fp('HOME-007', 'simpleHouseD', -9.525, 57.8, -11.381, -7.669, 54.959, 60.641, 7.2, 'main', 'west', true),
  fp('HOME-008', 'simpleHouseC', -9.675, 65.2, -11.795, -7.555, 61.95, 68.45, 4.24, 'main', 'west', true),
  fp('HOME-010', 'simpleHouseD', -9.525, 72.5, -11.381, -7.669, 69.659, 75.341, 7.2, 'main', 'west', true),
  fp('HOME-013', 'simpleHouseF', -9.675, 80, -12.925, -6.425, 76.75, 83.25, 3.493, 'main', 'west', true),
  fp('HOME-015', 'simpleHouseH', -9.675, 87.4, -12.782, -6.568, 84.15, 90.65, 4.451, 'main', 'west', true),
  fp('HOME-017', 'simpleHouseE', -9.675, 94.8, -11.908, -7.442, 91.55, 98.05, 4.869, 'main', 'west', true),
  fp('BLOCK-002', 'cityPackHighrise', -9.525, 102.4, -12.145, -6.905, 98.85, 105.95, 24.282, 'main', 'west', true),
].map(Object.freeze));

// La linea de fondo que pone J67/J68. `crossSouth`/`crossNorth` son las dos caras de la transversal.
export const LOT_BACK_LINES = Object.freeze({ main: 15.5, crossSouth: 19.5, crossNorth: 51 });
// La franja de la principal donde J NO pone medianera: sus rellenos terminan en z 19,5 y empiezan en z 51.
export const J_BACKLOT_GAP = Object.freeze({ minZ: 19.5, maxZ: 51 });
export const SIDEWALK_EDGE = Object.freeze({ main: 6, cross: Object.freeze({ south: 29.355, north: 38.645 }) });
// El corredor por donde se camina. Un cierre que lo cruce tapia la calle.
export const ROADWAY = Object.freeze({
  main: Object.freeze({ zMin: 29.355, zMax: 38.645 }),
  cross: Object.freeze({ xMin: -6, xMax: 6 }),
});
// 6,15 deja 3 cm de aire entre un cierre de 0,12 y el borde del cordon en 6,0.
export const CLOSURE_FRONT_MIN = 6.15;
export const LOT_END = 0.9;                 // cuanto sobresale el lote de su casa en la punta de fila
export const GAP_MIN = 0.3, GAP_MAX = 6;
// Un cierre no se apoya en el cordon: 6 cm de aire entre su cara y el borde de la vereda.
export const KERB_GAP = 0.06;

function fp(id, asset, x, z, minX, maxX, minZ, maxZ, height, street, side, fitted) {
  return { id, asset, x, z, minX, maxX, minZ, maxZ, height, street, side, fitted };
}

const along = street => (street === 'main' ? 'z' : 'x');
const lo = f => (f.street === 'main' ? f.minZ : f.minX);
const hi = f => (f.street === 'main' ? f.maxZ : f.maxX);
const roadOf = street => (street === 'main'
  ? [ROADWAY.main.zMin, ROADWAY.main.zMax]
  : [ROADWAY.cross.xMin, ROADWAY.cross.xMax]);

export function rowsOf(footprints = HOUSE_FOOTPRINTS) {
  const out = new Map();
  for (const f of footprints) {
    const key = `${f.street}/${f.side}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(f);
  }
  for (const list of out.values()) list.sort((a, b) => lo(a) - lo(b));
  return out;
}

// El frente: la cara del lado de la calle. En la principal es |x|, en la transversal |z| respecto de 34.
export function frontOf(f) {
  if (f.street === 'main') return { axis: 'x', value: f.side === 'west' ? f.maxX : f.minX };
  return { axis: 'z', value: f.side === 'south' ? f.maxZ : f.minZ };
}
export function backOf(f) {
  if (f.street === 'main') {
    const value = f.side === 'west' ? -LOT_BACK_LINES.main : LOT_BACK_LINES.main;
    // ownFence: los lotes de la principal dentro de z 19,5..51 no tienen medianera de J detras.
    // El paquete decia CUATRO; medido son SEIS -- BLOCK-001 (z 22,5) y HOME-001 (z 25,14) tambien caen
    // dentro de la franja y J tampoco les pone nada atras.
    return { axis: 'x', value, ownFence: f.z > J_BACKLOT_GAP.minZ && f.z < J_BACKLOT_GAP.maxZ };
  }
  const value = f.side === 'south' ? LOT_BACK_LINES.crossSouth : LOT_BACK_LINES.crossNorth;
  return { axis: 'z', value, ownFence: false };
}

// Jose eligio la madera: "yo escogeria la de madera". La mezcla queda en una constante para poder
// volver a abrirla mas adelante, pero por defecto la cuadra entera es de tablon.
export const STYLE_MIX = Object.freeze(['plank']);

export function styleForIndex(index) {
  return STYLE_MIX[index % STYLE_MIX.length];
}

// Un lote por casa. `from`/`to` es el punto medio del hueco con el vecino del mismo lado y calle; en las
// puntas de fila y contra una bocacalle el lote termina a LOT_END de su casa, RECORTADO al cordon: sin ese
// recorte el lote de HOME-002 nacia en 37,850, dentro de la calzada (que empieza en 38,645).
export function lots(footprints = HOUSE_FOOTPRINTS) {
  const out = [];
  let index = 0;
  for (const [, list] of rowsOf(footprints)) {
    for (let i = 0; i < list.length; i++) {
      const self = list[i], prev = list[i - 1], next = list[i + 1];
      const [roadLo, roadHi] = roadOf(self.street);
      const crossesBefore = prev && hi(prev) < roadLo && lo(self) > roadHi;
      const crossesAfter = next && hi(self) < roadLo && lo(next) > roadHi;
      const from = prev && !crossesBefore
        ? (hi(prev) + lo(self)) / 2
        : Math.max(lo(self) - LOT_END, hi(self) < roadLo ? -Infinity : roadHi);
      const to = next && !crossesAfter
        ? (hi(self) + lo(next)) / 2
        : Math.min(hi(self) + LOT_END, lo(self) > roadHi ? Infinity : roadLo);
      out.push(Object.freeze({
        id: self.id, footprint: self, front: frontOf(self), back: backOf(self),
        from: +from.toFixed(3), to: +to.toFixed(3), style: styleForIndex(index), index,
        // Un borde COMPARTIDO con el vecino es el que divide dos lotes; el otro es la punta de fila o
        // el recorte contra la bocacalle, que cae sobre la vereda. Una cerca lateral ahi se planta en
        // el camino del jugador: medido, dos se comian el spawn de calle de HOME-002 y HOME-004.
        sharedFrom: Boolean(prev && !crossesBefore),
        sharedTo: Boolean(next && !crossesAfter),
      }));
      index++;
    }
  }
  return out;
}

// Huecos de fila. Tres reglas, en este orden: (1) pares consecutivos del mismo lado y calle;
// (2) el intervalo se RECORTA al corredor de calzada -- no se descarta el par entero, que es lo que hacia
// la Decision 3 del paquete y dejaba TRES pasadas abiertas medidas: 1,111 m entre HOME-001 y HOME-002, y
// 3,117 + 0,914 m entre BLOCK-001 y HOME-004; (3) sobrevive el trozo con GAP_MIN <= largo <= GAP_MAX.
export function lotGaps(footprints = HOUSE_FOOTPRINTS) {
  const out = [];
  for (const [key, list] of rowsOf(footprints)) {
    const [street, side] = key.split('/');
    const [roadLo, roadHi] = roadOf(street);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const start = hi(a), end = lo(b);
      // `clipFrom`/`clipTo`: de que lado el trozo termina contra el CORDON y no contra una casa. Ahi no
      // hay vecina sobre la que montarse, asi que el cierre no lleva solape: con el, su punta entraba
      // 0,16 m DENTRO de la calzada -- medido, tres puntas de hoja dentro del corredor.
      const piezas = start < roadHi && end > roadLo
        ? [[start, Math.min(end, roadLo - KERB_GAP), false, end > roadLo], [Math.max(start, roadHi + KERB_GAP), end, start < roadHi, false]]
        : [[start, end, false, false]];
      for (const [from, to, clipFrom, clipTo] of piezas) {
        const gap = +(to - from).toFixed(3);
        if (!(gap >= GAP_MIN && gap <= GAP_MAX)) continue;
        // La linea del cierre es la fachada MAS RETIRADA del par: la que esta mas lejos de la calzada.
        // En la avenida eso es el mayor |x|; en la transversal, el menor z al sur y el mayor al norte.
        // Tomar siempre el mayor valor absoluto ponia el cierre de la transversal sobre la fachada mas
        // ADELANTADA, y ahi la cerca terminaba en el aire a 0,9 a 2,6 m de su vecina -- diez cierres
        // tocaban una sola casa, medido. Se ve recien desde arriba o de costado.
        const frontA = frontOf(a).value, frontB = frontOf(b).value;
        const closureLine = street === 'main'
          ? (side === 'west' ? -1 : 1) * Math.max(Math.abs(frontA), Math.abs(frontB), CLOSURE_FRONT_MIN)
          : (side === 'south'
            ? Math.min(frontA, frontB, SIDEWALK_EDGE.cross.south - KERB_GAP)
            : Math.max(frontA, frontB, SIDEWALK_EDGE.cross.north + KERB_GAP));
        out.push(Object.freeze({
          a: a.id, b: b.id, gap, street, side, axis: along(street),
          from: +from.toFixed(3), to: +to.toFixed(3),
          closureLine: +closureLine.toFixed(3),
          frontLine: +Math.max(Math.abs(frontA), Math.abs(frontB), CLOSURE_FRONT_MIN).toFixed(3),
          clipped: piezas.length > 1, clipFrom, clipTo,
        }));
      }
    }
  }
  return out;
}

// Los CUATRO rincones de manzana, que `lotGaps` no puede ver porque su primer filtro es "mismo lado y
// calle" y un rincon junta dos filas distintas. Medidos: SO 4,241 · SE 3,978 · NO 5,344 · NE 2,955, con
// 3,9 a 6,0 m de solape en el eje transversal, o sea que son huecos que se MIRAN de frente, no esquinas
// en diagonal. Sin ellos, cerrar los 30 huecos de fila deja cuatro ventanas al vacio en las esquinas.
export const CORNERS = Object.freeze([
  Object.freeze({ id: 'SW', side: 'west', cross: 'south' }),
  Object.freeze({ id: 'SE', side: 'east', cross: 'south' }),
  Object.freeze({ id: 'NW', side: 'west', cross: 'north' }),
  Object.freeze({ id: 'NE', side: 'east', cross: 'north' }),
]);

export function cornerGaps(footprints = HOUSE_FOOTPRINTS) {
  const byRow = rowsOf(footprints);
  const out = [];
  for (const corner of CORNERS) {
    const avenue = byRow.get(`main/${corner.side}`) ?? [];
    const crossRow = byRow.get(`cross/${corner.cross}`) ?? [];
    const north = corner.cross === 'north';
    // el edificio de la avenida mas pegado a la transversal, y el de la transversal mas pegado a la avenida
    const a = north
      ? avenue.filter(f => f.minZ > ROADWAY.main.zMax).sort((p, q) => p.minZ - q.minZ)[0]
      : avenue.filter(f => f.maxZ < ROADWAY.main.zMin).sort((p, q) => q.maxZ - p.maxZ)[0];
    const b = corner.side === 'west'
      ? crossRow.filter(f => f.x < 0).sort((p, q) => q.maxX - p.maxX)[0]
      : crossRow.filter(f => f.x > 0).sort((p, q) => p.minX - q.minX)[0];
    if (!a || !b) continue;
    const from = corner.side === 'west' ? b.maxX : a.maxX;
    const to = corner.side === 'west' ? a.minX : b.minX;
    const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    out.push(Object.freeze({
      id: corner.id, a: a.id, b: b.id, axis: 'x',
      from: +from.toFixed(3), to: +to.toFixed(3), gap: +(to - from).toFixed(3),
      overlapZ: +overlapZ.toFixed(3),
      zFrom: +Math.max(a.minZ, b.minZ).toFixed(3), zTo: +Math.min(a.maxZ, b.maxZ).toFixed(3),
    }));
  }
  return out;
}

// --- La perilla -----------------------------------------------------------------------------------
// Mismo patron que el galpon (K) y el muro: el 0 es el juego de hoy bit a bit. Se elige por query
// string y se cambia en caliente por __robinweedQA.setManzana(n).
export const MANZANA_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', fences: false, yards: false }),
  Object.freeze({ id: 1, key: 'closed', label: 'CERRADA', fences: true, yards: false }),
  Object.freeze({ id: 2, key: 'dressed', label: 'VESTIDA', fences: true, yards: true }),
]);

export const DEFAULT_MANZANA_PRESET = 2;

export function manzanaPresetById(id) {
  return MANZANA_PRESETS.find(preset => preset.id === id) ?? MANZANA_PRESETS[DEFAULT_MANZANA_PRESET];
}

export function readManzanaPreset(search, fallback = DEFAULT_MANZANA_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('manzana') ?? params.get('lote');
  // `?manzana=` sin valor devuelve '' y Number('') es 0: sin este chequeo un signo igual de mas
  // seleccionaba el brazo de control en silencio.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && MANZANA_PRESETS.some(preset => preset.id === value) ? value : fallback;
}
