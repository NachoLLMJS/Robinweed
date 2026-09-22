// Presentation-only warehouse shelving. These two banks intentionally have no plot IDs,
// cultivation state, persistence, rewards or contract actions. They only describe meshes.
const freeze = value => Object.freeze(value);

const BANK_SIZE = freeze([2.4, 2.7, 0.7]);
const SHELVES_Y = freeze([0.18, 1.08, 1.98]);
const UPRIGHT_WIDTH = 0.06;

export const DISPLAY_SHELF_BANKS = freeze([
  freeze({
    id: 'DISPLAY-A',
    center: freeze([2.6, 0, 2.2]),
    collider: freeze({ minX: 1.4, maxX: 3.8, minZ: 1.85, maxZ: 2.55 }),
  }),
  freeze({
    id: 'DISPLAY-B',
    center: freeze([2.6, 0, 4.1]),
    // Leave a real player-width passage to the hydroponic tower; the visible shelf still reaches 4.45.
    collider: freeze({ minX: 1.4, maxX: 3.8, minZ: 3.75, maxZ: 4.34 }),
  }),
]);

export function displayShelfPieces() {
  const pieces = [];
  const [width, height, depth] = BANK_SIZE;
  for (const bank of DISPLAY_SHELF_BANKS) {
    const [cx, , cz] = bank.center;
    for (const sideX of [-1, 1]) {
      for (const sideZ of [-1, 1]) {
        pieces.push(freeze({
          decorative: true,
          kind: 'upright',
          bank: bank.id,
          size: freeze([UPRIGHT_WIDTH, height, UPRIGHT_WIDTH]),
          position: freeze([
            cx + sideX * (width / 2 - UPRIGHT_WIDTH / 2),
            height / 2,
            cz + sideZ * (depth / 2 - UPRIGHT_WIDTH / 2),
          ]),
        }));
      }
    }
    SHELVES_Y.forEach((shelfY, shelf) => {
      const ceilingY = SHELVES_Y[shelf + 1] ?? 2.7;
      pieces.push(freeze({ decorative: true, kind: 'shelf', bank: bank.id, shelf, size: freeze([width, 0.04, depth]), position: freeze([cx, shelfY - 0.02, cz]) }));
      pieces.push(freeze({ decorative: true, kind: 'ledBar', bank: bank.id, shelf, size: freeze([width - UPRIGHT_WIDTH * 2, 0.03, 0.06]), position: freeze([cx, ceilingY - 0.06, cz]) }));
      pieces.push(freeze({ decorative: true, kind: 'lightPool', bank: bank.id, shelf, size: freeze([width - UPRIGHT_WIDTH * 2, 0.004, depth - 0.1]), position: freeze([cx, shelfY + 0.006, cz]) }));
    });
    pieces.push(freeze({ decorative: true, kind: 'topBar', bank: bank.id, size: freeze([width, 0.06, depth]), position: freeze([cx, 2.7, cz]) }));
  }
  return pieces;
}

export function displayPlantPlacements() {
  const placements = [];
  const usableSpan = BANK_SIZE[0] - UPRIGHT_WIDTH * 2;
  for (const bank of DISPLAY_SHELF_BANKS) {
    SHELVES_Y.forEach((shelfY, shelf) => {
      for (let slot = 0; slot < 3; slot += 1) {
        const t = (slot + 1) / 4;
        placements.push(freeze({
          displayId: `${bank.id}-L${shelf + 1}-P${slot + 1}`,
          decorative: true,
          bank: bank.id,
          shelf,
          slot,
          supportY: shelfY,
          stage: 2 + ((placements.length + shelf) % 4),
          scale: 0.34,
          position: freeze([
            bank.center[0] - usableSpan / 2 + usableSpan * t,
            shelfY,
            bank.center[2],
          ]),
        }));
      }
    });
  }
  return placements;
}
