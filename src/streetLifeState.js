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
  // groundY 0,12: los dos caminan por la vereda, cuyo tope es 0,12 (box([1.8,.16,..],..,[x,.04,..]) en main.js). Sin
  // el campo, loadStreetSet los apoyaba en el 0,08 por defecto y llevaban los pies 4 cm dentro del pavimento (medido
  // el 2026-09-13 por el refutador de jugabilidad). Siguen por |x| 4,45 porque el farol (poste en |x| 4,92) no deja
  // correrlos mas afuera: el flanco roza el cordon de piedra, un pie sobre el cordon es un peaton normal.
  foxWalker: Object.freeze({ x: -4.45, minZ: 42, maxZ: 96, height: 1.8, speed: 1.05, groundY: .12 }),
  neonCatWalker: Object.freeze({ x: 4.45, minZ: 55.5, maxZ: 66.8, height: 1.8, speed: .95, groundY: .12 }),
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

// Igual que advancePatrol pero con una pausa en cada punta: un peaton que se
// detiene unos segundos antes de darse vuelta se lee como persona, no como bot.
export function advanceStrollPatrol(state, dt, min, max, speed, dwellSeconds = 0) {
  const step = Math.max(0, dt);
  if (state.dwell > 0) {
    return {
      distance: state.distance,
      direction: state.direction,
      dwell: Math.max(0, state.dwell - step),
      moving: false,
    };
  }
  let distance = state.distance + state.direction * speed * step;
  let direction = state.direction;
  let dwell = 0;
  if (distance >= max) { distance = max; direction = -1; dwell = dwellSeconds; }
  if (distance <= min) { distance = min; direction = 1; dwell = dwellSeconds; }
  return { distance, direction, dwell, moving: dwell === 0 };
}

// --- La van: cuerpo medido, rampa del acelerador y paradas por (cruce, sentido) -----------------------------------
// C2 (2026-09-14, CF-01 + CF-02 / T48-H2). Las paradas derivadas (VAN_TRAFFIC_STOPS) viven en vanStopState.js porque
// necesitan las cebras de crossingState, y crossingState importa STREET_LAYOUT de aca: importarlo desde este modulo
// seria un ciclo con un const sin inicializar (TDZ) al cargar main.js. Aca queda lo puro.

// Medido del GLB (public/models-v9/street/delivery-van.glb): un nodo con escala uniforme 0,5 y POSITION normalizada
// (SHORT) de +-32767 x +-24062 x +-21118; loadStreetSet -> normalizeAsset escala height/alto (uniforme), asi que
// largo = 2,25 x 32767/24062 = 3,064 sobre el x del GLB y ancho = 1,975 sobre su z. El wrapper gira rotationY +-pi/2
// sobre la avenida (advanceVehicleRoute, modelHeading), asi que el LARGO cae sobre el z de la calle.
// tests/vanStops.test.js lo re-mide del GLB.
export const VAN_BODY = Object.freeze({ length: 3.064, width: 1.975 });

// La rampa LINEAL del acelerador (T48): 0 exacto en 1/2,6 = 0,38 s, 1 en 1/1,6 = 0,63 s. Un lerp nunca llega a 0 y la
// van se arrastraria durante la espera. Vivia inline en main.js; aca porque vanBrakingDistance la necesita.
export const VAN_THROTTLE_RAMP = Object.freeze({ brake: 2.6, release: 1.6 });
export function advanceVanThrottle(throttle, braking, dt, ramp = VAN_THROTTLE_RAMP) {
  const step = Math.max(0, dt);
  return braking ? Math.max(0, throttle - step * ramp.brake) : Math.min(1, throttle + step * ramp.release);
}

// Lo que rueda la van desde que el acelerador empieza a bajar hasta que llega a 0: v * (1/brake) / 2 = 2,4/5,2 = 0,4615.
export function vanBrakingDistance(speed = STREET_LAYOUT.van.speed, ramp = VAN_THROTTLE_RAMP) {
  return speed / (2 * ramp.brake);
}

// +1 si el tramo actual de la ruta va al norte (z creciente), -1 al sur, 0 en los laterales (z 12 y z 107).
export function vanTravelDir(routeState, route = STREET_LAYOUT.vehicleRoute) {
  const segment = (((routeState.segment ?? 0) % route.length) + route.length) % route.length;
  return Math.sign(route[(segment + 1) % route.length].z - route[segment].z);
}

// Cuanto aire queda entre el morro y la primera raya de la cebra.
export const VAN_STOP_MARGIN = 0.3;
const r4 = n => +n.toFixed(4);

// Una LINEA DE PARADA POR (cruce, sentido). `crossings` son las franjas que la van atraviesa ({ id, minZ, maxZ,
// holdSeconds }: rayas + lo que haya entre ellas). Yendo al norte el morro (centro + L/2) queda `margin` antes de
// minZ; yendo al sur el morro (centro - L/2) queda `margin` despues de maxZ. `arm` es donde el acelerador empieza a
// bajar (una distancia de frenado antes de la linea) para que la van se detenga EN la linea, no pasada.
// La linea solo existe si algun tramo de la ruta en ese sentido la alcanza desde atras (arranca antes de `arm` y
// termina despues de `z`): la ruta arranca en z 12, ENCIMA del cruce del galpon, asi que su linea norte (9,318) no
// es un cruce que se atraviese y no se emite. Orden: como se recorren desde el arranque de la ruta.
export function vanStopLines(crossings, length = VAN_BODY.length, options = {}) {
  const { margin = VAN_STOP_MARGIN, route = STREET_LAYOUT.vehicleRoute, speed = STREET_LAYOUT.van.speed, ramp = VAN_THROTTLE_RAMP } = options;
  const brake = vanBrakingDistance(speed, ramp);
  const half = length / 2;
  const legs = route.map((start, i) => ({ start, end: route[(i + 1) % route.length] }));
  const lines = [];
  for (const crossing of crossings) {
    for (const dir of [1, -1]) {
      const z = dir > 0 ? crossing.minZ - margin - half : crossing.maxZ + margin + half;
      const arm = z - dir * brake;
      const approached = legs.some(({ start, end }) => Math.sign(end.z - start.z) === dir
        && (dir > 0 ? start.z <= arm && end.z >= z : start.z >= arm && end.z <= z));
      if (!approached) continue;
      lines.push(Object.freeze({ id: `${crossing.id}:${dir > 0 ? 'north' : 'south'}`, crossing: crossing.id, dir, z: r4(z), arm: r4(arm), holdSeconds: crossing.holdSeconds }));
    }
  }
  const firstDir = legs.map(({ start, end }) => Math.sign(end.z - start.z)).find(d => d !== 0) ?? 1;
  const order = stop => [stop.dir === firstDir ? 0 : 1, stop.dir * stop.z];
  return Object.freeze(lines.sort((a, b) => {
    const [ga, za] = order(a);
    const [gb, zb] = order(b);
    return ga - gb || za - zb;
  }));
}

export function vanStopIdle() {
  return { heading: 0, served: [], remaining: 0, throttle: 1 };
}

// Devuelve el acelerador 0/1 y sirve cada parada UNA vez por (cruce, sentido): `served` guarda los ids servidos y al
// cambiar de sentido (dar la vuelta en un extremo) se limpian los del sentido nuevo, que eran de la vuelta anterior.
// Antes `servedZ` era un solo z sin sentido que se re-armaba al salir de la zona: en la bocacalle funcionaba de
// casualidad (la zona se salia entre ida y vuelta) y en el galpon no (la ruta gira dentro de la zona).
export function advanceVanStop(state, dt, z, dir, stops) {
  const step = Math.max(0, dt);
  let heading = state.heading ?? 0;
  let served = state.served ?? [];
  if (dir !== 0 && dir !== heading) {
    served = served.filter(id => !stops.some(stop => stop.id === id && stop.dir === dir));
    heading = dir;
  }
  if (state.remaining > 0) {
    const remaining = Math.max(0, state.remaining - step);
    return { heading, served, remaining, throttle: remaining > 0 ? 0 : 1 };
  }
  // la primera linea (en orden de marcha) cuyo `arm` la van ya piso en su sentido y que no se sirvio en esta pasada
  const due = dir === 0 ? null : stops
    .filter(stop => stop.dir === dir && !served.includes(stop.id) && (dir > 0 ? z >= stop.arm : z <= stop.arm))
    .sort((a, b) => dir * (a.z - b.z))[0] ?? null;
  if (!due) return { heading, served, remaining: 0, throttle: 1 };
  return { heading, served: [...served, due.id], remaining: Math.max(0, due.holdSeconds - step), throttle: 0 };
}

// Cuatro peatones extra sobre los dos que ya existian (foxWalker / neonCatWalker). Cada uno difiere en
// carril, tramo, velocidad, pausa, escala, fase de animacion y tinte, para que la avenida no se lea como
// dos clones yendo y viniendo.
// Carril |x| 4,45 = el de los dos originales (paquete G verificado, C-08): las farolas de |x| 5,1 NO se mueven
// (tienen collider PROP_FOOTPRINTS.lamp.post, el kit de vereda se coloca contra ellas y la ciudad decidio que
// "un pie sobre el cordon es un peaton normal"). Flanco 4,45 + 0,35 = 4,80 contra la cara interna del poste
// 5,1 - 0,176 = 4,924: 0,124 m de aire. Medido el 2026-09-14 contra dressingColliders(), propColliders() y
// los colliders de ?isla con los presets por defecto: 0 cruces (tests/streetWalkers.test.js lo re-mide).
// Tramos: ninguno comparte carril y tramo con el zorro (oeste 42..96) ni el gato (este 55,5..66,8) originales;
// foxCommuter va por z 23,6..30,2 para no atravesar al househead (17,5..18,8) ni al gato sentado (22,1..22,6);
// catDowntown frena en 22,2 antes del arbusto este (23,1) y del vecino mayor (24,7).
export const STREET_WALKERS = Object.freeze([
  Object.freeze({ key: 'foxCommuter', asset: 'foxWalker', lane: -4.45, minZ: 23.6, maxZ: 30.2, speed: 1.34, dwell: 1.6, scale: 0.92, phase: 0.45, tint: 0xffc2d8, tintAmount: 0.30 }),
  Object.freeze({ key: 'foxUptown', asset: 'foxWalker', lane: 4.45, minZ: 71.4, maxZ: 97.6, speed: 0.82, dwell: 3.4, scale: 1.07, phase: 1.90, tint: 0xbfe0ff, tintAmount: 0.26 }),
  Object.freeze({ key: 'catCrosstown', asset: 'neonCatWalker', lane: 4.45, minZ: 38.4, maxZ: 52.8, speed: 1.12, dwell: 2.1, scale: 0.95, phase: 1.20, tint: 0xffe08a, tintAmount: 0.34 }),
  Object.freeze({ key: 'catDowntown', asset: 'neonCatWalker', lane: 4.45, minZ: 12.6, maxZ: 22.2, speed: 0.90, dwell: 2.8, scale: 1.04, phase: 0.70, tint: 0xc4ffd0, tintAmount: 0.28 }),
]);