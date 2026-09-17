// Los props de calle dejan de ser humo.
//
// EL DEFECTO, medido el 2026-09-11 contra la lista de colision viva: de los 35 props de calle, **33
// no tienen caja**. Los 37 `STREET_LAYOUT.obstacles` son AABB de EDIFICIOS, no de props. El jugador
// cruza los 18 faroles, los arboles, los arbustos, la camioneta y los personajes caminando. Es la
// mitad del "se ve todo mal buggeado".
//
// LAS HUELLAS SON MEDIDAS, NO INVENTADAS. Se sacaron de la escena viva agrupando por
// `userData.streetAsset` (la etiqueta que puso el paquete L en `loadStreetSet`) y midiendo el AABB
// de los vertices en DOS bandas de altura. La banda importa mas que el objeto:
//
//   farol   poste (1,00-1,60 m) 0,352 x 0,354   jardinera (0,35-0,95 m) 0,823 x 0,823
//   arbol   tronco (0,35-0,95)  0,512 x 0,506   copa      (1,00-1,60)   3,221 x 3,230
//   arbusto jardinera           1,389 x 0,993
//
// Medir el AABB entero le habria puesto al arbol una caja de 3,2 m y al farol una de 0,82 sobre una
// vereda de 1,8: el jugador no pasa (0,4885 m de holgura contra 0,56 de ancho). Por eso el preset 1
// usa el POSTE y el 2 la JARDINERA, y Jose elige conmutando.
//
// NO TODO LO QUE NO TIENE CAJA LA NECESITA. Barrido con el `moveCircle` del juego, grilla de 0,25 m,
// desde el spawn de calle: **6 de los 7 arboles estan a entre 3,48 y 8,33 m del piso pisable mas
// cercano** -- viven detras de las casas, en el pasto sellado. Solo el de (14,2 / 102,4) se toca,
// a 0,146 m. Ponerles caja a los otros seis no arregla nada y agrega seis cajas al bucle que corre
// en cada paso.
import { STREET_LAYOUT } from './streetLifeState.js';
import { HOUSE_FOOTPRINTS } from './lotState.js';
import { portalFor } from './navigationState.js';
import { HOUSE_PROPERTIES, streetSpawnForProperty } from './housePropertyState.js';

// Ancho x fondo de la huella, en metros, tal como salio de la escena.
export const PROP_FOOTPRINTS = Object.freeze({
  lamp: Object.freeze({
    post: Object.freeze({ x: 0.352, z: 0.354 }),
    planter: Object.freeze({ x: 0.823, z: 0.823 }),
  }),
  tree: Object.freeze({ trunk: Object.freeze({ x: 0.512, z: 0.506 }) }),
  shrub: Object.freeze({ x: 1.389, z: 0.993 }),
  // el centro medido cae 0,132 m del punto declarado; se usa el medido
  furniture: Object.freeze({ x: 1.069, z: 2.689, cx: -10.625, cz: 10.457 }),
  househead: Object.freeze({ x: 0.691, z: 0.863, cx: -5.108, cz: 18.148 }),
  // `neighborOlder` es una malla con huesos: su geometria vive en bind pose y no se puede medir en
  // mundo. Se le da una caja nominal de persona parada, mas chica que la de househead para no
  // inventarle volumen.
  neighborOlder: Object.freeze({ x: 0.6, z: 0.6 }),
});

// Se mueven: caja fija seria mentira y caja que los persigue puede encerrar al jugador.
export const MOVING_PROPS = Object.freeze(['van', 'foxWalker', 'neonCatWalker']);

// Indices de STREET_LAYOUT.trees que el jugador no alcanza (distancia al piso pisable, medida):
// 0 -> 6,88 m · 1 -> 3,48 · 2 -> 7,78 · 3 -> 8,33 · 4 -> 7,80 · 5 -> 8,17. El 6 esta a 0,146.
export const UNREACHABLE_TREES = Object.freeze([0, 1, 2, 3, 4, 5]);
export const REACHABLE_TREE = 6;

// El gato mide 0,29 x 0,36. Frenar al jugador contra un gato molesta mas que atravesarlo, asi que se
// queda como esta a proposito, en los tres presets.
export const SOLIDOS_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', lamps: 'none', props: false, npcs: false, tightHouses: false }),
  Object.freeze({ id: 1, key: 'post', label: 'POSTE', lamps: 'post', props: true, npcs: false, tightHouses: true }),
  Object.freeze({ id: 2, key: 'full', label: 'COMPLETO', lamps: 'planter', props: true, npcs: true, tightHouses: true }),
]);
export const DEFAULT_SOLIDOS_PRESET = 1;

export function solidosPresetById(id) {
  return SOLIDOS_PRESETS.find(preset => preset.id === id) ?? SOLIDOS_PRESETS[DEFAULT_SOLIDOS_PRESET];
}

export function readSolidosPreset(search, fallback = DEFAULT_SOLIDOS_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('solidos') ?? params.get('duros');
  // `?solidos=` sin valor devuelve '' y Number('') es 0: sin este chequeo un signo igual de mas
  // seleccionaba el brazo de control en silencio. Misma trampa que en las otras seis perillas.
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && SOLIDOS_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

// Radio del jugador en main.js (`playerRadius=.28`) mas un margen: una caja mas cerca que esto de un
// punto de aparicion deja al jugador naciendo DENTRO de ella.
export const SPAWN_CLEARANCE = 0.28 + 0.12;

// Todos los puntos donde el jugador puede APARECER: los cuatro portales y las 35 puertas de
// propiedad. El gate del 2026-09-11 encontro que el farol de (5,1 / 12,4), con la jardinera entera,
// quedaba a 0,239 m del spawn de `house-exit` y dejaba ese portal INCOMUNICADO -- con los 10 tests
// en verde, porque el test miraba dos portales y no los cuatro. Ahora la regla vive en el modulo.
export function spawnPoints() {
  const puntos = [];
  for (const id of ['warehouse-exit', 'shop-exit', 'house-exit', 'restaurant-exit']) {
    const spawn = portalFor(id)?.spawn;
    if (spawn) puntos.push({ id, x: spawn.x, z: spawn.z });
  }
  HOUSE_PROPERTIES.forEach((prop, index) => {
    const spawn = streetSpawnForProperty(prop);
    if (spawn) puntos.push({ id: `propiedad${index}`, x: spawn.x, z: spawn.z });
  });
  return puntos;
}

const distanciaACaja = (c, p) => Math.hypot(
  Math.max(c.minX - p.x, 0, p.x - c.maxX),
  Math.max(c.minZ - p.z, 0, p.z - c.maxZ),
);

// El spawn que una caja se tragaria, o null.
export function spawnInvadido(c, puntos = spawnPoints()) {
  for (const p of puntos) if (distanciaACaja(c, p) < SPAWN_CLEARANCE) return p;
  return null;
}

const caja = (id, kind, cx, cz, size) => ({
  id, kind,
  minX: +(cx - size.x / 2).toFixed(4), maxX: +(cx + size.x / 2).toFixed(4),
  minZ: +(cz - size.z / 2).toFixed(4), maxZ: +(cz + size.z / 2).toFixed(4),
});

export function propColliders(preset = solidosPresetById(DEFAULT_SOLIDOS_PRESET)) {
  const out = [];
  const puntos = spawnPoints();
  // Una caja que se traga un punto de aparicion no se agranda: se cae al tamano chico, y si ni asi
  // entra, no se pone. Vale mas un farol atravesable que un portal incomunicado.
  const empujar = (c) => {
    if (!spawnInvadido(c, puntos)) { out.push(c); return true; }
    return false;
  };
  if (preset.lamps !== 'none') {
    const size = PROP_FOOTPRINTS.lamp[preset.lamps];
    // el centro medido coincide con el declarado (desfase 0,000 en las 18)
    STREET_LAYOUT.lamps.forEach((lamp, index) => {
      const grande = caja(`farol${index}`, 'lamp', lamp.x, lamp.z, size);
      if (empujar(grande)) return;
      const chico = caja(`farol${index}`, 'lamp', lamp.x, lamp.z, PROP_FOOTPRINTS.lamp.post);
      empujar(chico);
    });
  }
  if (preset.props) {
    STREET_LAYOUT.shrubs.forEach((s, index) => empujar(caja(`arbusto${index}`, 'shrub', s.x, s.z, PROP_FOOTPRINTS.shrub)));
    const f = PROP_FOOTPRINTS.furniture;
    empujar(caja('furniture', 'furniture', f.cx, f.cz, f));
    const arbol = STREET_LAYOUT.trees[REACHABLE_TREE];
    if (arbol) empujar(caja('arbol6', 'tree', arbol.x, arbol.z, PROP_FOOTPRINTS.tree.trunk));
  }
  if (preset.npcs) {
    const h = PROP_FOOTPRINTS.househead;
    empujar(caja('househead', 'npc', h.cx, h.cz, h));
    const n = STREET_LAYOUT.neighborOlder;
    empujar(caja('neighborOlder', 'npc', n.x, n.z, PROP_FOOTPRINTS.neighborOlder));
  }
  return out;
}

// LA PARED INVISIBLE. `STREET_LAYOUT.obstacles` son las cajas DECLARADAS de cada edificio
// (`maxWidthX` / `maxDepthZ`), que son un TOPE y no la huella: el paquete L ya habia medido que la
// caja real es hasta 2,8 veces mas chica, porque el GLB casi nunca toca las tres cotas.
// Para colision eso significa que el jugador se frena ANTES de la pared. Medido el 2026-09-11 sobre
// las 21 casas de la avenida: el borde de colision sobresale **0,85 m de promedio y hasta 1,42 m**
// (HOME-003) hacia la calzada. Caminando por la vereda te para una pared que no esta.
//
// `HOUSE_FOOTPRINTS` son las huellas MEDIDAS contra la escena viva (37 de 38 con desvio 0,0000 m),
// asi que sirven de collider y son la verdad. Son AABB del modelo entero, alero incluido, asi que el
// jugador sigue frenandose antes del muro y nunca entra en una casa.
export function tightenedStreetBase(base) {
  const tocaCasa = (o) => HOUSE_FOOTPRINTS.some(f => o.minX < f.maxX && o.maxX > f.minX && o.minZ < f.maxZ && o.maxZ > f.minZ);
  const sinCasas = base.filter(o => !tocaCasa(o));
  const casas = HOUSE_FOOTPRINTS.map(f => ({ minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ }));
  return [...sinCasas, ...casas];
}

// Cuanto sobresale la caja declarada respecto de la fachada medida, por casa. Lo usa el test para
// que el numero no se pierda si alguien vuelve a cambiar el layout.
export function facadeOvershoot() {
  const out = [];
  for (const f of HOUSE_FOOTPRINTS) {
    const o = STREET_LAYOUT.obstacles.find(o => o.minX < f.maxX && o.maxX > f.minX && o.minZ < f.maxZ && o.maxZ > f.minZ);
    if (!o) continue;
    const haciaCalle = f.street === 'main'
      ? (f.x < 0 ? o.maxX - f.maxX : f.minX - o.minX)
      : (f.side === 'north' ? f.minZ - o.minZ : o.maxZ - f.maxZ);
    out.push({ id: f.id, street: f.street, overshoot: +haciaCalle.toFixed(3) });
  }
  return out;
}
