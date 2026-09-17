// El cordon: la piedra que separa la vereda de la calzada.
//
// EL DEFECTO. Hoy la vereda y la calzada se encuentran en un canto liso del mismo gris, a 10 cm de
// diferencia de cota y sin una sola arista que lo marque. Es la banda que ocupa el tercio inferior
// de TODOS los cuadros de calle -- la parte del cuadro que el rig de "se nota" ni siquiera podia
// leer, porque leia los PNG a 4 canales cuando tienen 3 y se quedaba sin buffer en la fila 630 de
// 840. Por eso nadie lo habia medido.
//
// LOS NUMEROS SALEN DE LOS LITERALES, NO DE UN REDONDEO. La vereda de la avenida no vive en
// STREET_LAYOUT: son dos `box()` sueltos en main.js (`for(const x of [-5.1,5.1])`, anchos 1,8 y
// largos 24,4 y 72,4). La de la transversal si esta en `STREET_LAYOUT.crossCurbs`. De ahi salen los
// 8 tramos y los 392,8 m, y `tests/kerbEdge.test.js` ancla los literales por si alguien los mueve.
//
// No agrega colliders: sobresale 4 cm y el jugador ya camina por encima de la vereda, cuya altura
// es fija. Es geometria decorativa, igual que el delantal.
import { STREET_LAYOUT } from './streetLifeState.js';
import { APRON_TOP, APRON_TILE_METRES } from './frontApronState.js';

// La vereda de la avenida, copiada de los dos literales de main.js. Anclados por test.
export const AVENUE_KERB = Object.freeze({
  centre: 5.1,
  width: 1.8,
  // los dos tramos en z: 18,2 +- 12,2 y 73,8 +- 36,2
  runs: Object.freeze([Object.freeze([6, 30.4]), Object.freeze([37.6, 110])]),
});

export const KERB_WIDTH = 0.15;
// Cuatro centimetros sobre la losa de vereda: mas es un escalon con el que uno tropieza a la vista,
// menos no se lee de noche a 1,68 m de altura.
export const KERB_LIFT = 0.04;
export const KERB_TOP = +(APRON_TOP + KERB_LIFT).toFixed(4);
// Baja hasta y = -0,04, por debajo de la calzada (0,02): sin esto queda una rendija negra entre el
// cordon y el asfalto que de noche se lee como un agujero.
export const KERB_THICKNESS = 0.2;

// Los 8 tramos. En la avenida el canto que da a la calzada es el borde INTERIOR de la vereda
// (|x| = centro - ancho/2 = 4,2); en la transversal es el borde interior de cada `crossCurb`.
export function kerbRuns() {
  const runs = [];
  // 5,1 - 0,9 da 4,199999999999999 en binario, y ese ultimo bit hace que el cordon SOLAPE la
  // calzada por 1e-15. El gate lo caza; redondear a 4 decimales es la unica forma de que no.
  const inner = +(AVENUE_KERB.centre - AVENUE_KERB.width / 2).toFixed(4);
  for (const lado of [-1, 1]) {
    for (const [z0, z1] of AVENUE_KERB.runs) {
      const borde = lado * inner;
      runs.push({
        id: `main${lado < 0 ? 'O' : 'E'}@${z0}`,
        street: 'main',
        minX: +(lado < 0 ? borde - KERB_WIDTH : borde).toFixed(4),
        maxX: +(lado < 0 ? borde : borde + KERB_WIDTH).toFixed(4),
        minZ: z0, maxZ: z1,
        length: +(z1 - z0).toFixed(4),
        top: KERB_TOP,
      });
    }
  }
  for (const curb of STREET_LAYOUT.crossCurbs) {
    // el borde que mira a la calzada: el cordon sur (z menor) la tiene arriba, el norte abajo
    const sur = curb.z < STREET_LAYOUT.intersectionZ;
    const borde = sur ? curb.z + curb.depth / 2 : curb.z - curb.depth / 2;
    runs.push({
      id: `cross${sur ? 'S' : 'N'}@${curb.x}`,
      street: 'cross',
      minX: +(curb.x - curb.width / 2).toFixed(4),
      maxX: +(curb.x + curb.width / 2).toFixed(4),
      minZ: sur ? +(borde - KERB_WIDTH).toFixed(4) : +borde.toFixed(4),
      maxZ: sur ? +borde.toFixed(4) : +(borde + KERB_WIDTH).toFixed(4),
      length: +curb.width.toFixed(4),
      top: KERB_TOP,
    });
  }
  return runs;
}

// Mismo contrato que el delantal: main.js las fusiona con `mergedGround` en UNA geometria.
export function kerbGeometrySpecs(runs = kerbRuns()) {
  return runs.map(run => {
    const sx = run.maxX - run.minX;
    const sz = run.maxZ - run.minZ;
    return {
      id: run.id,
      size: [sx, KERB_THICKNESS, sz],
      position: [(run.minX + run.maxX) / 2, KERB_TOP - KERB_THICKNESS / 2, (run.minZ + run.maxZ) / 2],
      uv: [sx / APRON_TILE_METRES, sz / APRON_TILE_METRES],
    };
  });
}
