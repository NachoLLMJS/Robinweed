export const RESTAURANT_EXTERIOR_INTERACTION = Object.freeze({
  id: 'restaurant-entrance',
  size: Object.freeze({ x: 13.2, y: 2.8, z: 2.4 }),
  position: Object.freeze({ x: 32, y: 1.4, z: 37.8 }),
});

export const RESTAURANT_INTERIOR_LAYOUT = Object.freeze({
  bounds: Object.freeze({ minX: -11.5, maxX: 11.5, minZ: -98.5, maxZ: -61.5 }),
  spawn: Object.freeze({ x: 0, z: -63 }),
  exitDoor: Object.freeze({
    id: 'restaurant-exit',
    label: 'EXIT · PRESS E',
    size: Object.freeze({ x: 2.8, y: 2.8, z: 0.65 }),
    position: Object.freeze({ x: 0, y: 1.4, z: -61.85 }),
    wallZ: -60.25,
  }),
  obstacles: Object.freeze([]),
});
