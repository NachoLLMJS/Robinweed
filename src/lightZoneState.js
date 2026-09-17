// Cada luz pertenece a una sala y solo se dibuja cuando el jugador esta en ella.
// Hoy las 42 luces estan encendidas en todas partes: desde la calle se paga el costo
// por fragmento de las 12 del galpon y de las 5 de los interiores.
export const LIGHT_ZONES = Object.freeze([
  'street',
  'warehouse',
  'shop-interior',
  'house-interior',
  'restaurant-interior',
]);

export function lightZoneVisible(zone, location) {
  return zone === location;
}

export const GROW_LIGHT = Object.freeze({
  color: 0xb6ff74,
  intensity: 26,
  distance: 4.6,
  decay: 1.55,
  angle: 0.62,
  penumbra: 0.55,
  height: 2.93,
  targetY: 0.86,
  pulseAmplitude: 1.6,
  pulseRate: 0.0017,
});

export const ROOM_LIGHT = Object.freeze({ color: 0xffe3b5, intensity: 9, distance: 11, decay: 1.9 });
export const LOADING_DOOR_LIGHT = Object.freeze({ color: 0xb9ff9a, intensity: 6.5, distance: 7.5, decay: 1.9 });
export const INTERIOR_LAMP = Object.freeze({ shopColor: 0xb9ff83, houseColor: 0xffd6a0, intensity: 11, distance: 11, decay: 1.9 });
export const RESTAURANT_LIGHT = Object.freeze({ color: 0xffb56b, intensity: 9.5, distance: 15, decay: 1.85 });
export const RESTAURANT_EXIT_LIGHT = Object.freeze({ color: 0x84ff52, intensity: 6, distance: 7, decay: 1.9 });

export const LEGACY_FIXTURES = Object.freeze({
  grow: Object.freeze({ intensity: 6.4, distance: 4.6, decay: 1.8 }),
  room: Object.freeze({ intensity: 3.2, distance: 8, decay: 2 }),
  interiorLamp: Object.freeze({ intensity: 7, distance: 9, decay: 2 }),
  restaurant: Object.freeze({ intensity: 4.8, distance: 13, decay: 2 }),
});

// El cultivo de HOY, para el preset 0: ocho PointLight verdes colgadas del techo, una por
// mesa, siempre encendidas en toda ubicacion. Ojo con la intensidad: la constructora pone
// 6.4 y el bucle de frame la PISA a 7.2 +/- 0.35, asi que lo que ve el jugador es el pulso,
// no el 6.4. Un preset 0 que copiara solo la constructora ya saldria un 11% oscuro.
export const LEGACY_GROW_LIGHT = Object.freeze({
  color: 0xaaff69,
  intensity: 6.4,
  distance: 4.6,
  decay: 1.8,
  height: 2.93,
  pulseBase: 7.2,
  pulseAmplitude: 0.35,
  pulseRate: 0.0017,
});

export function legacyGrowPulse(index, nowMs, rig = LEGACY_GROW_LIGHT) {
  return rig.pulseBase + Math.sin(nowMs * rig.pulseRate + index) * rig.pulseAmplitude;
}

export function growLightPulse(index, nowMs, rig = GROW_LIGHT) {
  return rig.intensity + Math.sin(nowMs * rig.pulseRate + index) * rig.pulseAmplitude;
}

// Radio del charco que deja un cono en el plano de la mesa.
export function spotGroundRadius(angleRad, dropMetres) {
  return Math.tan(angleRad) * dropMetres;
}

export function growLightPoolRadius(rig = GROW_LIGHT) {
  return spotGroundRadius(rig.angle, rig.height - rig.targetY);
}

// --- Look de cultivo -------------------------------------------------------
// Las lamparas de cultivo reales no son verdes: son LED de espectro completo
// (blanco frio con pico rojo/azul, que a ojo lee MAGENTA) o barras blancas de
// horticultura. El verde 0xaaff69 que hay hoy es el color de un tubo de neon,
// no el de una sala de cultivo. Es una perilla: se entregan las tres.
export const GROW_LIGHT_PRESETS = Object.freeze({
  // 0 — lo que hay hoy, para comparar.
  legacy: Object.freeze({ id: 'legacy', label: 'NEON GREEN', color: 0xaaff69, bloomColor: 0xaaff69, intensity: 26, glassEmissive: 0x86ff3c }),
  // 1 — LED de espectro completo: el look de foto de grow room.
  magenta: Object.freeze({ id: 'magenta', label: 'FULL SPECTRUM', color: 0xff6ad5, bloomColor: 0xff8ae0, intensity: 30, glassEmissive: 0xff4fc8 }),
  // 2 — barra blanca de horticultura, la mas neutra: deja ver el verde real de la planta.
  white: Object.freeze({ id: 'white', label: 'WHITE BAR', color: 0xfff2e2, bloomColor: 0xffffff, intensity: 22, glassEmissive: 0xfff6ec }),
});

export const GROW_LIGHT_PRESET_IDS = Object.freeze(Object.keys(GROW_LIGHT_PRESETS));

export function growLightPreset(id) {
  return GROW_LIGHT_PRESETS[id] ?? GROW_LIGHT_PRESETS.magenta;
}

// Cono con el preset elegido: solo cambian color e intensidad, la geometria del
// cono (angulo, penumbra, altura) NO se toca — es lo que hace que el charco caiga
// justo sobre la mesa y ya esta medido.
export function growLightRig(presetId, base = GROW_LIGHT) {
  const preset = growLightPreset(presetId);
  return { ...base, color: preset.color, intensity: preset.intensity, glassEmissive: preset.glassEmissive, presetId: preset.id };
}

// Volumetrico barato: en vez de raymarching, un cono de malla transparente con
// el mismo angulo que la luz. Es 1 draw call por lampara y NO escribe profundidad.
export const GROW_CONE = Object.freeze({
  opacityTop: 0.16,
  opacityBottom: 0,
  radialSegments: 12,
  openEnded: true,
  depthWrite: false,
  renderOrder: 3,
});

export function growConeGeometry(rig = GROW_LIGHT) {
  const height = rig.height - rig.targetY;
  return { radiusTop: 0.06, radiusBottom: spotGroundRadius(rig.angle, height), height, centerY: rig.targetY + height / 2 };
}

// El artefacto NO es un punto: es un panel colgado, y su cara inferior esta MEDIDA en el
// GLB de Meshy -- su caja arranca en y=3.08 y llega a 3.98. La SpotLight, en cambio, vive a
// 2.93. Dibujar el haz desde la luz deja 15 cm de aire entre la lampara y el haz, que a
// dos metros de camara se leen como un haz flotando solo. El haz nace en el panel.
export const GROW_EMITTER = Object.freeze({
  y: 3.06,
  halfWidth: 0.46,
  halfDepth: 0.13,
  thickness: 0.03,
});

// Perfil del haz. Horizontal: la integral optica a traves de un cono es un semicirculo, asi
// que el borde se apaga solo en vez de cortar en seco -- eso es lo que delataba la geometria.
// Vertical: mas denso junto al panel, con un piso para que el charco sobre la mesa no
// desaparezca. Va en el canal ALFA y se usa con `map`, NO con `alphaMap`: three samplea
// alphaMap del canal VERDE, y una rampa escrita en alfa con alphaMap sale solida.
export const GROW_SHAFT = Object.freeze({
  width: 64,
  height: 32,
  peak: 0.30,
  edgeExponent: 1.7,
  bottomFade: 0.14,
  renderOrder: 3,
});

export function shaftAcross(u, profile = GROW_SHAFT) {
  const x = u * 2 - 1;
  return Math.pow(Math.max(0, 1 - x * x), profile.edgeExponent / 2);
}

export function shaftAlong(v, profile = GROW_SHAFT) {
  return profile.bottomFade + (1 - profile.bottomFade) * v;
}

// RGBA plano para una DataTexture: blanco en RGB (lo tine material.color, que es lo que
// mueve el preset de cultivo) y el perfil en alfa.
export function buildShaftAlpha(profile = GROW_SHAFT) {
  const pixels = new Uint8Array(profile.width * profile.height * 4);
  for (let row = 0; row < profile.height; row++) {
    const along = shaftAlong(profile.height === 1 ? 1 : row / (profile.height - 1), profile);
    for (let column = 0; column < profile.width; column++) {
      const across = shaftAcross((column + 0.5) / profile.width, profile);
      const index = (row * profile.width + column) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(255 * profile.peak * across * along);
    }
  }
  return pixels;
}

// El haz que se DIBUJA: del panel (GROW_EMITTER.y) a la mesa (rig.targetY), y su pie mide
// exactamente el charco de la luz -- sale de growConeGeometry, no de un numero aparte.
export function growShaftGeometry(rig = GROW_LIGHT, emitter = GROW_EMITTER) {
  const cone = growConeGeometry(rig);
  const height = emitter.y - rig.targetY;
  return {
    topWidth: emitter.halfWidth * 2,
    bottomWidth: cone.radiusBottom * 2,
    height,
    centerY: rig.targetY + height / 2,
  };
}
