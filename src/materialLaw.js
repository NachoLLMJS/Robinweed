import * as THREE from 'three';

// One-material law: every GLB the game loads is normalised into the same cel/low-poly language.
// Photographic PBR slots are always stripped; profiles decide whether the colour map survives.
//
// Recalibrada por la VERIFICACION 2026-09-14 (paquete B2, §3.2) sobre la luz de A (?lighting=2) y el neon de G:
//  - el clamp de saturacion/luminosidad solo toca colores que la ley PRODUJO (paleta/promedio). Un asset cel que
//    ya viene plano es referencia, no problema: clampearlo sacaba el cartel del restaurante de
//    isRestaurantSignColor (B-1) y bajaba los blancos de las infill a bdbdbd (m-1). Los cinco numeros de
//    MATERIAL_LAW no cambian: son los mismos que K usa como MATERIAL_LIMITS (warehouseShellState.js los deriva
//    de aca: una sola ley, M-5).
//  - lo aplanado pierde el emissiveMap que A le dio a todo lo texturado, asi que lleva su color plano como
//    emisivo con intensidad 0 y la marca `userData.materialLawFlat`; el loader fija la intensidad a
//    LIGHTING.streetEmissive y lo registra en `nightTunedMaterials` (M-2, M-3). Este modulo es puro: no conoce
//    LIGHTING ni el pool.
//  - `lawVariants(root, url)` entrega, por malla, `off` (el material de hoy, intacto y dueno de sus texturas) y
//    `on` (la ley sobre un clon) para la perilla ?ley=0|1 (B-5, leyPresets.js). `applyMaterialLaw` (mutante)
//    se conserva para tests y para quien quiera la ley sin vuelta atras.
//  - el restaurante exterior lleva perfil `skip`: su cartel es de G (T49) y parpadea por referencia.
export const MATERIAL_LAW = Object.freeze({
  roughnessMin: .55,
  roughnessMax: 1,
  metalnessMax: .25,
  saturationMax: .58,
  lightnessMin: .06,
  lightnessMax: .74,
  photoMapSlots: Object.freeze(['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'specularIntensityMap', 'clearcoatNormalMap']),
  colorMapSlots: Object.freeze(['map', 'emissiveMap', 'lightMap', 'alphaMap']),
});

// Inventory law: what may be committed to public/ without an explicit runtime profile.
export const INVENTORY_LAW = Object.freeze({
  maxEmbeddedImages: 4,
  maxTextureBytes: 8 * 1024 * 1024,
});

export const DEFAULT_PROFILE = Object.freeze({ id: 'default', flatten: 'none', flat: false });

export const LAW_PROFILES = Object.freeze({
  '/models-v19/warehouse/warehouse.glb': Object.freeze({
    id: 'warehouse-shell',
    flatten: 'palette',
    flat: true,
    roughness: .94,
    metalness: 0,
    fallbackColor: 0x8d948a,
    // M-3: bare y DoorsRollup al tope del rango que el paquete daba (#8d948a..#a2a99d, #1f5245..#3c8a72): con la
    // paleta original y sin el emissiveMap de A el galpon quedaba apagado de noche (muro 79/79/76, persiana
    // #133b29 medidos por la lente ley). El resto de la paleta no cambia.
    palette: Object.freeze({
      bare: 0xa2a99d,
      atlas_784: 0x9aa197,
      z854d: 0x7e857b,
      atlas_512: 0x6e7569,
      brick: 0x6d4a3b,
      DoorsRollup: 0x3c8a72,
      eletricBox: 0x59605a,
      air_conditioning: 0x9aa295,
      rusty_light_bulb: 0xffe0a8,
    }),
    emissive: Object.freeze({ rusty_light_bulb: Object.freeze({ color: 0xffb45c, intensity: 1.1 }) }),
    reason: '26 photoscanned PBR maps, 68 MiB: mirrored concrete and a photographed blue shutter at the spawn.',
  }),
  '/models-v17/city/restaurant.glb': Object.freeze({
    id: 'restaurant-exterior',
    flatten: 'none',
    flat: false,
    skip: true,
    reason: '22 flat-colour cel materials; the broken-neon sign is owned by G (T49) and flickers by reference: nothing to normalise.',
  }),
  // M-2: los dos perfiles `average` llevaban lightnessScale 1 (el .82/.95 del paquete se midio con la luz vieja y
  // dejaba el restaurante interior negro y la torre a la mitad bajo ?lighting=2); el auto-iluminado lo pone el
  // emisivo plano de arriba. Medido en T11 (Chrome real, ?lighting=2, evidencia/paqB2/ejecucion/T11.md §3): el
  // restaurante llega con 1 (cuadro 17/11/9 -> 18/13/11, techo 20/11/10 igual); la torre no (44/43/31 -> 28/30/19)
  // y sube en pasos de .1: 1.3 da 37/39/26, 1.4 da 40/42/29 (>= 40/39/28). tests/assetLawGuard.test.js los fija.
  '/models-v17/interiors/restaurant-in-the-evening.glb': Object.freeze({
    id: 'restaurant-interior',
    flatten: 'average',
    flat: true,
    roughness: .9,
    metalness: 0,
    lightnessScale: 1,
    fallbackColor: 0x4a3a33,
    reason: '45 photographic materials (brick, damask, oil paintings): each map collapses to its own average colour.',
  }),
  '/models-v38/warehouse/hydroponic-tower.glb': Object.freeze({
    id: 'hydroponic-tower',
    flatten: 'average',
    flat: true,
    roughness: .78,
    metalness: .18,
    lightnessScale: 1.4,
    fallbackColor: 0x7d857c,
    reason: '7 generator maps with chrome/PVC shading that reads realistic next to the cel plants.',
  }),
  '/models-v20/city/low-poly-house-67-ground-clean.glb': Object.freeze({
    id: 'orphan-infill-house',
    flatten: 'none',
    flat: false,
    reason: 'Orphan on purpose: infillHouse5 stays in the manifest and its lot is replaced by cityPackMotel; assetManifest.test.js:102 forbids loading it. Kept out of the law; do not delete without touching those tests.',
  }),
});

export function assetKey(url) {
  return String(url ?? '').split('?')[0];
}

export function profileForAsset(url) {
  return LAW_PROFILES[assetKey(url)] ?? DEFAULT_PROFILE;
}

export function averageColorFromPixels(pixels) {
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    if (alpha <= 0) continue;
    r += pixels[i] * alpha; g += pixels[i + 1] * alpha; b += pixels[i + 2] * alpha; weight += alpha;
  }
  if (weight <= 0) return null;
  return { r: Math.round(r / weight), g: Math.round(g / weight), b: Math.round(b / weight) };
}

const SAMPLE_SIZE = 16;
export function sampleAverageColor(texture) {
  const image = texture?.image;
  if (!image || typeof OffscreenCanvas === 'undefined') return null;
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  if (!width || !height) return null;
  try {
    const canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const average = averageColorFromPixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
    return average ? (average.r << 16) | (average.g << 8) | average.b : null;
  } catch {
    return null;
  }
}

export function flatColorForMaterial(material, profile) {
  if (profile.flatten === 'palette') {
    const hex = profile.palette?.[material.name];
    return typeof hex === 'number' ? hex : profile.fallbackColor ?? null;
  }
  if (profile.flatten === 'average') return sampleAverageColor(material.map) ?? profile.fallbackColor ?? null;
  return null;
}

export function clampLawColor(color, profile = DEFAULT_PROFILE, law = MATERIAL_LAW) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, THREE.SRGBColorSpace);
  const saturation = Math.min(hsl.s, law.saturationMax);
  const scaled = hsl.l * (profile.lightnessScale ?? 1);
  const lightness = Math.min(Math.max(scaled, law.lightnessMin), law.lightnessMax);
  color.setHSL(hsl.h, saturation, lightness, THREE.SRGBColorSpace);
  return color;
}

// `dispose: false` is for clones whose source still draws with the same textures (lawVariants).
export function applyLawToMaterial(material, profile = DEFAULT_PROFILE, law = MATERIAL_LAW, { dispose = true } = {}) {
  if (profile.skip) return material;
  const flattening = profile.flatten !== 'none';
  const drop = slot => {
    if (!material[slot]) return;
    if (dispose) material[slot].dispose?.();
    material[slot] = null;
  };
  if (flattening) {
    const flat = flatColorForMaterial(material, profile);
    for (const slot of law.colorMapSlots) drop(slot);
    if (flat != null && material.color) material.color.setHex(flat, THREE.SRGBColorSpace);
  }
  for (const slot of law.photoMapSlots) drop(slot);
  if (typeof material.roughness === 'number') material.roughness = profile.roughness ?? Math.min(law.roughnessMax, Math.max(law.roughnessMin, material.roughness));
  if (typeof material.metalness === 'number') material.metalness = profile.metalness ?? Math.min(law.metalnessMax, material.metalness);
  if (profile.flat) material.flatShading = true;
  material.userData = material.userData ?? {};
  // The clamp only touches colours the law produced (palette/average). A cel asset that already comes flat is
  // the reference, not the problem: clamping it pulled the restaurant sign out of isRestaurantSignColor (B-1)
  // and every white frame down to bdbdbd (m-1). With a surviving colour map, material.color is a multiplier.
  if (material.color && !material.map && profile.flatten !== 'none') clampLawColor(material.color, profile, law);
  if (flattening && material.emissive) {
    const glow = profile.emissive?.[material.name];
    if (glow) {
      material.emissive.setHex(glow.color, THREE.SRGBColorSpace);
      material.emissiveIntensity = glow.intensity;
    } else {
      // The emissiveMap A gave every textured asset went with the photo: the flat colour takes its place, at
      // intensity 0 here. The loader sets LIGHTING.streetEmissive and adds the material to the night pool.
      if (material.color) material.emissive.copy(material.color); else material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
      material.userData.materialLawFlat = true;
    }
  }
  material.userData.materialLaw = profile.id;
  material.needsUpdate = true;
  return material;
}

// Mutating form: the law applied in place, once per material (a shared material is visited once). `flattened`
// lists the materials that now carry their flat colour as emissive, for the loader to register in the pool.
export function applyMaterialLaw(root, url, law = MATERIAL_LAW) {
  const profile = profileForAsset(url);
  const flattened = [];
  let materials = 0;
  if (profile.skip) return { profile: profile.id, materials, flattened };
  root?.traverse?.(object => {
    if (!object.isMesh) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material || material.userData?.materialLaw) continue;
      applyLawToMaterial(material, profile, law);
      materials++;
      if (material.userData.materialLawFlat) flattened.push(material);
    }
  });
  return { profile: profile.id, materials, flattened };
}

// Off/on per mesh for the ?ley=0|1 knob (B-5). `off` is the material the mesh carries today, whatever
// tuneNightMaterials and the loader callbacks left there (the neon of G, the tint of ?casas), untouched and still
// owning its textures; `on` is the law applied to a clone, marked `userData.materialLaw = profile.id` (and
// `materialLawFlat` when flattened). A material shared by several meshes gets ONE clone, so `on` stays shared
// too. Nothing is switched here: the loader does `mesh.material = law ? on : off`. A skipped profile yields [].
export function lawVariants(root, url, law = MATERIAL_LAW) {
  const profile = profileForAsset(url);
  const variants = [];
  if (profile.skip) return variants;
  const clones = new Map();
  const onFor = material => {
    if (!material) return material;
    let clone = clones.get(material);
    if (!clone) {
      clone = material.clone();
      // Material.clone() serialises userData through JSON and a THREE.Color there becomes a number: ?casas keeps
      // `baseColor`/`baseEmissive` as Colors and syncCasas (main.js) reads `.r`, so every Color comes back as its own clone.
      for (const [key, value] of Object.entries(material.userData ?? {})) if (value?.isColor) clone.userData[key] = value.clone();
      clone = applyLawToMaterial(clone, profile, law, { dispose: false });
      clones.set(material, clone);
    }
    return clone;
  };
  root?.traverse?.(object => {
    if (!object.isMesh || !object.material) return;
    const off = object.material;
    const on = Array.isArray(off) ? off.map(onFor) : onFor(off);
    variants.push({ mesh: object, off, on });
  });
  return variants;
}

export function inventoryViolations({ images = 0, textureBytes = 0 }, law = INVENTORY_LAW) {
  const violations = [];
  if (images > law.maxEmbeddedImages) violations.push(`${images} embedded images > ${law.maxEmbeddedImages}`);
  if (textureBytes > law.maxTextureBytes) violations.push(`${Math.round(textureBytes / 1024)} KB of texture > ${Math.round(law.maxTextureBytes / 1024)} KB`);
  return violations;
}
