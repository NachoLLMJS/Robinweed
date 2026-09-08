const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));

export const STREET_LAYOUT = Object.freeze({
  intersectionZ: 34,
  crossingZ: 12.2,
  crossStreet: Object.freeze({ x: 0, z: 34, width: 108, depth: 7.2 }),
  houses: freezePoints([
    { x: 8.4, z: 18.44, height: 5.1, rotationY: -Math.PI / 2 },
    { x: 8.4, z: 25.14, height: 7.0, rotationY: -Math.PI / 2 },
    { x: 9.675, z: 42, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.525, z: 50.15, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.525, z: 42.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.675, z: 49.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.675, z: 57.9, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: -9.525, z: 57.8, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.675, z: 65.2, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.525, z: 65.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseD' },
    { x: -9.525, z: 72.5, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseD' },
    { x: 9.675, z: 72.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseC' },
    { x: 9.675, z: 80, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'simpleHouseE' },
    { x: -9.675, z: 80, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseF' },
    { x: 9.525, z: 87.5, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseG' },
    { x: -9.675, z: 87.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseH' },
    { x: 9.675, z: 95, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseF' },
    { x: -9.675, z: 94.8, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseE' },
    { x: 9.675, z: 102.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseH' },
    { x: -9.525, z: 102.4, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseG' },
  ]),
  branchHouses: freezePoints([
    { x: -46, z: 42.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseF' },
    { x: -37, z: 42.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'simpleHouseE' },
    { x: -20, z: 42.6, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseG' },
    { x: -46, z: 25.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'simpleHouseH' },
    { x: -37, z: 25.6, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: 0, asset: 'simpleHouseG' },
    { x: -20, z: 25.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'simpleHouseF' },
    { x: 18, z: 42.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseH' },
    { x: 47, z: 42.4, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'simpleHouseF' },
    { x: 18, z: 25.6, height: 5.15, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI / 2, asset: 'simpleHouseE' },
    { x: 47, z: 25.6, height: 7.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: 0, asset: 'simpleHouseG' },
  ]),
  infillHouses: freezePoints([
    { x: -28.5, z: 42.4, height: 5.5, maxWidthX: 6.5, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'infillHouse1' },
    { x: -28.5, z: 25.6, height: 5.5, maxWidthX: 6.5, maxDepthZ: 6.5, groundY: .03, rotationY: -Math.PI / 2, asset: 'infillHouse2' },
    { x: 27, z: 25.6, height: 5.8, maxWidthX: 6.5, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'infillHouse3' },
    { x: 37, z: 25.6, height: 5.5, maxWidthX: 6.5, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'infillHouse4' },
    { x: -10, z: 20.5, height: 6.2, maxWidthX: 7.4, maxDepthZ: 8.8, groundY: .02, rotationY: -Math.PI / 2, asset: 'infillHouse5' },
  ]),
  cityPackBuildings: freezePoints([
    { x: -10, z: 22.5, height: 12.2, maxWidthX: 7.4, maxDepthZ: 8.8, groundY: .02, rotationY: Math.PI / 2, asset: 'cityPackMotel', replaces: 'infillHouse5' },
    { x: 9.2, z: 18.44, height: 6, maxWidthX: 6.4, maxDepthZ: 7.2, groundY: .03, rotationY: Math.PI, asset: 'cityPackKfc', replaces: 'simpleHouseA' },
    { x: -9.525, z: 102.4, height: 28, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: -Math.PI / 2, asset: 'cityPackHighrise', replaces: 'simpleHouseG' },
    { x: 47, z: 42.4, height: 11, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: Math.PI, asset: 'cityPackResidential', replaces: 'simpleHouseF' },
    { x: -46, z: 25.6, height: 12, maxWidthX: 6.65, maxDepthZ: 6.5, groundY: .03, rotationY: 0, asset: 'cityPackCommercialTower', replaces: 'simpleHouseH' },
    { x: -37, z: 25.6, height: 6.2, maxWidthX: 6.55, maxDepthZ: 7.1, groundY: .03, rotationY: 0, asset: 'cityPackCommercialPurple', replaces: 'simpleHouseG' },
    { x: -37, z: 42.4, height: 5.6, maxWidthX: 7.3, maxDepthZ: 7.5, groundY: .03, rotationY: -Math.PI / 2, scaleY: 1.4, asset: 'cityPackDiner', replaces: 'simpleHouseE' },
  ]),
  grass: freezePoints([
    { x: -56, z: -10.325, width: 100, depth: 79.35 },
    { x: 56, z: -10.325, width: 100, depth: 79.35 },
    { x: -56, z: 74.575, width: 100, depth: 71.85 },
    { x: 56, z: 74.575, width: 100, depth: 71.85 },
  ]),
  crossCurbs: freezePoints([
    { x: -29.1, z: 29.88, width: 49.8, depth: 1.05 },
    { x: 29.1, z: 29.88, width: 49.8, depth: 1.05 },
    { x: -29.1, z: 38.12, width: 49.8, depth: 1.05 },
    { x: 29.1, z: 38.12, width: 49.8, depth: 1.05 },
  ]),
  lamps: freezePoints([
    { x: -5.1, z: 10.6 }, { x: 5.1, z: 12.4 },
    { x: -5.1, z: 20.4 },
    { x: -5.1, z: 46.2 }, { x: 5.1, z: 53.8 },
    { x: -5.1, z: 61.4 }, { x: 5.1, z: 69 }, { x: -5.1, z: 76.6 },
    { x: 5.1, z: 84.2 }, { x: -5.1, z: 91.8 },
    { x: 5.1, z: 99.4 }, { x: -5.1, z: 106.4 },
    { x: -48, z: 29.88 }, { x: -32, z: 38.12 }, { x: -16, z: 29.88 },
    { x: 16, z: 38.12 }, { x: 32, z: 29.88 }, { x: 48, z: 38.12 },
  ]),
  trees: freezePoints([
    { x: -17, z: 9.5 },
    { x: -14.2, z: 43 }, { x: 14.2, z: 57.5 },
    { x: -14.2, z: 65 }, { x: 14.2, z: 73 },
    { x: -14.2, z: 87.4 }, { x: 14.2, z: 102.4 },
  ]),
  shrubs: freezePoints([
    { x: -5.35, z: 9.7, rotationY: 0 },
    { x: 5.3, z: 23.6, rotationY: Math.PI },
  ]),
  restaurant: Object.freeze({ x: 32, z: 44.15, height: 5.2, maxWidthX: 13.5, maxDepthZ: 10, groundY: .03, rotationY: Math.PI }),
  van: Object.freeze({ x: -2.72, z: 12, height: 2.25, rotationY: Math.PI / 2, speed: 2.4 }),
  vehicleRoute: freezePoints([
    { x: -2.72, z: 12 }, { x: -2.72, z: 107 },
    { x: 2.72, z: 107 }, { x: 2.72, z: 12 },
  ]),
  loadingZone: Object.freeze({ x: 5.25, z: 9.65, height: 1.55, rotationY: -Math.PI / 2 }),
  furniture: Object.freeze({ x: -10.5, z: 10.5, height: 1.8, rotationY: Math.PI / 2 }),
  neighborOlder: Object.freeze({ x: 5.15, z: 25.25, height: 1.72, rotationY: -Math.PI / 2 }),
  househead: Object.freeze({ x: -5.1, z: 18.15, height: 1.55, rotationY: Math.PI / 2 }),
  foxWalker: Object.freeze({ x: -4.45, minZ: 42, maxZ: 96, height: 1.8, speed: 1.05 }),
  neonCatWalker: Object.freeze({ x: 4.45, minZ: 55.5, maxZ: 66.8, height: 1.8, speed: .95 }),
  cat: Object.freeze({ x: -5.08, z: 22.35, height: 0.52, rotationY: .35 }),
  obstacles: freezePoints([
    { minX: 4.55, maxX: 5.95, minZ: 8.85, maxZ: 10.45 },
    { minX: 6.00, maxX: 12.40, minZ: 16.14, maxZ: 20.74 },
    { minX: 5.98, maxX: 10.77, minZ: 22.02, maxZ: 28.26 },
    { minX: 6.25, maxX: 13.00, minZ: 38.75, maxZ: 45.25 },
    { minX: 6.25, maxX: 12.80, minZ: 46.60, maxZ: 53.70 },
    { minX: -12.80, maxX: -6.25, minZ: 38.85, maxZ: 45.95 },
    { minX: -13.00, maxX: -6.35, minZ: 46.35, maxZ: 52.85 },
    { minX: 6.35, maxX: 13.00, minZ: 54.65, maxZ: 61.15 },
    { minX: -12.80, maxX: -6.25, minZ: 54.25, maxZ: 61.35 },
    { minX: -13.00, maxX: -6.35, minZ: 61.95, maxZ: 68.45 },
    { minX: 6.25, maxX: 12.80, minZ: 61.85, maxZ: 68.95 },
    { minX: -12.80, maxX: -6.25, minZ: 68.95, maxZ: 76.05 },
    { minX: 6.35, maxX: 13.00, minZ: 69.35, maxZ: 75.85 },
    { minX: 6.35, maxX: 13.00, minZ: 76.75, maxZ: 83.25 },
    { minX: -13.00, maxX: -6.35, minZ: 76.75, maxZ: 83.25 },
    { minX: 6.25, maxX: 12.80, minZ: 83.95, maxZ: 91.05 },
    { minX: -13.00, maxX: -6.35, minZ: 84.15, maxZ: 90.65 },
    { minX: 6.35, maxX: 13.00, minZ: 91.75, maxZ: 98.25 },
    { minX: -13.00, maxX: -6.35, minZ: 91.55, maxZ: 98.05 },
    { minX: 6.35, maxX: 13.00, minZ: 99.15, maxZ: 105.65 },
    { minX: -12.80, maxX: -6.25, minZ: 98.85, maxZ: 105.95 },
    { kind: 'branch-house', minX: -49.325, maxX: -42.675, minZ: 39.15, maxZ: 45.65 },
    { kind: 'branch-house', minX: -40.65, maxX: -33.35, minZ: 38.65, maxZ: 46.15 },
    { kind: 'branch-house', minX: -23.275, maxX: -16.725, minZ: 39.05, maxZ: 46.15 },
    { kind: 'branch-house', minX: -49.325, maxX: -42.675, minZ: 22.35, maxZ: 28.85 },
    { kind: 'branch-house', minX: -40.275, maxX: -33.725, minZ: 22.05, maxZ: 29.15 },
    { kind: 'branch-house', minX: -23.325, maxX: -16.675, minZ: 22.35, maxZ: 28.85 },
    { kind: 'branch-house', minX: 14.675, maxX: 21.325, minZ: 39.15, maxZ: 45.65 },
    { kind: 'branch-house', minX: 43.675, maxX: 50.325, minZ: 39.15, maxZ: 45.65 },
    { kind: 'branch-house', minX: 14.675, maxX: 21.325, minZ: 22.35, maxZ: 28.85 },
    { kind: 'branch-house', minX: 43.725, maxX: 50.275, minZ: 22.05, maxZ: 29.15 },
    { kind: 'infill-house', minX: -31.75, maxX: -25.25, minZ: 39.15, maxZ: 45.65 },
    { kind: 'infill-house', minX: -31.75, maxX: -25.25, minZ: 22.35, maxZ: 28.85 },
    { kind: 'infill-house', minX: 23.75, maxX: 30.25, minZ: 22.35, maxZ: 28.85 },
    { kind: 'infill-house', minX: 33.75, maxX: 40.25, minZ: 22.35, maxZ: 28.85 },
    { kind: 'infill-house', minX: -13.7, maxX: -6.3, minZ: 18.1, maxZ: 26.9 },
    { kind: 'restaurant', minX: 25.25, maxX: 38.75, minZ: 39.15, maxZ: 49.15 },
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
