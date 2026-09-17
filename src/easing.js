// Curvas de animacion del paquete E. Sin imports, sin DOM, sin THREE: cada funcion es determinista y
// se puede assertar con node:test.
//
// Este archivo nace con la Tarea 32 (balanceo y morph de las plantas), que es lo unico de E que esta
// colgado hoy. Las Tareas 30/31/33/36 le AGREGAN las suyas (mix, easeInCubic, easeOutCubic,
// easeInOutSine, easeOutBounce, damp, pulse): agregar exports al final, nunca reescribir estas tres.

export function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// Sin clamp: deja que easeOutBack se pase del objetivo a proposito.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutBack(t, overshoot = 1.70158) {
  // El corte en 0 no es decorativo: sin el, easeOutBack(0, 1.28) da -2.22e-16 (1 - 2.28 + 1.28 pierde
  // 1 ULP) y growScale(start, 0) devuelve start - 1e-16, o sea que la planta arranca el morph un pelo
  // fuera de su tamano de partida y el test de igualdad exacta falla.
  const c = clamp01(t);
  if (c <= 0) return 0;
  const x = c - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

// ── Tarea 30: la envolvente del gesto de la herramienta ─────────────────────
// El ataque sale rapido y frena (easeOutCubic: el golpe se siente seco, como una mano que llega) y la
// vuelta al reposo entra y sale suave (easeInOutSine: la herramienta no rebota al final). Las dos clampean,
// asi que un dt gigante despues de un alt-tab no manda el arma fuera de cuadro.

export function easeOutCubic(t) {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

// Escrita como (1 - cos)/2 y no como -(cos - 1)/2 a proposito: la segunda forma devuelve -0 en t<=0, y ese
// -0 se propaga hasta el hook de QA, donde un `-0` en la pose se lee como un bug que no existe.
export function easeInOutSine(t) {
  return (1 - Math.cos(Math.PI * clamp01(t))) / 2;
}

// ── Tarea 33: la salida del cogollo que se desprende ────────────────────────
// La contracara de easeOutCubic: arranca quieto y se acelera. El cogollo recien cortado no sale
// disparado, se suelta; y como la escala del vuelo usa esta misma curva, el cogollo conserva su
// tamano casi todo el trayecto y recien se achica al final, que es cuando ya esta lejos.
export function easeInCubic(t) {
  const x = clamp01(t);
  return x * x * x;
}

// ── Tarea 36a: la amortiguacion del droop ───────────────────────────────────
// Aproximacion exponencial al objetivo, independiente del frame rate: dos pasos de dt/2 dan EXACTAMENTE lo
// mismo que uno de dt, y un dt gigante de alt-tab aterriza en el objetivo sin pasarse. rate en 1/s: el 63 %
// del camino en 1/rate segundos, el 90 % en ln(10)/rate.
export function damp(current, target, rate, dt) {
  if (!(dt > 0) || !(rate > 0)) return current;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
