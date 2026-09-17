// El suelo de la ciudad era COLOR PLANO: `new MeshStandardMaterial({color})` sin `map`, ni en el
// pasto, ni en la calzada, ni en el cordon. Como el pasto cubre casi toda el area caminable, el juego
// se leia como una alfombra verde lisa con casas encima -- que es exactamente lo que dijo Jose:
// "el cesped verde debajo de las casas que se extiende por mucha parte del mapa".
//
// Estas texturas se pintan en ESCALA DE GRISES alrededor de 1,0 y el material conserva su `color`, que
// es el que `applyLighting` re-tine en cada preset. Asi el grano aparece sin mover un solo tono de la
// paleta del paquete A, que Jose ya aprobo: la media de cada pintura es 1,0 por construccion.

// Cuantos metros cubre una repeticion de cada textura. Un cesped con el patron repitiendo cada 40 cm
// se lee como cesped; cada 8 m, como una mancha.
export const GROUND_REPEAT = Object.freeze({ grass: 2.2, road: 4.5, curb: 1.6 });
export const GROUND_TEXTURE_SIZE = 128;

// Ruido determinista: la misma ciudad en cada carga y en cada maquina.
function noise(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// El `map` MULTIPLICA el albedo, y la textura se lee en sRGB: un gris 128 vale 0,216 en lineal, o sea
// que oscureceria el suelo a la quinta parte. El neutro es el BLANCO, y toda variacion baja desde ahi.
// Por eso el `map` es suave y quien pone el relieve es el `bumpMap`, que no toca el color.
const NEUTRAL = 255;
const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const grey = value => {
  const v = Math.max(0, Math.min(255, Math.round(NEUTRAL * value)));
  return `rgb(${v},${v},${v})`;
};

// Media de la pintura EN LINEAL, que es como three la consume. 1,0 = no cambia el tono del preset.
export function meanLuma(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += srgbToLinear(data[i] / 255);
  return sum / (data.length / 4);
}

// --- pasto ------------------------------------------------------------------------------------
// Matas cortas en dos sentidos y unas pocas calvas: a la distancia da grano, de cerca da direccion.
export function paintGrass(ctx, size = GROUND_TEXTURE_SIZE) {
  const random = noise(20260911);
  ctx.fillStyle = grey(1);
  ctx.fillRect(0, 0, size, size);
  // las matas: lineas cortas mas claras y mas oscuras, equilibradas para no mover la media
  for (let i = 0; i < 1400; i++) {
    const x = random() * size, y = random() * size;
    const long = 2 + random() * 4;
    const up = random() < 0.5;
    ctx.strokeStyle = grey(i % 2 === 0 ? 1 - 0.020 * random() : 1 - 0.055 * random());
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (up ? long * 0.35 : -long * 0.35), y - long);
    ctx.stroke();
  }
  // parches: zonas apenas mas gastadas, otras mas tupidas, en igual cantidad
  for (let i = 0; i < 26; i++) {
    const x = random() * size, y = random() * size, r = 5 + random() * 13;
    ctx.fillStyle = grey(i % 2 === 0 ? 1 - 0.045 * random() : 1 - 0.010 * random());
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- calzada ----------------------------------------------------------------------------------
// Asfalto: grano fino, algun parche de reparacion y un par de grietas.
export function paintRoad(ctx, size = GROUND_TEXTURE_SIZE) {
  const random = noise(776655);
  ctx.fillStyle = grey(1);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(random() * size), y = Math.floor(random() * size);
    ctx.fillStyle = grey(i % 2 === 0 ? 1 - 0.015 * random() : 1 - 0.050 * random());
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = random() * size, y = random() * size;
    ctx.fillStyle = grey(i % 2 === 0 ? 1 - 0.05 : 1 - 0.012);
    ctx.fillRect(x, y, 12 + random() * 22, 9 + random() * 16);
  }
  ctx.strokeStyle = grey(0.88);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = random() * size, y = random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 7; step++) { x += (random() - 0.5) * 16; y += (random() - 0.5) * 16; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // y el mismo claro que compensa lo que las grietas restaron
  ctx.strokeStyle = grey(0.99);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();
}

// --- cordon -----------------------------------------------------------------------------------
// Losas de hormigon con junta: sin la junta, el cordon es una barra de color.
export function paintCurb(ctx, size = GROUND_TEXTURE_SIZE) {
  const random = noise(313131);
  ctx.fillStyle = grey(1);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) {
    const x = Math.floor(random() * size), y = Math.floor(random() * size);
    ctx.fillStyle = grey(i % 2 === 0 ? 1 - 0.012 * random() : 1 - 0.042 * random());
    ctx.fillRect(x, y, 1, 1);
  }
  const slab = size / 4;
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = grey(0.80);
    ctx.fillRect(Math.round(i * slab), 0, 1, size);
    ctx.fillStyle = grey(0.99);                      // el canto iluminado al lado de la junta
    ctx.fillRect(Math.round(i * slab) + 1, 0, 1, size);
  }
}

export const GROUND_PAINTERS = Object.freeze({ grass: paintGrass, road: paintRoad, curb: paintCurb });
