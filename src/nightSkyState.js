// Cielo: luna con halo alineada con la luz que proyecta las sombras, estrellas que
// existen en pantalla (hoy miden 0,46 px) y nubes mas claras que el cielo.
// Todo el grupo se apaga cuando el jugador no esta en la calle: el campo de estrellas
// sigue a la camara y hoy se cuela por la rendija del techo del restaurante.
import { MOON_RIG, moonOffset } from './moonShadowState.js';

export const NIGHT_SKY = Object.freeze({
  moonDistance: 210,
  moonRadius: 6.2,
  moonColor: 0xf6f2da,
  haloRadius: 26,
  haloTint: Object.freeze([176, 200, 255]),
  haloPeakAlpha: 96,
  haloInnerStop: 0.12,
  haloSize: 128,
  starSize: 0.24,
  starColor: 0xdce9ff,
  starOpacity: 0.92,
  starSpriteSize: 32,
  starSpriteTint: Object.freeze([255, 255, 255]),
  starSpritePeakAlpha: 255,
  starSpriteInnerStop: 0.18,
  cloudColor: 0x232c3a,
  cloudOpacity: 0.72,
  cloudDriftX: 42,
  clouds: Object.freeze([
    Object.freeze([-24, 21, 34, 3.2]),
    Object.freeze([9, 25, 47, 4.1]),
    Object.freeze([-8, 30, 66, 4.8]),
    Object.freeze([27, 23, 82, 3.6]),
    Object.freeze([-31, 28, 96, 4.4]),
    Object.freeze([14, 33, 118, 5.2]),
    Object.freeze([-15, 19, 12, 2.9]),
  ]),
});

// El pixel de una estrella con sizeAttenuation es size * (altoCanvas/2) / distancia.
export function starPixelSize(size, canvasHeight, radius) {
  return (size * (canvasHeight / 2)) / radius;
}

export function moonDiscPosition(cameraPosition, sky = NIGHT_SKY, rig = MOON_RIG) {
  const offset = moonOffset(rig);
  const length = Math.hypot(offset.x, offset.y, offset.z);
  const scale = sky.moonDistance / length;
  return {
    x: cameraPosition.x + offset.x * scale,
    y: cameraPosition.y + offset.y * scale,
    z: cameraPosition.z + offset.z * scale,
  };
}

export function driftCloudX(x, dt, speed, halfSpan = NIGHT_SKY.cloudDriftX) {
  let next = x + dt * speed;
  if (next > halfSpan) next -= halfSpan * 2;
  return next;
}
