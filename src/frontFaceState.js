// La cara del frente de cada casa A NIVEL DEL PISO, medida, para todo lo que se apoya delante de una casa.
//
// EL DEFECTO, medido el 2026-09-12 con scripts/measure-front-doors.mjs: `lot.front.value` es el borde del AABB del
// modelo, y el AABB lo fija el ALERO. En la casa C la pared esta 0,43 m mas adentro y su zocalo sobresale 0,10 de
// la pared: el delantal de ?suelo, anclado al AABB, terminaba **0,33 m antes de la pared** y dejaba una franja de
// pasto en sombra entre el pavimento y la casa. La misma leccion que el seto del rincon (0,38 m de rendija).
//
// `groundFaceFor(lot)` devuelve la cota de mundo, sobre el eje del frente, de lo que mas sobresale a nivel del
// piso en todo el frente (pared + zocalo, o el porche de la casa E, o la plataforma del infill 2). Para lotes sin
// medicion cae al AABB, que es lo que habia.
import { FRONT_DOOR_MAP } from './frontDoorMap.js';

export function frontMeasureFor(lot) {
  return FRONT_DOOR_MAP.get(lot.id ?? lot) ?? null;
}

export function groundFaceFor(lot) {
  const m = frontMeasureFor(lot);
  if (!m) return lot.front.value;
  return +(m.face + m.outward * m.groundPlinth).toFixed(3);
}

// Cuanto se recupera respecto del AABB, para el gate: positivo = el frente medido esta mas adentro que el AABB.
export function eaveOverhangFor(lot) {
  return +Math.abs(groundFaceFor(lot) - lot.front.value).toFixed(3);
}
