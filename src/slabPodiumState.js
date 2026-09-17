// Las bases que no apoyan: un zocalo de piedra bajo la placa que flota, y una vidriera en la planta baja negra.
//
// EL DEFECTO (diagnostico 2026-09-11, punto 3: "el edificio azul flota sobre una placa celeste que no es el suelo, y
// su planta baja es un rectangulo negro sin puerta"). Medido el 2026-09-12 con scripts/measure-slabs.mjs sobre los
// 38 lotes (src/slabMap.js, GENERADO): UN solo edificio tiene una placa que sobresale de sus paredes y paredes que
// arrancan por encima de la placa -- BLOCK-005, el comercial violeta del city pack: placa de 6,55 x 4,65 m hasta
// 0,149 m, paredes de 4,1 x 2,9 desde 0,324 m (0,175 m de aire entre la placa y la pared), sobresaliendo 1,22 m a
// los costados y 0,86 m al frente. Los otros 37 apoyan: sus placas son el zocalo de la casa (< 10 cm), o la casa
// del jugador sobre su plataforma (la pared arranca 2 cm sobre ella), o el restaurante con su base a ras del piso.
//
// EL ARREGLO. Cambiar el GLB no se puede (todo apoya en las huellas medidas), y el material es una paleta (un solo
// material, colores por UV), asi que no hay que tenir. Lo que si se puede es APOYAR: un zocalo de piedra (el
// material del cordon) que envuelve la placa entera, del pasto (0,03) hasta la cota donde arranca la pared, de modo
// que la caja negra se asiente sobre piedra y la placa celeste quede adentro. Y en la planta baja negra, una
// vidriera: un plano con MeshBasicMaterial (su color ES su radiancia, como las ventanas del skyline) pintado en
// canvas -- vidrio calido, parantes, estantes, y la puerta donde la midio frontDoorMap.
//
// Perilla como las otras: ?bases=0|1|2 (alias ?zocalos=). 0 = el juego de hoy; 1 = el zocalo; 2 = zocalo + vidriera.
// La regla es data: si un GLB cambia y otra placa flota, measure-slabs la encuentra y entra sola.
import { SLAB_MAP } from './slabMap.js';
import { FRONT_DOOR_MAP } from './frontDoorMap.js';
import { GRASS_TOP, APRON_TILE_METRES } from './frontApronState.js';

const r4 = n => +n.toFixed(4);

// Una placa FLOTA cuando es visible (>= 10 cm de alto), la pared arranca por encima de ella (>= 5 cm de aire) y
// sobresale de la pared por los cuatro lados (>= 30 cm). El margen es lo que el zocalo asoma de la placa.
export const PODIUM_RULE = Object.freeze({ minSlabTop: 0.1, minGap: 0.05, minProtrusion: 0.3, margin: 0.02 });

export const BASES_PRESETS = Object.freeze([
  Object.freeze({ id: 0, key: 'legacy', label: 'HOY', podium: false, shopfront: false }),
  Object.freeze({ id: 1, key: 'podium', label: 'ZOCALO', podium: true, shopfront: false }),
  Object.freeze({ id: 2, key: 'shopfront', label: 'ZOCALO+VIDRIERA', podium: true, shopfront: true }),
]);
export const DEFAULT_BASES_PRESET = 2;

export function basesPresetById(id) {
  return BASES_PRESETS.find(preset => preset.id === id) ?? BASES_PRESETS[DEFAULT_BASES_PRESET];
}

export function readBasesPreset(search, fallback = DEFAULT_BASES_PRESET) {
  const params = new URLSearchParams(search ?? '');
  const raw = params.get('bases') ?? params.get('zocalos');
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && BASES_PRESETS.some(preset => preset.id === value) ? value : fallback;
}

export function floatingSlabs(map = SLAB_MAP) {
  const out = [];
  for (const [id, row] of map) {
    if (!row.walls || !row.protrusion || row.wallBottom === null) continue;
    const gap = row.wallBottom - row.slabTop;
    const p = row.protrusion;
    if (row.slabTop < PODIUM_RULE.minSlabTop || gap < PODIUM_RULE.minGap) continue;
    if (Math.min(p.xMin, p.xMax, p.zMin, p.zMax) < PODIUM_RULE.minProtrusion) continue;
    out.push({ id, ...row, gap: +gap.toFixed(3) });
  }
  return out;
}

// El zocalo: la placa mas el margen, del pasto hasta la cota de mundo donde arranca la pared.
export function podiums(list = floatingSlabs()) {
  const m = PODIUM_RULE.margin;
  return list.map(s => ({
    id: s.id, asset: s.asset,
    minX: r4(s.ground.minX - m), maxX: r4(s.ground.maxX + m), minZ: r4(s.ground.minZ - m), maxZ: r4(s.ground.maxZ + m),
    bottom: GRASS_TOP, top: r4(s.minY + s.wallBottom),
  }));
}

// Mismo contrato que el delantal: cajas para mergedGround, con el material del cordon (piedra).
export function podiumGeometrySpecs(list = podiums()) {
  return list.map(p => {
    const sx = r4(p.maxX - p.minX), sy = r4(p.top - p.bottom), sz = r4(p.maxZ - p.minZ);
    return { id: p.id, size: [sx, sy, sz], position: [r4((p.minX + p.maxX) / 2), r4((p.bottom + p.top) / 2), r4((p.minZ + p.maxZ) / 2)], uv: [sx / APRON_TILE_METRES, sz / APRON_TILE_METRES] };
  });
}

// --- La vidriera --------------------------------------------------------------------------------
// Por modelo, porque solo se sabe mirando el render que la planta baja es una caja de vidrio negro: alturas sobre la
// cota de la pared, retiro lateral, separacion de la cara (para no z-fightear con la pared) y paleta. Radiancia
// directa (MeshBasicMaterial): un vidrio a #e9b874 queda del orden de una ventana encendida del skyline.
export const SHOPFRONT_KIT = Object.freeze({
  cityPackCommercialPurple: Object.freeze({
    sill: 0.12, head: 1.65, inset: 0.1, standoff: 0.03,
    frame: '#1c1a1f', glass: '#e9b874', glassLow: '#c9924f', mullion: '#2a2630', mullions: 4,
    shelf: '#6d5136', goods: '#3b2c22', door: '#241f26', doorGlass: '#d7a55e', doorLight: '#f6e2b5',
  }),
});
export const SHOPFRONT_CANVAS = Object.freeze([512, 192]);

// Donde cae `along` (coordenada de mundo sobre el eje de la fachada) como fraccion 0..1 del plano, visto desde la
// calle: PlaneGeometry pone u = 0 en su -x local, y con rotationY 0 el -x local es el -x del mundo; con PI se da
// vuelta; con +-PI/2 el x local corre sobre z.
function fractionAlong(along, centre, width, rotationY) {
  const sign = rotationY === 0 ? 1 : rotationY === Math.PI ? -1 : rotationY > 0 ? -1 : 1;
  return 0.5 + sign * (along - centre) / width;
}

export function shopfronts(list = floatingSlabs()) {
  const out = [];
  for (const s of list) {
    const kit = SHOPFRONT_KIT[s.asset];
    const door = FRONT_DOOR_MAP.get(s.id);
    if (!kit || !door) continue;
    const w = s.walls;
    let x, z, rotationY, width, centre;
    if (door.axis === 'z') {
      const face = door.outward > 0 ? w.maxZ : w.minZ;
      z = r4(face + door.outward * kit.standoff); x = r4((w.minX + w.maxX) / 2); rotationY = door.outward > 0 ? 0 : Math.PI;
      width = r4(w.maxX - w.minX - 2 * kit.inset); centre = (w.minX + w.maxX) / 2;
    } else {
      const face = door.outward > 0 ? w.maxX : w.minX;
      x = r4(face + door.outward * kit.standoff); z = r4((w.minZ + w.maxZ) / 2); rotationY = door.outward > 0 ? Math.PI / 2 : -Math.PI / 2;
      width = r4(w.maxZ - w.minZ - 2 * kit.inset); centre = (w.minZ + w.maxZ) / 2;
    }
    const y0 = s.minY + s.wallBottom + kit.sill, y1 = s.minY + s.wallBottom + kit.head;
    const u0 = fractionAlong(door.along - door.width / 2, centre, width, rotationY);
    const u1 = fractionAlong(door.along + door.width / 2, centre, width, rotationY);
    out.push({
      id: s.id, asset: s.asset, x, y: r4((y0 + y1) / 2), z, rotationY, width, height: r4(y1 - y0),
      bottom: r4(y0), top: r4(y1), door: { u0: r4(Math.min(u0, u1)), u1: r4(Math.max(u0, u1)) }, kit,
    });
  }
  return out;
}

// Determinista, solo fillRect: marco, vidrio en dos tonos, parantes, dos estantes con bultos, y la puerta con su
// panel de vidrio y una franja de luz al costado. Ningun pintor LEE del contexto.
export function paintShopfront(ctx, spec) {
  const [W, H] = SHOPFRONT_CANVAS;
  const kit = spec.kit ?? SHOPFRONT_KIT.cityPackCommercialPurple;
  ctx.fillStyle = kit.frame;
  ctx.fillRect(0, 0, W, H);
  const gx = Math.round(W * 0.03), gy = Math.round(H * 0.07), gw = W - 2 * gx, gh = Math.round(H * 0.84);
  ctx.fillStyle = kit.glass;
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = kit.glassLow;
  ctx.fillRect(gx, gy + Math.round(gh * 0.62), gw, gh - Math.round(gh * 0.62));
  // estantes: dos bandas con bultos, que es lo que hace que se lea "local" y no "ventana"
  ctx.fillStyle = kit.shelf;
  for (const at of [0.46, 0.74]) ctx.fillRect(gx, gy + Math.round(gh * at), gw, Math.max(2, Math.round(gh * 0.035)));
  ctx.fillStyle = kit.goods;
  for (let i = 0; i < 14; i++) {
    const bx = gx + Math.round(gw * (0.04 + i * 0.066)), bw = Math.round(gw * (0.028 + (i % 3) * 0.008));
    ctx.fillRect(bx, gy + Math.round(gh * 0.46) - Math.round(gh * (0.09 + (i % 2) * 0.05)), bw, Math.round(gh * (0.09 + (i % 2) * 0.05)));
    ctx.fillRect(bx + 3, gy + Math.round(gh * 0.74) - Math.round(gh * (0.07 + ((i + 1) % 2) * 0.05)), bw, Math.round(gh * (0.07 + ((i + 1) % 2) * 0.05)));
  }
  // parantes
  ctx.fillStyle = kit.mullion;
  const mw = Math.max(3, Math.round(W * 0.012));
  for (let i = 1; i <= kit.mullions; i++) ctx.fillRect(gx + Math.round(gw * i / (kit.mullions + 1)) - (mw >> 1), gy, mw, gh);
  // la puerta, donde la midio el mapa: doble hoja de vidrio con marco oscuro y barra de empuje (la primera version
  // dejaba la mitad de abajo negra y se leia como un hueco, no como una puerta)
  const d0 = Math.round(W * spec.door.u0), d1 = Math.round(W * spec.door.u1), dw = d1 - d0;
  ctx.fillStyle = kit.door;
  ctx.fillRect(d0, gy, dw, gh);
  ctx.fillStyle = kit.doorGlass;
  const half = Math.round((dw - 3 * mw) / 2);
  ctx.fillRect(d0 + mw, gy + mw, half, gh - 2 * mw);
  ctx.fillRect(d0 + 2 * mw + half, gy + mw, dw - 3 * mw - half, gh - 2 * mw);
  ctx.fillStyle = kit.mullion;
  ctx.fillRect(d0 + mw, gy + Math.round(gh * 0.48), dw - 2 * mw, Math.max(2, Math.round(gh * 0.03)));
  ctx.fillStyle = kit.doorLight;
  ctx.fillRect(d1 + 2, gy + Math.round(gh * 0.1), Math.max(2, Math.round(W * 0.006)), Math.round(gh * 0.3));
  ctx.fillStyle = kit.frame;
  ctx.fillRect(0, gy + gh, W, H - gy - gh);
}
