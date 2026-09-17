// Cierre del horizonte: domo con degrade, niebla del color del horizonte y un anillo
// de siluetas. El domo y las siluetas se dibujan con toneMapped:false, asi que el hex
// autorado ES el pixel en pantalla. La niebla SI pasa por ACES, por eso su color esta
// back-solveado para verse igual que el horizonte del domo.
export const HORIZON = Object.freeze({
  zenith: 0x060a12,
  horizon: 0x1a2230,
  fogColor: 0x272e39,
  fogDensity: 0.0125,
  cameraFar: 260,
  domeRadius: 240,
  gradientHeight: 128,
  gradientCurve: 0.6,
  skyline: Object.freeze({
    color: 0x0f1622,
    count: 96,
    radius: 172,
    radiusJitter: 26,
    minWidth: 9,
    maxWidth: 26,
    minHeight: 9,
    maxHeight: 34,
    seed: 20260909,
  }),
});

export function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(channel) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

// El degrade se mezcla en lineal: mezclarlo en sRGB deja una banda sucia en el medio.
export function mixHexLinear(fromHex, toHex, amount) {
  const out = [];
  for (let shift = 16; shift >= 0; shift -= 8) {
    const a = srgbToLinear((((fromHex >> shift) & 255) / 255));
    const b = srgbToLinear((((toHex >> shift) & 255) / 255));
    out.push(Math.round(linearToSrgb(a + (b - a) * amount) * 255));
  }
  return out;
}

// Fila 0 = horizonte (uv.y 0, base de la esfera), ultima fila = cenit.
export function buildSkyGradientPixels(config = HORIZON) {
  const height = config.gradientHeight;
  const data = new Uint8Array(height * 4);
  for (let row = 0; row < height; row++) {
    const t = Math.pow(row / (height - 1), config.gradientCurve);
    const [r, g, b] = mixHexLinear(config.horizon, config.zenith, t);
    const index = row * 4;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
  }
  return data;
}

export function buildSkylineBlocks(config = HORIZON.skyline) {
  const blocks = [];
  let seed = config.seed >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const step = (Math.PI * 2) / config.count;
  for (let index = 0; index < config.count; index++) {
    const angle = index * step + (random() - 0.5) * step * 0.6;
    const width = config.minWidth + random() * (config.maxWidth - config.minWidth);
    const height = config.minHeight + random() * (config.maxHeight - config.minHeight);
    const radius = config.radius + (random() - 0.5) * config.radiusJitter;
    blocks.push({ angle, radius, width, height, depth: width * 0.7 });
  }
  return blocks;
}

export function fogVisibility(metres, density = HORIZON.fogDensity) {
  return Math.exp(-Math.pow(metres * density, 2));
}
