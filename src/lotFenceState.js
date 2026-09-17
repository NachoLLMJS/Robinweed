// Los cierres de la manzana: lo que convierte 38 casas sueltas en una cuadra construida.
//
// Regla de oro: el cierre va en el plano de la fachada MAS RETIRADA del par, nunca sobre el cordon, y cubre
// el hueco REAL medido (`lotState.js`), no el declarado -- con el declarado quedan ranuras de hasta 0,35 m
// a cada lado y el pasto se sigue viendo. Consecuencia asumida: el collider del cierre se solapa con el
// collider DECLARADO de las dos casas vecinas. Los dos son solidos, asi que fisicamente da igual; lo que si
// se exige es que no toque una HUELLA medida, ni un obstaculo que no sea edificio, ni un spawn de calle.
import {
  HOUSE_FOOTPRINTS, ROADWAY, SIDEWALK_EDGE, LOT_BACK_LINES, CLOSURE_FRONT_MIN,
  lots, lotGaps, cornerGaps, styleForIndex, frontOf, J_BACKLOT_GAP,
} from './lotState.js';

export const FENCE_STYLES = Object.freeze({
  // El tablon comparte numeros con la medianera de J (cityWallState.js WALL_STYLE.plank) para que se lean
  // como el mismo material a dos alturas: la de J cierra la cuadra, esta cierra el lote.
  plank: Object.freeze({
    height: 1.2, thickness: 0.12, gateHeight: 1.45, color: '#6b5b45',
    paint: Object.freeze({ boards: 11, light: '#7b6a51', dark: '#5c4e3d', groove: '#463a2c', rail: '#584a39', cap: '#8a7659' }),
    roughness: 0.92, metalness: 0, castShadow: true,
    // El emissive va MODULADO por la textura (`emissiveMap`), igual que todo GLB de la calle bajo
    // `tuneNightMaterials`. Con un emissive PLANO, en la cara que no mira a la luna el rebote era el
    // 96 % del pixel y la veta desaparecia: la tabla quedaba una placa marron lisa, y al lado de una
    // cara iluminada se leia NEGRA (medido en el porton abierto de HOME-023, donde las dos hojas del
    // MISMO porton salen a 62 y 118 grados). Blanco x 0,227 reproduce la luminancia media del
    // #45403a x 0,49 de antes -- 0,0257 lineal contra un texel medio de 0,1132 -- pero con veta.
    emissive: '#ffffff', emissiveIntensity: 0.227,
    // 11 tablas de 16 cm: el ancho REAL de una tabla en metros, no 'un onceavo de la hoja'.
    patternWidth: 11 * 0.16,
  }),
  hedge: Object.freeze({
    height: 1.6, thickness: 0.55, gateHeight: 1.6, color: '#3d5a3a',
    paint: Object.freeze({ clumps: 260, light: '#496b44', dark: '#2f4a30', shade: '#263d28', cap: '#547a4d' }),
    roughness: 1, metalness: 0, castShadow: true,
    emissive: '#ffffff', emissiveIntensity: 0.323,   // blanco x textura; ver el tablon
    patternWidth: 2,
  }),
  chain: Object.freeze({
    height: 1.5, thickness: 0.06, gateHeight: 1.5, color: '#6f7679', seeThrough: true,
    paint: Object.freeze({ cell: 26, wire: '#8e989c', shade: '#5c6467', post: '#767e81' }),
    roughness: 0.72, metalness: 0.22, castShadow: false,
    emissive: '#ffffff', emissiveIntensity: 0.124,   // blanco x textura; ver el tablon
    patternWidth: 2,
  }),
});

export const GATE_MIN = 1.2, WIDE_GATE_MIN = 3.5, OPEN_GATE_YAW = (62 * Math.PI) / 180;
// Que fraccion de los portones se entrega ABIERTA. Jose, mirando el juego: "la separacion entre las
// casas queda mal porque la madera sale en diagonal cuando deberia verse como un vecindario". Una
// hoja abierta vista desde la vereda es una tabla cruzada sobre el pasto, y rompe la linea de la
// cuadra justo donde la cuadra tiene que leerse continua. Cerrados, los 22 portones siguen siendo
// portones -- tienen sus dos hojas, su bisagra y sus postes -- pero la manzana cierra.
export const OPEN_GATE_SHARE = 0;
// El panel se MONTA sobre la casa vecina en vez de terminar justo en su cara: sin ese solape, visto de
// costado se ve la juntura y el cierre parece una tabla apoyada en el pasto. El COLLIDER no se solapa
// (sigue midiendo el hueco exacto), sólo la geometría.
export const NEIGHBOUR_LAP = 0.16, CORNER_LAP = 0.32;
// Cuánto se mete el cierre de rincón dentro de la franja donde las DOS huellas existen. Sin esto queda
// en el borde exacto de una de ellas y sólo la toca en un punto: de costado se ve el hueco.
export const CORNER_INSET = 0.45;

// Cuanto ABRE cada porton. `OPEN_GATE_YAW` es el minimo, no el valor: la cerca LATERAL nace en el
// MEDIO del hueco -- `lots()` parte el hueco entre dos casas por la mitad -- y una hoja que gira sobre
// una PUNTA avanza `cos(a) x largo` hacia ese medio. A 62 grados los cuatro portones de UNA hoja
// pasaban de largo y la hoja quedaba cruzada dentro de la lateral: 0,042 a 0,076 m, medido.
// Abrir MAS aleja la punta (cos baja), no la acerca. Los `wideGate` son dos hojas de medio span y ya
// tienen de sobra: su angulo minimo da 20 grados.
export function openYawFor(piece, spec = FENCE_STYLES[piece.style]) {
  const span = piece.span ?? piece.length;
  const leaves = piece.kind === 'wideGate' ? 2 : 1;
  const reach = (span / 2 - spec.thickness) / (span / leaves);
  const needed = Math.acos(Math.min(1, Math.max(-1, reach)));
  return Math.max(OPEN_GATE_YAW, needed);
}
export const COLLIDER_THICKNESS = 0.12;
// Un cierre que se apoye en el cordon se ve desde la vereda como una pared en la cara. 0,06 de aire.
const KERB_CLEARANCE = 0.06;

function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
const unit = salt => hash32(`lot#${salt}`) / 4294967296;

const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// Caja de un panel: `axis` es el eje sobre el que corre su largo.
function colliderFor(axis, centreAlong, centreAcross, length, thickness = COLLIDER_THICKNESS) {
  const half = length / 2, side = thickness / 2;
  return axis === 'x'
    ? { minX: +(centreAlong - half).toFixed(3), maxX: +(centreAlong + half).toFixed(3), minZ: +(centreAcross - side).toFixed(3), maxZ: +(centreAcross + side).toFixed(3) }
    : { minX: +(centreAcross - side).toFixed(3), maxX: +(centreAcross + side).toFixed(3), minZ: +(centreAlong - half).toFixed(3), maxZ: +(centreAlong + half).toFixed(3) };
}

function kindFor(gap, style) {
  if (gap >= WIDE_GATE_MIN) return 'wideGate';
  if (gap >= GATE_MIN) return 'gate';
  return style === 'hedge' ? 'hedge' : 'fence';
}

// Cuanto se aparta una cerca de fondo de la linea de un cierre de rincon: medio espesor de cada una.
const CORNER_CUT = COLLIDER_THICKNESS;

// La linea de cada cierre de rincon, aparte de `frontClosures`, porque `backFences` tambien la necesita
// para no atravesarla. Una sola cuenta, dos consumidores.
export function cornerClosureLines(footprints = HOUSE_FOOTPRINTS) {
  return cornerGaps(footprints).map(corner => {
    const north = corner.id.startsWith('N');
    // Dentro de la franja donde las DOS huellas existen, no en su borde: en el borde el panel tocaba a
    // una de las casas en un solo punto y de costado se veia el hueco entre el cierre y la pared.
    const inset = Math.min(CORNER_INSET, Math.max(0, (corner.zTo - corner.zFrom) / 2));
    const across = north
      ? Math.max(corner.zFrom + inset, SIDEWALK_EDGE.cross.north + KERB_CLEARANCE)
      : Math.min(corner.zTo - inset, SIDEWALK_EDGE.cross.south - KERB_CLEARANCE);
    return { ...corner, north, across: +across.toFixed(3) };
  });
}

// --- cierres de frente ---------------------------------------------------------------------------
// Uno por hueco de fila (33 tras recortar los que cruzan calzada) y uno por rincon de manzana (4). Los
// rincones no salen de `lotGaps`: su filtro es "mismo lado y calle" y un rincon junta dos filas.
export function frontClosures(options = {}) {
  const { avoid = [], footprints = HOUSE_FOOTPRINTS } = options;
  const out = [];
  const gaps = lotGaps(footprints);
  gaps.forEach((gap, order) => {
    const style = styleForIndex(order);
    const kind = kindFor(gap.gap, style);
    const along = (gap.from + gap.to) / 2;
    // El solape sirve para MONTARSE sobre la casa vecina. Contra el cordon no hay vecina: ese lado va
    // a ras, o la punta de la hoja termina dentro de la calzada.
    const lapFrom = gap.clipFrom ? 0 : NEIGHBOUR_LAP, lapTo = gap.clipTo ? 0 : NEIGHBOUR_LAP;
    const alongPanel = (gap.from - lapFrom + gap.to + lapTo) / 2;
    const sideSign = gap.side === 'west' || gap.side === 'south' ? -1 : 1;
    // La linea de cierre la resuelve `lotGaps`: es la fachada mas retirada del par, que en la avenida
    // es el mayor |x| y en la transversal el menor z al sur y el mayor al norte.
    const across = gap.closureLine;
    const axis = gap.street === 'main' ? 'z' : 'x';
    const open = /gate/i.test(kind) && unit(`open:${gap.a}:${gap.b}:${order}`) < OPEN_GATE_SHARE;
    // La hoja abre HACIA EL PATIO, nunca hacia la vereda: un porton que se abre a la calle le pega al
    // jugador en la cara. El sentido del patio es el mismo que el de la normal del frente.
    const inward = gap.street === 'main' ? sideSign : (gap.side === 'south' ? -1 : 1);
    out.push(Object.freeze({
      id: `${gap.a}->${gap.b}${gap.clipped ? `@${gap.from}` : ''}`,
      style, kind, corner: false,
      // el PANEL se centra contando sus solapes; el collider y las bisagras siguen midiendo el hueco pelado
      x: axis === 'z' ? +across.toFixed(3) : +alongPanel.toFixed(3),
      z: axis === 'z' ? +alongPanel.toFixed(3) : +across.toFixed(3),
      length: +(gap.gap + lapFrom + lapTo).toFixed(3), span: gap.gap,
      lapFrom, lapTo,
      rotationY: axis === 'z' ? Math.PI / 2 : 0, open, inward, axis,
      from: gap.from, to: gap.to, across: +across.toFixed(3),
      collider: open ? null : colliderFor(axis, along, across, gap.gap),
    }));
  });
  cornerClosureLines(footprints).forEach((corner, index) => {
    const style = styleForIndex(gaps.length + index);
    const kind = kindFor(corner.gap, style);
    // El rincon se mira a lo largo de X, asi que el cierre corre sobre X; se apoya en la cara mas
    // adelantada del par hacia la transversal, sin entrar en la calzada. La linea la resuelve
    // `cornerClosureLines`, que es la misma que respeta `backFences` para no atravesarla.
    const { north, across } = corner;
    const along = (corner.from + corner.to) / 2;
    // un rincon nunca se entrega abierto: es el fondo de dos patios, no una entrada
    out.push(Object.freeze({
      id: `corner-${corner.id}`, style, kind: kind === 'wideGate' ? 'fence' : kind === 'gate' ? 'fence' : kind,
      corner: true,
      x: +along.toFixed(3), z: +across.toFixed(3),
      length: +(corner.gap + 2 * CORNER_LAP).toFixed(3), span: corner.gap,
      rotationY: 0, open: false, inward: north ? 1 : -1, axis: 'x',
      from: corner.from, to: corner.to, across: +across.toFixed(3),
      collider: colliderFor('x', along, across, corner.gap),
    }));
  });
  return avoid.length ? out.filter(c => !c.collider || !avoid.some(a => overlaps(c.collider, a))) : out;
}

// --- cercas laterales y de fondo ------------------------------------------------------------------
// Un tramo se INTERRUMPE donde cruza una huella medida: sin eso la cerca lateral entra en la casa del
// vecino, que es justo el solape que el test prohibe.
function splitAroundFootprints(axis, from, to, across, footprints) {
  const blockers = [];
  for (const fp of footprints) {
    const lo = axis === 'x' ? fp.minX : fp.minZ, hi = axis === 'x' ? fp.maxX : fp.maxZ;
    const acrossLo = axis === 'x' ? fp.minZ : fp.minX, acrossHi = axis === 'x' ? fp.maxZ : fp.maxX;
    if (across <= acrossLo || across >= acrossHi) continue;
    if (hi <= from || lo >= to) continue;
    blockers.push([Math.max(lo, from), Math.min(hi, to)]);
  }
  blockers.sort((a, b) => a[0] - b[0]);
  const pieces = [];
  let cursor = from;
  for (const [lo, hi] of blockers) {
    if (lo > cursor) pieces.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < to) pieces.push([cursor, to]);
  return pieces.filter(([lo, hi]) => hi - lo >= 0.5);
}

// Cuanto espacio libre pide un porton delante suyo antes de que arranque la cerca lateral que nace en
// ese mismo limite de lote. Abierto, es lo que barre la hoja; cerrado, lo justo para que la lateral no
// nazca sobre el plano de la puerta.
export function gateClearance(piece, spec = FENCE_STYLES[piece.style]) {
  if (!/gate/i.test(piece.kind ?? '')) return 0;
  const span = piece.span ?? piece.length;
  const leafLength = span / (piece.kind === 'wideGate' ? 2 : 1);
  return piece.open
    ? leafLength * Math.sin(openYawFor(piece, spec)) + spec.thickness
    : spec.thickness;
}

export function sideFences(options = {}) {
  const { avoid = [], footprints = HOUSE_FOOTPRINTS } = options;
  const out = [];
  const seen = new Set();
  const gaps = lotGaps(footprints);
  // `frontClosures` recorre `gaps` en orden, asi que el cierre i es el del hueco i. Se necesita saber
  // si el limite de lote cae dentro del VANO de un porton -- ver `gateClearance`.
  const closures = frontClosures({ footprints });
  // El lateral arranca en la LINEA DEL CIERRE de su propio limite, no en la fachada de su casa. Las
  // fachadas de la transversal se escalonan hasta 2,6 m: arrancando en la propia, el lateral sobresalia
  // casi un metro por delante del cierre, hacia la vereda. Se ve desde arriba, no de frente.
  const lineAt = (street, side, across, fallback, back) => {
    const index = gaps.findIndex(g => g.street === street && g.side === side && across >= g.from - 1e-6 && across <= g.to + 1e-6);
    if (index < 0) return fallback;
    const line = gaps[index].closureLine;
    // `lots()` parte el hueco entre dos casas por la MITAD, asi que cuando ese hueco lleva PORTON el
    // limite de lote cae justo en la puerta: medido, 21 de los 22 portones tenian una lateral de 8 a
    // 12 m saliendo del centro exacto del vano. Con el porton abierto se ve un panel plantado en el
    // medio de la entrada. La lateral arranca detras de lo que ocupa el porton.
    const clearance = gateClearance(closures[index] ?? {});
    return clearance ? line + Math.sign(back - line) * clearance : line;
  };
  for (const lot of lots(footprints)) {
    const fp = lot.footprint;
    const main = fp.street === 'main';
    const axis = main ? 'x' : 'z';                       // el lateral corre del frente al fondo
    // Coordenadas CON SIGNO, sin `Math.abs` ni un signo aparte. El truco del signo funcionaba en tres de
    // las cuatro filas y en la CUARTA no: la fila norte de la transversal tiene su frente en z 39,3 y su
    // fondo en z 51 -- los dos positivos y el fondo mas grande -- asi que el signo -1 mandaba sus cercas
    // laterales a z NEGATIVO, a 90 m del mapa. Ningun chequeo lo veia: ahi afuera no hay nada con lo que
    // chocar, ni un spawn que tapar, ni una huella que pisar. Se ve desde arriba, y nada mas.
    const frontValue = frontOf(fp).value;
    const back = lot.back.value;
    for (const across of [lot.sharedFrom ? lot.from : null, lot.sharedTo ? lot.to : null]) {
      if (across === null) continue;
      const key = `${axis}:${across.toFixed(3)}:${back > 0 ? 1 : -1}`;
      if (seen.has(key)) continue;                        // el limite es COMPARTIDO: una sola cerca
      seen.add(key);
      const line = lineAt(fp.street, fp.side, across, frontValue, back);
      const startFrom = Math.min(line, back), startTo = Math.max(line, back);
      for (const [lo, hi] of splitAroundFootprints(axis, startFrom, startTo, across, footprints)) {
        const collider = colliderFor(axis, (lo + hi) / 2, across, hi - lo);
        if (avoid.some(a => overlaps(collider, a))) continue;
        out.push(Object.freeze({
          id: `side-${lot.id}-${across.toFixed(2)}-${lo.toFixed(2)}`, style: lot.style,
          x: axis === 'x' ? +((lo + hi) / 2).toFixed(3) : +across.toFixed(3),
          z: axis === 'x' ? +across.toFixed(3) : +((lo + hi) / 2).toFixed(3),
          length: +(hi - lo).toFixed(3), rotationY: axis === 'x' ? 0 : Math.PI / 2, collider,
        }));
      }
    }
  }
  return out;
}

// Los SEIS lotes de la principal que caen en z 19,5..51: J termina sus rellenos en 19,5 y los retoma en
// 51, asi que detras de ellos no hay medianera y se les ve el fondo. El paquete decia cuatro.
export function backFences(options = {}) {
  const { footprints = HOUSE_FOOTPRINTS } = options;
  const out = [];
  // El cierre de RINCON corre sobre X a la altura del fondo de los dos lotes de esquina, y la cerca de
  // fondo corre sobre Z por |x| = 15,5: se cruzan en angulo recto. Medido antes de tocar nada: 1,200 m
  // de penetracion en `corner-SW x back-BLOCK-001` y en `corner-NW x back-HOME-004`, o sea dos tablas
  // atravesadas una dentro de la otra. Es el defecto que se ve desde la transversal. La cerca de fondo
  // TERMINA contra el rincon, como terminaria contra una casa.
  const cornerBoxes = cornerClosureLines(footprints).map(corner => ({
    minX: corner.from - CORNER_LAP, maxX: corner.to + CORNER_LAP,
    minZ: corner.across - CORNER_CUT, maxZ: corner.across + CORNER_CUT,
  }));
  for (const lot of lots(footprints).filter(l => l.back.ownFence)) {
    const across = lot.back.value;
    // Esta cerca existe SOLO porque J no pone medianera entre z 19,5 y 51. Pasada de esa franja se mete
    // de punta contra el muro de la avenida: medido, 0,142 a 0,147 m -- mas que el medio espesor de cada
    // una. Se recorta a su propia franja, con medio espesor de aire contra el arranque del muro.
    const from = Math.max(lot.from, J_BACKLOT_GAP.minZ + CORNER_CUT / 2);
    const to = Math.min(lot.to, J_BACKLOT_GAP.maxZ - CORNER_CUT / 2);
    if (to - from < 0.5) continue;
    // La linea de fondo |x| = 15,5 ATRAVIESA a los dos edificios de esquina de la transversal
    // (HOME-022 y HOME-023 ocupan x 14,75..21,25): sin cortar, la cerca de fondo les entra adentro.
    for (const [lo, hi] of splitAroundFootprints('z', from, to, across, [...footprints, ...cornerBoxes])) {
      out.push(Object.freeze({
        id: `back-${lot.id}-${lo.toFixed(2)}`, style: lot.style,
        x: +across.toFixed(3), z: +((lo + hi) / 2).toFixed(3),
        length: +(hi - lo).toFixed(3), rotationY: Math.PI / 2,
        collider: colliderFor('z', (lo + hi) / 2, across, hi - lo),
      }));
    }
  }
  return out;
}

export function lotFencePieces(options = {}) {
  return [...frontClosures(options), ...sideFences(options), ...backFences(options)];
}

export const LOT_FENCE_COLLIDERS = Object.freeze(
  lotFencePieces().map(piece => piece.collider).filter(Boolean).map(Object.freeze));

// --- de pieza a HOJAS ------------------------------------------------------------------------------
// Un porton gira sobre su BISAGRA, no sobre su centro. Girando 25 grados sobre el centro, una hoja de
// 5,35 m mandaba media tabla a la calle y media al patio, y el cierre se leia como un tablon tirado en
// diagonal sobre el pasto -- que es exactamente lo que se vio desde otro angulo. Y un porton de mas de
// WIDE_GATE_MIN se parte en DOS hojas, cada una con su bisagra, como cualquier porton de vehiculo.
function dirsOf(piece) {
  // alongDir corre por el largo; yardDir apunta al patio, que es hacia donde abre la hoja
  const along = piece.axis === 'z' ? [0, 1] : [1, 0];
  const yard = piece.axis === 'z' ? [piece.inward, 0] : [0, piece.inward];
  return { along, yard };
}

export function fenceLeaves(options = {}) {
  const out = [];
  for (const piece of lotFencePieces(options)) {
    const spec = FENCE_STYLES[piece.style];
    const gate = /gate/i.test(piece.kind ?? '');
    const height = gate ? spec.gateHeight : spec.height;
    const push = (x, z, length, yaw) => out.push(Object.freeze({
      id: piece.id, style: piece.style, x: +x.toFixed(3), z: +z.toFixed(3),
      length: +length.toFixed(3), height, yaw: +yaw.toFixed(5),
    }));
    if (!gate || piece.axis === undefined) {
      push(piece.x, piece.z, piece.length, piece.rotationY);
      continue;
    }
    const { along, yard } = dirsOf(piece);
    const span = piece.span ?? piece.length;
    const leaves = piece.kind === 'wideGate' ? 2 : 1;
    const leafLength = span / leaves;
    const angle = piece.open ? openYawFor(piece, spec) : 0;
    for (let leaf = 0; leaf < leaves; leaf++) {
      // la bisagra vive en una punta del hueco y la hoja se abre hacia adentro
      const hingeSign = leaf === 0 ? -1 : 1;
      const hingeAlong = (piece.from + piece.to) / 2 + hingeSign * (span / 2);
      const hingeX = piece.axis === 'z' ? piece.across : hingeAlong;
      const hingeZ = piece.axis === 'z' ? hingeAlong : piece.across;
      const swing = -hingeSign;                       // cada hoja se abre hacia el centro del hueco
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const dirX = swing * along[0] * cos + yard[0] * sin;
      const dirZ = swing * along[1] * cos + yard[1] * sin;
      // sin porton abierto, la hoja se estira para montarse sobre la casa vecina -- el solape de SU
      // lado, que contra el cordon es cero
      const lap = piece.open ? 0
        : (hingeSign < 0 ? (piece.lapFrom ?? NEIGHBOUR_LAP) : (piece.lapTo ?? NEIGHBOUR_LAP));
      const length = leafLength + lap;
      // la hoja arranca `lap` ANTES de la bisagra (montada sobre la casa) y mide `length`
      push(hingeX + dirX * (length / 2 - lap), hingeZ + dirZ * (length / 2 - lap),
        length, Math.atan2(-dirZ, dirX));
    }
  }
  return out;
}

export function fencePosts(options = {}) {
  const out = [];
  for (const piece of lotFencePieces(options)) {
    const spec = FENCE_STYLES[piece.style];
    if (piece.axis === undefined) continue;
    const span = piece.span ?? piece.length;
    const gate = /gate/i.test(piece.kind ?? '');
    const height = (gate ? spec.gateHeight : spec.height) + 0.12;
    for (const sign of [-1, 1]) {
      const at = (piece.from + piece.to) / 2 + sign * (span / 2);
      out.push(Object.freeze({
        id: `${piece.id}#${sign}`, style: piece.style, height,
        x: +(piece.axis === 'z' ? piece.across : at).toFixed(3),
        z: +(piece.axis === 'z' ? at : piece.across).toFixed(3),
      }));
    }
  }
  return out;
}

export const POST_SIDE = 0.17;

// Matrices por estilo, listas para `InstancedMesh.setMatrixAt`. La geometria base es un panel de
// 1 x 1 x 1: la instancia lo escala a (largo, alto, espesor) y lo gira.
export function fenceInstanceMatrices(style, options = {}) {
  const spec = FENCE_STYLES[style];
  const leaves = fenceLeaves(options).filter(leaf => leaf.style === style);
  const out = new Float32Array(leaves.length * 16);
  leaves.forEach((leaf, index) => {
    const cos = Math.cos(leaf.yaw), sin = Math.sin(leaf.yaw);
    const m = out.subarray(index * 16, index * 16 + 16);
    // column-major, igual que THREE.Matrix4.elements
    m[0] = cos * leaf.length; m[2] = -sin * leaf.length;
    m[5] = leaf.height;
    m[8] = sin * spec.thickness; m[10] = cos * spec.thickness;
    m[12] = leaf.x; m[13] = leaf.height / 2; m[14] = leaf.z; m[15] = 1;
  });
  return out;
}

// Los postes: sin ellos el cierre se lee como una tabla apoyada, no como algo construido.
export function postInstanceMatrices(options = {}) {
  const posts = fencePosts(options);
  const out = new Float32Array(posts.length * 16);
  posts.forEach((post, index) => {
    const m = out.subarray(index * 16, index * 16 + 16);
    m[0] = POST_SIDE; m[5] = post.height; m[10] = POST_SIDE;
    m[12] = post.x; m[13] = post.height / 2; m[14] = post.z; m[15] = 1;
  });
  return out;
}

// Cuantas veces se repite la textura A LO LARGO de cada hoja. Sin esto el material es UNO solo y el
// BoxGeometry de 1x1x1 estira el mismo UV 0..1 a cualquier largo: las 11 tablas pintadas median 5,9 cm
// en la hoja mas corta (0,65 m) y 106,6 cm en la mas larga (11,73 m), 18,1 veces mas anchas. Una tabla
// mide lo que mide, no un onceavo de su cerca.
export function fenceUvRepeats(style, options = {}) {
  const spec = FENCE_STYLES[style];
  const leaves = fenceLeaves(options).filter(leaf => leaf.style === style);
  const out = new Float32Array(leaves.length);
  leaves.forEach((leaf, index) => { out[index] = Math.max(0.2, leaf.length / spec.patternWidth); });
  return out;
}

export function postUvRepeats(options = {}) {
  const posts = fencePosts(options);
  const out = new Float32Array(posts.length);
  // un poste es un cuadrado de 17 cm: le toca UNA tabla, no once
  posts.forEach((post, index) => { out[index] = POST_SIDE / FENCE_STYLES[post.style].patternWidth; });
  return out;
}

// --- pintores (deterministas, sin leer del contexto) ----------------------------------------------
function paintRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function paintPlank(ctx, spec = FENCE_STYLES.plank) {
  const width = 256, height = 128, paint = spec.paint;
  const random = paintRandom(4242);
  ctx.fillStyle = paint.dark;
  ctx.fillRect(0, 0, width, height);
  const board = width / paint.boards, groove = Math.max(1, Math.round(board * 0.08));
  for (let i = 0; i < paint.boards; i++) {
    const x = Math.round(i * board);
    const pick = random();
    ctx.fillStyle = pick < 0.4 ? paint.light : pick < 0.75 ? paint.dark : spec.color;
    ctx.fillRect(x, 0, Math.round(board) - groove, height);
    ctx.fillStyle = paint.groove;
    ctx.fillRect(x + Math.round(board) - groove, 0, groove, height);
  }
  ctx.fillStyle = paint.rail;
  ctx.fillRect(0, Math.round(height * 0.58), width, Math.max(1, Math.round(height * 0.07)));
  ctx.fillStyle = paint.cap;
  ctx.fillRect(0, 0, width, Math.max(1, Math.round(height * 0.07)));
}

export function paintHedge(ctx, spec = FENCE_STYLES.hedge) {
  const width = 256, height = 128, paint = spec.paint;
  const random = paintRandom(777);
  ctx.fillStyle = paint.dark;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < paint.clumps; i++) {
    const x = Math.round(random() * width), y = Math.round(random() * height);
    const size = Math.round(4 + random() * 9);
    const roll = random();
    ctx.fillStyle = roll < 0.42 ? paint.light : roll < 0.78 ? paint.dark : paint.shade;
    ctx.fillRect(x, y, size, size);
  }
  ctx.fillStyle = paint.cap;                      // el corte de arriba, que es lo que lo hace "recortado"
  ctx.fillRect(0, 0, width, Math.max(2, Math.round(height * 0.1)));
}

// El alambrado se pinta sobre un canvas TRANSPARENTE: un alambrado opaco no es un alambrado, es una
// pared gris -- y asi se veia, tapando media pantalla a 2 m del jugador. El material lo consume con
// `alphaTest`, que evita ordenar transparencias y deja la sombra correcta.
export function paintChain(ctx, spec = FENCE_STYLES.chain) {
  const width = 256, height = 128, paint = spec.paint;
  ctx.clearRect(0, 0, width, height);
  const cell = Math.max(4, Math.round(width / paint.cell));
  ctx.fillStyle = paint.wire;
  for (let x = 0; x <= width; x += cell) ctx.fillRect(x, 0, 1, height);
  for (let y = 0; y <= height; y += cell) ctx.fillRect(0, y, width, 1);
  ctx.fillStyle = paint.post;
  ctx.fillRect(0, 0, 4, height);                       // los dos postes y el travesano de arriba
  ctx.fillRect(width - 4, 0, 4, height);
  ctx.fillRect(0, 0, width, 4);
  ctx.fillRect(0, height - 3, width, 3);
}
