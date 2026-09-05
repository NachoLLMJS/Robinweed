const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));

export const STREET_LAYOUT = Object.freeze({
  intersectionZ: 34,
  crossingZ: 12.2,
  houses: freezePoints([
    { x: 8.4, z: 18.44, height: 5.1, rotationY: -Math.PI / 2 },
    { x: 8.4, z: 25.14, height: 7.0, rotationY: -Math.PI / 2 },
  ]),
  grass: freezePoints([
    { x: -56, z: -10.325, width: 100, depth: 79.35 },
    { x: 56, z: -10.325, width: 100, depth: 79.35 },
    { x: -56, z: 69.325, width: 100, depth: 61.35 },
    { x: 56, z: 69.325, width: 100, depth: 61.35 },
    { x: -61, z: 34, width: 90, depth: 7.2 },
    { x: 61, z: 34, width: 90, depth: 7.2 },
  ]),
  crossCurbs: freezePoints([
    { x: -10.1, z: 29.88, width: 11.8, depth: 1.05 },
    { x: 10.1, z: 29.88, width: 11.8, depth: 1.05 },
    { x: -10.1, z: 38.12, width: 11.8, depth: 1.05 },
    { x: 10.1, z: 38.12, width: 11.8, depth: 1.05 },
  ]),
  lamps: freezePoints([
    { x: -4.55, z: 10.6 }, { x: 4.55, z: 12.4 },
    { x: -4.55, z: 20.4 }, { x: 4.55, z: 24.5 },
    { x: -4.55, z: 30.2 }, { x: 4.55, z: 37.2 },
  ]),
  trees: freezePoints([
    { x: 5.42, z: 16.1 }, { x: -5.42, z: 18.4 },
    { x: 5.42, z: 29.1 }, { x: -5.42, z: 37.1 },
  ]),
  shrubs: freezePoints([
    { x: -5.35, z: 9.7, rotationY: 0 },
    { x: 5.3, z: 23.6, rotationY: Math.PI },
    { x: -5.3, z: 33.5, rotationY: 0 },
  ]),
  van: Object.freeze({ x: -2.72, z: 12, height: 2.25, rotationY: Math.PI / 2, speed: 2.4 }),
  vehicleRoute: freezePoints([
    { x: -2.72, z: 12 }, { x: -2.72, z: 39 },
    { x: 2.72, z: 39 }, { x: 2.72, z: 12 },
  ]),
  loadingZone: Object.freeze({ x: 5.25, z: 9.65, height: 1.55, rotationY: -Math.PI / 2 }),
  furniture: Object.freeze({ x: -8.25, z: 20.5, height: 1.8, rotationY: Math.PI / 2 }),
  neighborOlder: Object.freeze({ x: 5.15, z: 25.25, height: 1.72, rotationY: -Math.PI / 2 }),
  cat: Object.freeze({ x: -5.08, z: 22.35, height: 0.52, rotationY: .35 }),
  obstacles: freezePoints([
    { minX: 4.55, maxX: 5.95, minZ: 8.85, maxZ: 10.45 },
    { minX: 5.98, maxX: 10.82, minZ: 14.82, maxZ: 22.06 },
    { minX: 5.98, maxX: 10.77, minZ: 22.02, maxZ: 28.26 },
  ]),
});

export function advanceVehicleRoute(state, dt, route, speed) {
  let segment = state.segment % route.length;
  let distance = state.distance + Math.max(0, dt) * speed;
  let start = route[segment];
  let end = route[(segment + 1) % route.length];
  let length = Math.hypot(end.x - start.x, end.z - start.z);
  while (distance >= length && length > 0) {
    distance -= length;
    segment = (segment + 1) % route.length;
    start = route[segment];
    end = route[(segment + 1) % route.length];
    length = Math.hypot(end.x - start.x, end.z - start.z);
  }
  const t = length ? distance / length : 0;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const routeHeading = Math.atan2(-dz, dx);
  const modelHeading = routeHeading + Math.PI;
  return {
    segment,
    distance,
    x: start.x + dx * t,
    z: start.z + dz * t,
    rotationY: Math.atan2(Math.sin(modelHeading), Math.cos(modelHeading)),
  };
}

export function advancePatrol(state, dt, min, max, speed) {
  let distance = state.distance + state.direction * speed * dt;
  let direction = state.direction;
  if (distance >= max) { distance = max; direction = -1; }
  if (distance <= min) { distance = min; direction = 1; }
  return { distance, direction };
}
