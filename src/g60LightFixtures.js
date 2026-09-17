// src/g60LightFixtures.js
// Las dos luces que agrega el paquete G, escritas con la MISMA forma que las 32 fixtures que devuelve
// `buildFixtureTable()` del paquete A: `zone`, posicion, color, intensity, distance, decay.
// main.js las pega al final de la tabla BASE con `.concat(EXTRA_LIGHT_FIXTURES)` (sobre `lightFixturesBase`,
// antes de `tuneFixtures`), asi que las consume el pool fijo de 8 PointLight y el conteo de luces de la
// escena NO se mueve. La alternativa (`new THREE.PointLight`) esta prohibida por A: cada luz que aparece o
// desaparece cambia NUM_POINT_LIGHTS y recompila los 510 materiales de la escena.
//
// `vendor-counter` es de zona 'warehouse': `fixturesForZone` la deja fuera del pool en cuanto el jugador sale
// del galpon, que es exactamente el efecto que se buscaba con `legacyWarehouseShell.push(...)`, pero sin
// togglear `.visible` de ninguna luz.
//
// Estos DOS son los UNICOS fixtures MUTABLES de toda la tabla (las 32 que devuelve `buildFixtureTable` salen
// congeladas), y es a proposito, por dos motivos:
//   - `restaurant-sign`: la Tarea 49 le corrige la POSICION desde la caja medida del propio cartel, dentro del
//     callback del loader del GLB (correccion D-10 de la verificacion). Los valores de abajo son la posicion
//     medida hoy (`node meas/g-verif4.mjs`: cartel en x[26.596, 33.389] y[3.052, 4.465] z[42.851, 43.360]
//     -> centro 29.99 / 3.76, cara -Z menos 0.7). Si el GLB cambia, el loader la vuelve a corregir sola.
//   - los dos: la Tarea 49b (`?g60=`) les cambia la INTENSITY en caliente para que Jose compare presets.
// `budgetPlacement` lee x/y/z/color/intensity/distance/decay en cada refresco del pool
// (cada POINT_BUDGET.updateMs = 160 ms), asi que los dos cambios entran solos SIN recrear ninguna luz, que es
// exactamente lo que exige A: el conteo de luces de la escena nunca se mueve.
// Congelarlos romperia las dos cosas: en modo estricto tira TypeError y en modo suelto falla EN SILENCIO.
//
// `legacy: { intensity: 0 }` (C-11 de la verificacion de G): el preset 0 de `?lighting` ("HOY" de A) aplica
// `tuneFixtures` con `preset.legacy`, que pisa el fixture con su bloque `legacy`. Sin ese bloque las dos luces
// de G quedarian encendidas en el preset que promete la escena de hoy. Con el, en el preset 0 estan apagadas
// por definicion (el pool lee una COPIA `{...fixture, ...legacy}`: ahi la perilla 49b no llega, y no hace
// falta); en los presets 1 y 2 `tuneFixtures` devuelve el MISMO objeto y la mutacion en caliente si llega.
export const VENDOR_COUNTER_FIXTURE = {
  id: 'vendor-counter', zone: 'warehouse', kind: 'room',
  x: 4.75, y: 2.95, z: -5.95,
  color: 0xffd9a1, intensity: 4.2, distance: 7, decay: 2,
  legacy: { intensity: 0 },
};

export const RESTAURANT_SIGN_FIXTURE = {
  id: 'restaurant-sign', zone: 'street', kind: 'neon',
  x: 29.99, y: 3.76, z: 42.15,
  color: 0xff4a35, intensity: 3.2, distance: 11, decay: 2,
  legacy: { intensity: 0 },
};

export const EXTRA_LIGHT_FIXTURES = [VENDOR_COUNTER_FIXTURE, RESTAURANT_SIGN_FIXTURE];
