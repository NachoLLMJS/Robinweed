import { budColorForTicker } from './seedVarietyState.js';

const station = (x, z, row) => Object.freeze({ x, z, row });

export const WAREHOUSE_GROW_STATIONS = Object.freeze([
  station(-2.4, -2.2, 'original'),
  station(-0.8, -2.2, 'original'),
  station(0.8, -2.2, 'original'),
  station(2.4, -2.2, 'original'),
  station(-4.7, 0.15, 'expansion'),
  station(-3.15, 0.15, 'expansion'),
  station(3.15, 0.15, 'expansion'),
  station(4.7, 0.15, 'expansion'),
]);

export function stationCollider({ x, z }) {
  return Object.freeze({ minX: x - 0.68, maxX: x + 0.68, minZ: z - 0.62, maxZ: z + 0.62 });
}

export const WAREHOUSE_DECOR = Object.freeze({
  soilPallet: Object.freeze({ position: Object.freeze([-5.35, 0, 3.25]), targetHeight: 1.25, rotationY: Math.PI / 2 }),
  recyclingBin: Object.freeze({ position: Object.freeze([5.65, 0, 3.45]), targetHeight: 1.45, rotationY: -Math.PI / 2 }),
  hydroponicTower: Object.freeze({
    position: Object.freeze([5.25, 0, 6.15]),
    targetHeight: 3.15,
    rotationY: 0,
    collider: Object.freeze({ minX: 3.96, maxX: 6.54, minZ: 4.94, maxZ: 7.36 }),
  }),
  airConditioner: Object.freeze({ position: Object.freeze([-6.67, 2.35, 5.05]), targetHeight: .82, rotationY: Math.PI / 2 }),
  fans: Object.freeze([
    Object.freeze({ position: Object.freeze([-6.67, 2.35, -1.0]), targetHeight: 1.45, rotationY: Math.PI / 2 }),
    Object.freeze({ position: Object.freeze([6.67, 2.35, 3.8]), targetHeight: 1.45, rotationY: -Math.PI / 2 }),
  ]),
});

export const WAREHOUSE_JARS = Object.freeze([
  Object.freeze({ ticker: 'HOOD', color: budColorForTicker('HOOD'), position: Object.freeze([-5.65, 0.49, -5.73]) }),
  Object.freeze({ ticker: 'MSFT', color: budColorForTicker('MSFT'), position: Object.freeze([-4.95, 0.49, -5.73]) }),
  Object.freeze({ ticker: 'TSLA', color: budColorForTicker('TSLA'), position: Object.freeze([-5.45, 1.38, -5.73]) }),
  Object.freeze({ ticker: 'QQQ', color: budColorForTicker('QQQ'), position: Object.freeze([-4.45, 1.38, -5.73]) }),
]);

export const WAREHOUSE_JAR_BUD_PLACEMENTS = Object.freeze([
  [-.09, .08, -.08], [0, .08, -.11], [.09, .08, -.08], [-.12, .08, 0], [-.04, .08, 0], [.045, .08, 0], [.12, .08, .015], [-.06, .08, .10],
  [-.08, .14, -.07], [.015, .14, -.10], [.10, .14, -.045], [-.105, .14, .025], [-.02, .14, .015], [.07, .14, .055], [-.04, .14, .11],
  [-.07, .20, -.07], [.035, .20, -.08], [.10, .20, 0], [-.09, .20, .04], [0, .20, .04], [.055, .20, .10],
  [-.055, .26, -.065], [.055, .26, -.055], [-.08, .26, .045], [.025, .26, .025], [.07, .26, .085],
  [-.045, .32, -.045], [.055, .32, -.025], [-.03, .32, .055], [.045, .32, .06],
].map(position => Object.freeze(position)));
