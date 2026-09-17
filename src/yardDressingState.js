// El patio de cada lote: piso propio y dos o tres cosas. Es lo que se ve por un porton abierto, por
// encima de una cerca de 1,2 m y desde el aire, y lo que hace que un patio se lea como de alguien y no
// como pasto sobrante.
import { HOUSE_FOOTPRINTS, lots } from './lotState.js';
import { LOT_FENCE_COLLIDERS } from './lotFenceState.js';

// `tris` es el costo de la pieza con la geometria que usa main.js: una caja son 12 triangulos, un pano
// de tendedero 2. Los numeros estan aca para que el test pueda presupuestar sin abrir three.
export const YARD_KIT = Object.freeze({
  shed: Object.freeze({ material: 'metal', tris: 12, size: Object.freeze([1.6, 2, 1.4]), color: '#5f6a67' }),
  ac: Object.freeze({ material: 'metal', tris: 12, size: Object.freeze([0.72, 0.62, 0.38]), color: '#7b827f' }),
  bin: Object.freeze({ material: 'plastic', tris: 12, size: Object.freeze([0.58, 0.92, 0.58]), color: '#4c5a4a' }),
  tank: Object.freeze({ material: 'plastic', tris: 12, size: Object.freeze([0.86, 1.25, 0.86]), color: '#6b6f5e' }),
  woodpile: Object.freeze({ material: 'wood', tris: 12, size: Object.freeze([1.7, 0.78, 0.62]), color: '#6a5843' }),
  clothesline: Object.freeze({ material: 'wood', tris: 12, size: Object.freeze([2.1, 1.68, 0.16]), color: '#7a6a52' }),
});

export const YARD_KINDS = Object.freeze(Object.keys(YARD_KIT));
export const GROUND_STYLES = Object.freeze(['dirt', 'flagstone', 'tile']);
// Cuanto despega el patio de la casa, de la linea de fondo y de las cercas laterales.
export const YARD_CLEAR = Object.freeze({ house: 0.4, back: 0.3, side: 0.4 });

export const GROUND_PAINT = Object.freeze({
  dirt: Object.freeze({ base: '#4a4034', speck: '#413729', light: '#564b3d', specks: 420 }),
  flagstone: Object.freeze({ base: '#4e5250', joint: '#3a3e3c', light: '#5c605d', cols: 4, rows: 3 }),
  tile: Object.freeze({ base: '#565a5c', joint: '#42464a', light: '#61666a', cells: 8 }),
});

function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
const unit = salt => hash32(`yard#${salt}`) / 4294967296;
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// El rectangulo util del patio: detras de la cara trasera medida, adentro de las dos cercas laterales y
// sin tocar la linea de fondo. `deep` corre de la casa a la linea de fondo; `wide` es a lo ancho del lote.
export function yardRect(lot) {
  const fp = lot.footprint;
  const back = lot.back.value;
  // La cara trasera es la que MIRA a la linea de fondo, no la que tiene el mismo signo: en la fila sur
  // de la transversal la linea (19,5) es positiva y esta del lado de z MENOR, asi que un `back < 0` daba
  // la cara del frente y el rectangulo del patio se comia la casa entera. El patio salia igual porque el
  // chequeo de huella descartaba los intentos de adentro, pero BLOCK-004 se quedaba con un solo objeto.
  const lo = lot.back.axis === 'x' ? fp.minX : fp.minZ;
  const hi = lot.back.axis === 'x' ? fp.maxX : fp.maxZ;
  const houseFace = back < (lo + hi) / 2 ? lo : hi;
  const sign = Math.sign(back - houseFace) || 1;
  const deepFrom = houseFace + sign * YARD_CLEAR.house;
  const deepTo = back - sign * YARD_CLEAR.back;
  const wideFrom = lot.from + YARD_CLEAR.side, wideTo = lot.to - YARD_CLEAR.side;
  if (sign * (deepTo - deepFrom) <= 0.6 || wideTo - wideFrom <= 0.8) return null;
  return {
    axis: lot.back.axis, sign,
    deepFrom: +Math.min(deepFrom, deepTo).toFixed(3), deepTo: +Math.max(deepFrom, deepTo).toFixed(3),
    wideFrom: +wideFrom.toFixed(3), wideTo: +wideTo.toFixed(3),
  };
}

function boxOf(rect, deep, wide, size, turned) {
  // `size` es [largo, alto, fondo] de la pieza; `turned` la gira un cuarto sobre Y
  const along = turned ? size[2] : size[0], across = turned ? size[0] : size[2];
  const x = rect.axis === 'x' ? deep : wide, z = rect.axis === 'x' ? wide : deep;
  const halfX = rect.axis === 'x' ? across / 2 : along / 2;
  const halfZ = rect.axis === 'x' ? along / 2 : across / 2;
  return {
    x: +x.toFixed(3), z: +z.toFixed(3),
    box: {
      minX: +(x - halfX).toFixed(3), maxX: +(x + halfX).toFixed(3),
      minZ: +(z - halfZ).toFixed(3), maxZ: +(z + halfZ).toFixed(3),
    },
  };
}

export function yardProps(all = lots(), options = {}) {
  // Las cercas entran al `avoid` por defecto: el cierre del rincon NO corre por el borde de un lote,
  // cruza el fondo del lote de esquina -- medido, el cobertizo de HOME-004 nacia adentro de el.
  const { avoid = [], footprints = HOUSE_FOOTPRINTS, fences = LOT_FENCE_COLLIDERS } = options;
  const blocked = [...avoid, ...fences];
  const out = [];
  for (const lot of all) {
    const rect = yardRect(lot);
    if (!rect) continue;
    const wanted = 2 + (unit(`count:${lot.id}`) < 0.5 ? 1 : 0);
    // el orden de kinds rota con el lote, asi que dos vecinos no traen las mismas cosas
    const start = Math.floor(unit(`kind:${lot.id}`) * YARD_KINDS.length);
    let placed = 0;
    for (let step = 0; step < YARD_KINDS.length && placed < wanted; step++) {
      const kind = YARD_KINDS[(start + step) % YARD_KINDS.length];
      const spec = YARD_KIT[kind];
      // el aire acondicionado se pega a la pared; el resto se reparte hacia el fondo
      const wall = kind === 'ac';
      const turned = unit(`turn:${lot.id}:${kind}`) < 0.4;
      const depthSpan = rect.deepTo - rect.deepFrom, wideSpan = rect.wideTo - rect.wideFrom;
      let seated = null;
      for (let attempt = 0; attempt < 6 && !seated; attempt++) {
        const deepT = wall ? 0.06 : 0.25 + unit(`d:${lot.id}:${kind}:${attempt}`) * 0.7;
        const wideT = 0.12 + unit(`w:${lot.id}:${kind}:${attempt}`) * 0.76;
        const deep = rect.sign > 0 ? rect.deepFrom + deepT * depthSpan : rect.deepTo - deepT * depthSpan;
        const wide = rect.wideFrom + wideT * wideSpan;
        const seat = boxOf(rect, deep, wide, spec.size, turned);
        // el rectangulo util, ya en ejes de mundo: sobre X corre el "fondo" si el lote es de la
        // principal, y el "ancho" si es de la transversal
        const limits = rect.axis === 'x'
          ? { minX: rect.deepFrom, maxX: rect.deepTo, minZ: rect.wideFrom, maxZ: rect.wideTo }
          : { minX: rect.wideFrom, maxX: rect.wideTo, minZ: rect.deepFrom, maxZ: rect.deepTo };
        if (seat.box.minX < limits.minX || seat.box.maxX > limits.maxX
          || seat.box.minZ < limits.minZ || seat.box.maxZ > limits.maxZ) continue;
        if (footprints.some(fp => overlaps(seat.box, fp))) continue;
        if (blocked.some(a => overlaps(seat.box, a))) continue;
        if (out.some(p => overlaps(seat.box, p.box))) continue;
        seated = seat;
      }
      if (!seated) continue;
      out.push(Object.freeze({
        lot: lot.id, kind, material: spec.material, style: lot.style,
        x: seated.x, y: +(spec.size[1] / 2).toFixed(3), z: seated.z,
        rotationY: turned ? Math.PI / 2 : 0,
        size: spec.size, color: spec.color, box: Object.freeze(seated.box),
      }));
      placed++;
    }
  }
  return out;
}

export function yardGround(all = lots()) {
  const out = [];
  all.forEach((lot, index) => {
    const rect = yardRect(lot);
    if (!rect) return;
    const style = GROUND_STYLES[(index + Math.floor(unit(`ground:${lot.id}`) * 3)) % GROUND_STYLES.length];
    const deep = (rect.deepFrom + rect.deepTo) / 2, wide = (rect.wideFrom + rect.wideTo) / 2;
    const deepSpan = rect.deepTo - rect.deepFrom, wideSpan = rect.wideTo - rect.wideFrom;
    out.push(Object.freeze({
      lot: lot.id, style,
      x: +(rect.axis === 'x' ? deep : wide).toFixed(3),
      z: +(rect.axis === 'x' ? wide : deep).toFixed(3),
      width: +(rect.axis === 'x' ? deepSpan : wideSpan).toFixed(3),
      depth: +(rect.axis === 'x' ? wideSpan : deepSpan).toFixed(3),
    }));
  });
  return out;
}

// --- pintores del piso (deterministas, sin leer del contexto) --------------------------------------
function paintRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function paintGround(ctx, style, paint = GROUND_PAINT[style]) {
  const size = 128;
  ctx.fillStyle = paint.base;
  ctx.fillRect(0, 0, size, size);
  const random = paintRandom(style === 'dirt' ? 11 : style === 'flagstone' ? 22 : 33);
  if (style === 'dirt') {
    for (let i = 0; i < paint.specks; i++) {
      ctx.fillStyle = random() < 0.5 ? paint.speck : paint.light;
      ctx.fillRect(Math.round(random() * size), Math.round(random() * size), 2, 2);
    }
    return;
  }
  if (style === 'flagstone') {
    const w = size / paint.cols, h = size / paint.rows;
    for (let row = 0; row < paint.rows; row++) for (let col = 0; col < paint.cols; col++) {
      const offset = row % 2 ? w / 2 : 0;
      ctx.fillStyle = random() < 0.5 ? paint.light : paint.base;
      ctx.fillRect(Math.round(col * w + offset), Math.round(row * h), Math.round(w) - 3, Math.round(h) - 3);
    }
    ctx.fillStyle = paint.joint;
    for (let row = 0; row <= paint.rows; row++) ctx.fillRect(0, Math.round(row * h), size, 2);
    return;
  }
  const cell = size / paint.cells;
  for (let row = 0; row < paint.cells; row++) for (let col = 0; col < paint.cells; col++) {
    ctx.fillStyle = (row + col) % 2 ? paint.light : paint.base;
    ctx.fillRect(Math.round(col * cell), Math.round(row * cell), Math.ceil(cell), Math.ceil(cell));
  }
  ctx.fillStyle = paint.joint;
  for (let i = 0; i <= paint.cells; i++) {
    ctx.fillRect(Math.round(i * cell), 0, 1, size);
    ctx.fillRect(0, Math.round(i * cell), size, 1);
  }
}

// Todo el kit se dibuja con UNA caja instanciada y `instanceColor`: a esta escala y de noche, un
// cobertizo, un tanque y una pila de lena son cajas de distinto tamano y color. El tendedero es lo
// unico que no es una caja, asi que se expande a dos postes y tres panos -- que tambien son cajas.
export function yardBoxes(props = yardProps()) {
  const out = [];
  for (const prop of props) {
    if (prop.kind !== 'clothesline') {
      out.push(Object.freeze({ ...prop, width: prop.size[0], height: prop.size[1], depth: prop.size[2] }));
      continue;
    }
    const [span, height] = prop.size;
    const turned = prop.rotationY !== 0;
    const axis = turned ? 'z' : 'x';
    for (const sign of [-1, 1]) {
      out.push(Object.freeze({
        lot: prop.lot, kind: 'clothesline-post', material: 'wood', color: prop.color,
        x: +(prop.x + (axis === 'x' ? sign * span / 2 : 0)).toFixed(3),
        z: +(prop.z + (axis === 'z' ? sign * span / 2 : 0)).toFixed(3),
        y: +(height / 2).toFixed(3), rotationY: prop.rotationY,
        width: 0.09, height, depth: 0.09,
      }));
    }
    for (let cloth = 0; cloth < 3; cloth++) {
      const along = (cloth - 1) * (span / 3.4);
      out.push(Object.freeze({
        lot: prop.lot, kind: 'clothesline-cloth', material: 'cloth', color: cloth === 1 ? '#8f8a7a' : '#7d8486',
        x: +(prop.x + (axis === 'x' ? along : 0)).toFixed(3),
        z: +(prop.z + (axis === 'z' ? along : 0)).toFixed(3),
        y: +(height - 0.45).toFixed(3), rotationY: prop.rotationY,
        width: span / 4.6, height: 0.62, depth: 0.03,
      }));
    }
  }
  return out;
}

export function yardBoxMatrices(boxes = yardBoxes()) {
  const out = new Float32Array(boxes.length * 16);
  boxes.forEach((box, index) => {
    const cos = Math.cos(box.rotationY), sin = Math.sin(box.rotationY);
    const m = out.subarray(index * 16, index * 16 + 16);
    m[0] = cos * box.width; m[2] = -sin * box.width;
    m[5] = box.height;
    m[8] = sin * box.depth; m[10] = cos * box.depth;
    m[12] = box.x; m[13] = box.y; m[14] = box.z; m[15] = 1;
  });
  return out;
}
