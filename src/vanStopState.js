// Las paradas de la van, DERIVADAS (C2, 2026-09-14, CF-01 + CF-02): una linea por (cruce, sentido) a partir de las
// cebras de crossingState y del largo medido de la van (VAN_BODY). Modulo aparte porque crossingState importa
// STREET_LAYOUT de streetLifeState: si streetLifeState importara crossingState para derivar esto en su top level, el
// ciclo dejaria a uno de los dos leyendo un const sin inicializar (TDZ) al cargar main.js.
import { STREET_LAYOUT, VAN_BODY, vanStopLines } from './streetLifeState.js';
import { ZEBRA, zebraCrossings } from './crossingState.js';

const r4 = n => +n.toFixed(4);

// T48: 3,6 s en la bocacalle, 2,4 s en el cruce peatonal del galpon.
export const VAN_HOLD_SECONDS = Object.freeze({ intersection: 3.6, crossing: 2.4 });

// Las franjas que la van ATRAVIESA (rayas cruzadas sobre la avenida, axis 'x'):
// - la bocacalle como UNA franja, de la cebra sur a la norte (27,7..40,3): rayas + el asfalto de la transversal en el
//   medio; el morro no puede quedar sobre ninguna de las dos cosas (el gate midio la van parada en 36,73 y 31,25,
//   dentro del asfalto, con la cola sobre la cebra norte);
// - la cebra del galpon, que zebraCrossings() no lista porque main.js la pinta a mano (7 rayas de .56 x 2.1 en
//   crossingZ: 11,15..13,25; ZEBRA.depth es ese 2.1).
export function vanCrossings(zebras = zebraCrossings(), layout = STREET_LAYOUT) {
  const avenue = zebras.filter(z => z.axis === 'x' && Math.abs(z.at - layout.intersectionZ) <= layout.crossStreet.depth);
  const half = ZEBRA.depth / 2;
  return Object.freeze([
    Object.freeze({
      id: 'intersection',
      minZ: r4(Math.min(...avenue.map(z => z.minZ))),
      maxZ: r4(Math.max(...avenue.map(z => z.maxZ))),
      holdSeconds: VAN_HOLD_SECONDS.intersection,
    }),
    Object.freeze({
      id: 'galpon',
      minZ: r4(layout.crossingZ - half),
      maxZ: r4(layout.crossingZ + half),
      holdSeconds: VAN_HOLD_SECONDS.crossing,
    }),
  ]);
}

// Con L = 3,064 (L/2 1,532), margen 0,3 y frenado 0,4615: intersection:north z 25,868 / intersection:south z 42,132 /
// galpon:south z 15,082. La linea galpon:north (9,318) no existe: la ruta arranca en z 12, encima de ese cruce.
// tests/streetWalkers.test.js fija los numeros; tests/vanStops.test.js recorre la vuelta entera.
export const VAN_TRAFFIC_STOPS = vanStopLines(vanCrossings(), VAN_BODY.length);
