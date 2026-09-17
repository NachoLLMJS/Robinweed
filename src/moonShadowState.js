// Rig de la luna: una direccion fija y un encuadre de sombra que sigue al jugador
// pegado a la grilla de texels del shadow map (sin eso las sombras hierven al caminar).
export const MOON_RIG = Object.freeze({
  azimuthDeg: 145,
  elevationDeg: 38.8,
  distance: 62,
  extent: 45,
  mapSize: 2048,
  near: 0.5,
  far: 170,
  bias: -0.00055,
  normalBias: 0.035,
  // Radio del kernel de sombra, EN TEXELS. three 0.185 dio de baja PCFSoftShadowMap
  // (avisa por consola y usa PCFShadowMap), y su PCF muestrea un disco de Vogel de 5
  // taps cuyo radio es shadowRadius * texel. Con el 1 por defecto el kernel mide un
  // texel: no hay penumbra y el borde entra en escalera. 3 texels = 13 cm de penumbra
  // sobre un texel de 4,4 cm, y cuesta los mismos 5 taps.
  radius: 3,
});

export function moonOffset(rig = MOON_RIG) {
  const azimuth = (rig.azimuthDeg * Math.PI) / 180;
  const elevation = (rig.elevationDeg * Math.PI) / 180;
  return {
    x: Math.cos(elevation) * Math.cos(azimuth) * rig.distance,
    y: Math.sin(elevation) * rig.distance,
    z: Math.cos(elevation) * Math.sin(azimuth) * rig.distance,
  };
}

export function shadowTexelSize(rig = MOON_RIG) {
  return (2 * rig.extent) / rig.mapSize;
}

export function moonRigForCamera(cameraPosition, rig = MOON_RIG) {
  const texel = shadowTexelSize(rig);
  const targetX = Math.round(cameraPosition.x / texel) * texel;
  const targetZ = Math.round(cameraPosition.z / texel) * texel;
  const offset = moonOffset(rig);
  return {
    target: { x: targetX, y: 0, z: targetZ },
    light: { x: targetX + offset.x, y: offset.y, z: targetZ + offset.z },
  };
}
