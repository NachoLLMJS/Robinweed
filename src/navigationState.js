const PORTALS = Object.freeze({
  'warehouse-exit': Object.freeze({
    title: 'LEAVE THE WAREHOUSE?',
    message: 'Do you want to go outside?',
    confirm: 'YES, GO OUTSIDE',
    target: 'street',
    spawn: Object.freeze({ x: 0, z: 9.55, yaw: Math.PI }),
  }),
  'warehouse-entrance': Object.freeze({
    title: 'ENTER THE WAREHOUSE?',
    message: 'Return to the grow room?',
    confirm: 'YES, ENTER',
    target: 'warehouse',
    spawn: Object.freeze({ x: 0, z: 6.65, yaw: 0 }),
  }),
  'shop-entrance': Object.freeze({
    title: 'ENTER THE SHOP?',
    message: 'Do you want to enter?',
    confirm: 'YES, ENTER',
    target: 'shop-interior',
    spawn: Object.freeze({ x: 0, z: -27.2, yaw: 0 }),
  }),
  'house-entrance': Object.freeze({
    title: 'ENTER THE HOUSE?',
    message: 'Do you want to enter?',
    confirm: 'YES, ENTER',
    target: 'house-interior',
    spawn: Object.freeze({ x: 0, z: -45.2, yaw: 0 }),
  }),
  'shop-exit': Object.freeze({
    title: 'LEAVE THE SHOP?',
    message: 'Return to the street?',
    confirm: 'YES, GO OUTSIDE',
    target: 'street',
    spawn: Object.freeze({ x: -5.95, z: 14.7, yaw: -Math.PI / 2 }),
  }),
  'house-exit': Object.freeze({
    title: 'LEAVE THE HOUSE?',
    message: 'Return to the street?',
    confirm: 'YES, GO OUTSIDE',
    target: 'street',
    spawn: Object.freeze({ x: 5.5, z: 11.75, yaw: Math.PI / 2 }),
  }),
});

const LOCATION_BOUNDS = Object.freeze({
  warehouse: Object.freeze({ minX: -6.6, maxX: 6.6, minZ: -7.35, maxZ: 7.35 }),
  street: Object.freeze({ minX: -6.25, maxX: 6.25, minZ: 8.65, maxZ: 42.4 }),
  'shop-interior': Object.freeze({ minX: -4.35, maxX: 4.35, minZ: -34.35, maxZ: -25.65 }),
  'house-interior': Object.freeze({ minX: -4.35, maxX: 4.35, minZ: -52.35, maxZ: -43.65 }),
});

const CITY_BUILDINGS = Object.freeze({
  shop: Object.freeze({
    positionX: -8.3,
    portalX: -6.48,
    positionY: -0.08,
    // Exclude the door/facade projection from collision so the portal remains
    // reachable inside the narrow street bounds; the world bound prevents
    // walking through the visual shell.
    obstacle: Object.freeze({ minX: -10.55, maxX: -6.35, minZ: 11.7, maxZ: 17.7 }),
  }),
  house: Object.freeze({
    positionX: 8.987,
    positionZ: 11.75,
    portalX: 6.05,
    positionY: -0.08,
    obstacle: Object.freeze({ minX: 6, maxX: 11.975, minZ: 8.66, maxZ: 14.84 }),
  }),
});

export function portalFor(id) {
  return PORTALS[id] || null;
}

export function boundsForLocation(location) {
  return LOCATION_BOUNDS[location] || LOCATION_BOUNDS.warehouse;
}

export function cityBuildingFor(type) {
  return CITY_BUILDINGS[type] || null;
}
