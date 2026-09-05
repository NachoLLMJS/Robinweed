export const ASSET_URLS = Object.freeze({
  warehouse: Object.freeze({
    wall: '/models-v3/warehouse/concrete-wall.glb',
    loadingDoorFrame: '/models-v8/warehouse/automatic-loading-door-frame.glb',
    loadingDoorLeaf: '/models-v8/warehouse/automatic-loading-door-leaf.glb',
    growBench: '/models-v3/warehouse/grow-bench.glb',
    shelf: '/models-v3/warehouse/shelf.glb',
    growLight: '/models-v3/warehouse/grow-light.glb',
    vendorCounter: '/models-v3/warehouse/vendor-counter.glb',
  }),
  city: Object.freeze({
    shop: '/models-v5/city/shop.glb',
    house: '/models-v5/city/house.glb',
  }),
  street: Object.freeze({
    lamp: '/models-v9/street/streetlamp.glb',
    tree: '/models-v9/street/tree.glb',
    shrub: '/models-v9/street/shrub-planter.glb',
    van: '/models-v9/street/delivery-van.glb',
    loadingZone: '/models-v9/street/loading-zone-cluster.glb',
    furniture: '/models-v9/street/street-furniture-cluster.glb',
    neighborOlder: '/models-v9/street/neighbor-older-idle.glb',
    cat: '/models-v9/street/street-cat.glb',
    simpleHouseA: '/models-v10/city/simple-house-a.glb',
    simpleHouseB: '/models-v10/city/simple-house-b.glb',
  }),
  items: Object.freeze({
    seedPack: '/models-v7/items/robinhood-seed-pack-clean.glb',
  }),
  textures: Object.freeze({
    growthDiagram: '/textures/plant-growth-diagram.png',
  }),
  branding: Object.freeze({
    mark: '/brands/robinhood-chain-mark.svg',
  }),
  vendor: Object.freeze({
    idle: '/models-v3/characters/milo-idle.glb',
    talk: '/models-v3/characters/milo-talk.glb',
  }),
});

export function vendorClipForPanel(isOpen) {
  return isOpen ? 'talk' : 'idle';
}
