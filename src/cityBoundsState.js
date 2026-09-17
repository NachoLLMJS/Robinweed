// The world rectangle is frozen by tests/navigationState.test.js (x -54..54, z 8.65..108.4) and cannot shrink,
// but the content only lives on a cross: the avenue (|x| <= 15.5) and the cross street (z 19.5..51, |x| <= 52.4).
// These nine boxes fill everything else. They deliberately overhang the world rectangle by several metres so the
// player cannot graze a corner and slip past: moveCircle is a point-in-expanded-rect test, not a penetration
// solver, so a filler that stops exactly at the bounds would leave a radius-wide gap at every corner.
const box = (kind, minX, maxX, minZ, maxZ) => Object.freeze({ kind, minX, maxX, minZ, maxZ });

export const CITY_BLOCK = Object.freeze({
  avenueHalfWidth: 15.5,   // |x| of the avenue backlots
  crossMinZ: 19.5,         // south edge of the cross street corridor
  crossMaxZ: 51,           // north edge of the cross street corridor
  crossHalfLength: 52.4,   // |x| where the cross street is capped
  deadEndZ: 107.6,         // north end of the avenue
});

export const CITY_PERIMETER = Object.freeze([
  // four backlots: everything behind the houses of the avenue
  box('backlot-sw', -60, -15.5, 4, 19.5),
  box('backlot-se', 15.5, 60, 4, 19.5),
  box('backlot-nw', -60, -15.5, 51, 112),
  box('backlot-ne', 15.5, 60, 51, 112),
  // the two ends of the cross street
  box('cap-west', -60, -52.4, 19.5, 51),
  box('cap-east', 52.4, 60, 19.5, 51),
  // two pockets south of the intersection that the backlots cannot reach: behind the shop and behind the KFC
  box('pocket-sw', -15.51, -10.6, 4, 18.1),
  box('pocket-se', 12.45, 15.51, 4, 22),
  // the far end of the avenue, closed with a construction hoarding
  box('dead-end-north', -16, 16, 107.6, 112),
]);

export function perimeterFor(radius = 0) {
  return CITY_PERIMETER.map(o => Object.freeze({
    kind: o.kind,
    minX: o.minX - radius,
    maxX: o.maxX + radius,
    minZ: o.minZ - radius,
    maxZ: o.maxZ + radius,
  }));
}

export function insideCityBlock(x, z) {
  return !CITY_PERIMETER.some(o => x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ);
}
