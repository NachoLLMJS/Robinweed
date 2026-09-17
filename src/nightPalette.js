// Grade nocturno. Los albedos estan back-solveados contra la iluminacion nueva
// para que el pasto deje de ser fluorescente y la vereda deje de ser lo mas
// brillante del cuadro, sin que nada caiga a negro puro.
export const NIGHT_PALETTE = Object.freeze({
  hemiSky: 0x33496a,
  hemiGround: 0x0f1512,
  hemiIntensity: 0.62,
  ambient: 0x223044,
  ambientIntensity: 0.3,
  moon: 0xc9dcff,
  moonIntensity: 1.5,
  grassA: 0x606e48,
  grassB: 0x5b6946,
  road: 0x535149,
  curb: 0x818276,
  streetEmissive: 0.045,
});

export const LEGACY_PALETTE = Object.freeze({
  hemiSky: 0xb9d49c,
  hemiGround: 0x182015,
  hemiIntensity: 1.85,
  ambient: 0xfff4df,
  ambientIntensity: 0.38,
  moon: 0xb6cbff,
  moonIntensity: 1.6,
  grassA: 0x2f7429,
  grassB: 0x356f2b,
  road: 0x242827,
  curb: 0x999d91,
  streetEmissive: 0.12,
});

const RECIPROCAL_PI = 1 / Math.PI;

export function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function linearFromHex(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(value => srgbToLinear(value / 255));
}

export function relativeLuminance(linear) {
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

// Irradiancia que recibe una superficie horizontal: ambiente + hemisferica (peso 1
// mirando arriba) + la luna proyectada por su elevacion. Es la misma cuenta que
// hace three en lights_fragment_begin.
export function upwardIrradiance(palette = NIGHT_PALETTE, moonElevationDeg = 38.8) {
  const ambient = linearFromHex(palette.ambient).map(v => v * palette.ambientIntensity);
  const hemi = linearFromHex(palette.hemiSky).map(v => v * palette.hemiIntensity);
  const cosine = Math.sin((moonElevationDeg * Math.PI) / 180);
  const moon = linearFromHex(palette.moon).map(v => v * palette.moonIntensity * cosine);
  return [0, 1, 2].map(i => ambient[i] + hemi[i] + moon[i]);
}

export function lambertResponse(irradiance, albedoHex) {
  const albedo = linearFromHex(albedoHex);
  return [0, 1, 2].map(i => irradiance[i] * albedo[i] * RECIPROCAL_PI);
}

export function pointLightIrradiance(lamp, metres) {
  let falloff = 1 / Math.max(Math.pow(metres, lamp.decay), 0.01);
  if (lamp.distance > 0) {
    const window = Math.max(0, Math.min(1, 1 - Math.pow(metres / lamp.distance, 4)));
    falloff *= window * window;
  }
  return linearFromHex(lamp.color).map(v => v * lamp.intensity * falloff);
}

// Cuanto mas brillante queda la vereda dentro del charco que fuera de el.
// Debajo de ~1,5 el charco no se lee y el farol parece pintado.
export function lampPoolContrast(lamp, groundMetres, palette = NIGHT_PALETTE) {
  const irradiance = upwardIrradiance(palette);
  const ambientOnly = lambertResponse(irradiance, palette.curb);
  const slant = Math.hypot(groundMetres, lamp.height);
  const pool = lambertResponse(pointLightIrradiance(lamp, slant), palette.curb);
  const lit = [0, 1, 2].map(i => ambientOnly[i] + pool[i]);
  return relativeLuminance(lit) / relativeLuminance(ambientOnly);
}
