export function movementAxes(yaw) {
  return {
    forward: { x: -Math.sin(yaw), z: -Math.cos(yaw) },
    right: { x: Math.cos(yaw), z: -Math.sin(yaw) },
  };
}

export function movementVector(yaw, held) {
  const { forward, right } = movementAxes(yaw);
  let x = 0;
  let z = 0;
  if (held('KeyW')) { x += forward.x; z += forward.z; }
  if (held('KeyS')) { x -= forward.x; z -= forward.z; }
  if (held('KeyD')) { x += right.x; z += right.z; }
  if (held('KeyA')) { x -= right.x; z -= right.z; }
  const length = Math.hypot(x, z);
  return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}
