// Sombras de contacto baratas: un disco radial generado por codigo (sin archivos nuevos
// en public/, sin canvas y sin DOM) que se usa como alphaMap de un plano negro.
export const CONTACT_SHADOW = Object.freeze({
  size: 64,
  innerStop: 0.24,
  outerStop: 1,
  peakAlpha: 214,
  rgb: Object.freeze([0, 0, 0]),
});

export function radialAlpha(distance01, innerStop, outerStop, peakAlpha) {
  if (!(distance01 < outerStop)) return 0;
  if (distance01 <= innerStop) return peakAlpha;
  const t = (distance01 - innerStop) / (outerStop - innerStop);
  const smooth = t * t * (3 - 2 * t);
  return Math.round(peakAlpha * (1 - smooth));
}

export function buildRadialAlphaPixels(shape = CONTACT_SHADOW) {
  const { size, innerStop, outerStop, peakAlpha, rgb } = { ...CONTACT_SHADOW, ...shape };
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const index = (y * size + x) * 4;
      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = radialAlpha(Math.hypot(dx, dy), innerStop, outerStop, peakAlpha);
    }
  }
  return data;
}

export function contactShadowPixels() {
  return buildRadialAlphaPixels(CONTACT_SHADOW);
}

export function contactShadowRadius(sizeX, sizeZ, spread = 0.62) {
  return Math.max(0.18, spread * Math.max(sizeX, sizeZ));
}

export function contactShadowOpacity(heightAboveGround, fadeMetres = 1.9, floor = 0.14) {
  if (!(heightAboveGround > 0)) return 1;
  return Math.max(floor, 1 - heightAboveGround / fadeMetres);
}
