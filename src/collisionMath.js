const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function overlaps(x, z, obstacle, radius) {
  return x > obstacle.minX - radius && x < obstacle.maxX + radius &&
    z > obstacle.minZ - radius && z < obstacle.maxZ + radius;
}

export function moveCircle(position, delta, obstacles, bounds, radius) {
  let x = clamp(position.x + delta.x, bounds.minX + radius, bounds.maxX - radius);
  let z = position.z;
  if (obstacles.some(obstacle => overlaps(x, z, obstacle, radius))) x = position.x;

  z = clamp(position.z + delta.z, bounds.minZ + radius, bounds.maxZ - radius);
  if (obstacles.some(obstacle => overlaps(x, z, obstacle, radius))) z = position.z;
  return { x, z };
}
