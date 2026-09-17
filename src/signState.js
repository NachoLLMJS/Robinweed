// src/signState.js
// El GLB del restaurante viene autorado como cartel roto: las letras del letrero
// son un unico mesh (nodo Cube.004_Material.004_0, mesh 16, material 13, 215 tris,
// mundo y=[3.05, 4.46]) y varias estan caidas dentro de la propia banda. No se puede
// recortar geometria ajena de forma testeable, asi que se lo enciende como neon roto:
// deja de leerse como bug y pasa a leerse como direccion de arte.
//
// El material 13 es el UNICO de los 22 del GLB con rojo saturado. El siguiente mas
// parecido es [0.515, 0.033, 0.004] (delta r = 0.285), muy fuera de la tolerancia.
// three guarda material.color en el espacio de trabajo LINEAL, que es exactamente
// el espacio de baseColorFactor, asi que se compara componente a componente.
export const RESTAURANT_SIGN_LINEAR_COLOR = Object.freeze({ r: 0.8, g: 0.091, b: 0.149 });

export function isRestaurantSignColor(color, tolerance = 0.06) {
  if (!color) return false;
  return Math.abs(color.r - RESTAURANT_SIGN_LINEAR_COLOR.r) <= tolerance
    && Math.abs(color.g - RESTAURANT_SIGN_LINEAR_COLOR.g) <= tolerance
    && Math.abs(color.b - RESTAURANT_SIGN_LINEAR_COLOR.b) <= tolerance;
}

// Parpadeo determinista: zumbido rapido permanente + cortes cortos cuando la
// portadora lenta pasa 0.88. Rango [0.2088, 1.45] con base 1.45.
// base 0 = apagado (devuelve 0 en todo instante): es el preset 0 de ?g60 (T49b),
// que promete el cartel como esta hoy.
export function neonFlicker(now, seed = 0, base = 1.45) {
  const gate = Math.sin(now * 0.00097 + seed * 2.13);
  const buzz = Math.sin(now * 0.021 + seed * 5.71);
  return Math.max(0, base * (gate > 0.88 ? 0.18 : 1) * (0.9 + 0.1 * buzz));
}
