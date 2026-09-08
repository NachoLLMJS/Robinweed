import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { stageFor, STAGES, plantSeed, waterPlant, advancePlant, harvestPlant } from './plantState.js';
import { InputController } from './inputController.js';
import { movementVector } from './movementMath.js';
import { moveCircle } from './collisionMath.js';
import { ASSET_URLS, vendorClipForPanel } from './assetManifest.js';
import { INITIAL_PLAYER_SPAWN, portalFor, boundsForLocation, cityBuildingFor } from './navigationState.js';
import { VENDOR_NAME } from './branding.js';
import { supportedOriginY } from './placementMath.js';
import { loadingDoorTarget, advanceLoadingDoor } from './loadingDoorState.js';
import { STREET_LAYOUT, advanceVehicleRoute, advancePatrol } from './streetLifeState.js';
import { fitScaleForWorldBox } from './assetFit.js';
import {
  RESTAURANT_EXTERIOR_INTERACTION,
  RESTAURANT_INTERIOR_LAYOUT,
} from './restaurantExperience.js';
import { warehouseVisibilityForLocation } from './warehouseVisibilityState.js';
import { trailerButtonsVisible, spectatorFlightDelta } from './loaderState.js';
import { isHouseheadNearby, nextHouseheadPanel } from './househeadSwapState.js';
import { isNeighborGuideNearby } from './neighborGuideState.js';
import { SEED_VARIETIES, tickerForSlot } from './seedVarietyState.js';
import { VENDOR_SEED_PRODUCTS } from './vendorSeedShopState.js';
import { HOUSE_PROPERTIES, propertyNear, purchasePreview, propertyAccess, streetSpawnForProperty } from './housePropertyState.js';
import { matureBudVariant } from './matureBudState.js';
import { assignSessionPlayerSkin, PLAYER_SKINS } from './playerSkinState.js';
import { WAREHOUSE_GROW_STATIONS, WAREHOUSE_DECOR, WAREHOUSE_JARS, WAREHOUSE_JAR_BUD_PLACEMENTS, stationCollider } from './warehouseExpansionState.js';
import { vendorYawTowardPlayer } from './vendorOrientationState.js';
import { createSerializedAuthenticator, isSameWalletAddress, MultiplayerClient } from './multiplayerClient.js';
import { advanceCadence, beginRemoteMotion, reconcilePredictedPosition, sampleRemoteMotion } from './multiplayerSmoothing.js';
import { executeCultivationAction, executeHousePurchase, executeSeedPurchase, loadEconomyConfig, reconcileEconomyJournal } from './economyRuntime.js';
import { onchainPropertyId, propertyIdFromOnchain } from './onchainPropertyCatalog.js';
import { validateOnchainSnapshot } from './onchainSnapshot.js';
import './style.css';

const canvas = document.querySelector('#world');
const qaEnabled=import.meta.env.DEV&&new URLSearchParams(location.search).has('qa');
SEED_VARIETIES.forEach(({slot,color})=>document.querySelector(`.hotbar button[data-slot="${slot}"]`)?.style.setProperty('--seed-color',color));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const vendorPreviewCanvas=document.querySelector('#vendorPackPreview');
const vendorPreviewRenderer=new THREE.WebGLRenderer({canvas:vendorPreviewCanvas,antialias:true,alpha:true,powerPreference:'high-performance'});
vendorPreviewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));vendorPreviewRenderer.setSize(480,360,false);vendorPreviewRenderer.outputColorSpace=THREE.SRGBColorSpace;vendorPreviewRenderer.toneMapping=THREE.ACESFilmicToneMapping;vendorPreviewRenderer.toneMappingExposure=1.28;
const vendorPreviewScene=new THREE.Scene();
const vendorPreviewCamera=new THREE.PerspectiveCamera(34,4/3,.01,20);vendorPreviewCamera.position.set(0,.3,4.2);vendorPreviewCamera.lookAt(0,0,0);
vendorPreviewScene.add(new THREE.HemisphereLight(0xdfffc4,0x10150d,3));const vendorPreviewKey=new THREE.DirectionalLight(0xffffff,3.4);vendorPreviewKey.position.set(3,4,4);vendorPreviewScene.add(vendorPreviewKey);const vendorPreviewRim=new THREE.DirectionalLight(0x9cff57,2.2);vendorPreviewRim.position.set(-3,1,-2);vendorPreviewScene.add(vendorPreviewRim);
let vendorPreviewModel=null,vendorPreviewLoad=0,vendorSelectedProduct=VENDOR_SEED_PRODUCTS[0];
let economyConfig={chainId:4663,economyActive:false,currency:null,contracts:[]};
const vendorBuyButton=document.querySelector('#buySelectedSeeds');
function updateVendorEconomyButton(){const hood=vendorSelectedProduct.ticker==='HOOD';const ready=economyConfig.economyActive&&!hood;vendorBuyButton.disabled=!ready;vendorBuyButton.textContent=hood?'HOOD STOCK TOKEN UNAVAILABLE':ready?`BUY ${vendorSelectedProduct.packSize} SEEDS ONCHAIN`:'ECONOMY NOT ACTIVE';}
function disposeVendorPreview(){if(!vendorPreviewModel)return;vendorPreviewModel.traverse(object=>{if(!object.isMesh)return;object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{for(const value of Object.values(material||{}))if(value?.isTexture)value.dispose();material?.dispose();});});vendorPreviewScene.remove(vendorPreviewModel);vendorPreviewModel=null;}
function loadVendorPackPreview(product){const request=++vendorPreviewLoad;new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(product.assetUrl,gltf=>{if(request!==vendorPreviewLoad)return;disposeVendorPreview();const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=2.45/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,-center.y*scale,-center.z*scale);model.rotation.set(-.12,-.48,.05);model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});vendorPreviewModel=model;vendorPreviewScene.add(model);},undefined,error=>console.warn(`Stockdealer · ${product.ticker} shop preview unavailable`,error));}
function selectVendorProduct(product){vendorSelectedProduct=product;document.querySelector('#vendorSelectedTicker').textContent=product.ticker;document.querySelector('#vendorSwapRoute').textContent=`60% $STOCKDEALER → ${product.ticker} REWARD RESERVE`;document.querySelectorAll('.vendor-seed-option').forEach(button=>button.classList.toggle('active',button.dataset.ticker===product.ticker));updateVendorEconomyButton();loadVendorPackPreview(product);}
VENDOR_SEED_PRODUCTS.forEach(product=>{const button=document.createElement('button');button.className='vendor-seed-option';button.dataset.ticker=product.ticker;button.style.setProperty('--product-color',product.color);button.innerHTML=`<span class="vendor-seed-swatch">${product.ticker}</span><strong>${product.ticker}</strong><small>${product.packSize} SEEDS · ${product.tokenPrice} $STOCKDEALER</small>`;button.addEventListener('click',()=>selectVendorProduct(product));document.querySelector('#vendorSeedGrid').append(button);});
selectVendorProduct(vendorSelectedProduct);
loadEconomyConfig().then(config=>{economyConfig=config;updateVendorEconomyButton();}).catch(()=>updateVendorEconomyButton());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c110b);
scene.fog = new THREE.FogExp2(0x0c110b, 0.031);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 80);
camera.position.set(INITIAL_PLAYER_SPAWN.x, 1.68, INITIAL_PLAYER_SPAWN.z);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xb9d49c, 0x182015, 1.85);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xfff4df,.38));
const moon = new THREE.DirectionalLight(0xb6cbff, 1.6);
moon.position.set(-4, 8, 3);
moon.castShadow = false;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -18;
moon.shadow.camera.right = 18;
moon.shadow.camera.top = 18;
moon.shadow.camera.bottom = -18;
moon.shadow.camera.near = .1;
moon.shadow.camera.far = 45;
moon.shadow.bias = -.0004;
scene.add(moon);

// Layered night sky: moon, stars and slow cloud silhouettes replace the flat void.
const moonDisc=new THREE.Mesh(new THREE.SphereGeometry(2.2,20,14),new THREE.MeshBasicMaterial({color:0xfff2bd,fog:false}));
moonDisc.position.set(-13,14,41);scene.add(moonDisc);
const starPositions=[];
for(let i=0;i<150;i++){const a=i*2.39996;const radius=22+(i%17)*1.45;starPositions.push(Math.cos(a)*radius,7+(i*13%19)*.75,18+Math.sin(a)*radius);}
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xcfe8cf,size:.075,sizeAttenuation:true,fog:false}));scene.add(stars);
const nightClouds=[];
const cloudMaterial=new THREE.MeshBasicMaterial({color:0x172c2a,transparent:true,opacity:.66,fog:false});
for(const [x,y,z,s] of [[-10,10,31,1.4],[8,12,38,1.8],[-4,15,48,2.1]]){const cloud=new THREE.Group();for(const [ox,oy,os] of [[-1,0,.75],[0,.25,1],[1,0,.68]]){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(os,1),cloudMaterial);puff.scale.set(1.8,.62,.55);puff.position.set(ox,oy,0);cloud.add(puff);}cloud.position.set(x,y,z);cloud.scale.setScalar(s);scene.add(cloud);nightClouds.push(cloud);}

const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0xb8c0b3, roughness: .96 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x77786f, roughness: .92, metalness: .02 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x493a27, roughness: .9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x303832, roughness: .46, metalness: .55 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 1 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x4c5547, roughness: .85 }),
  lime: new THREE.MeshStandardMaterial({ color: 0x91ff2b, emissive: 0x284d0d, emissiveIntensity: .65 }),
};

function mesh(geo, mat, pos, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
}
function box(size, mat, pos) { return mesh(new THREE.BoxGeometry(...size), mat, pos); }
const portalHitboxes=[];
function portalHit(size,pos,id){const hit=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(...pos);hit.userData.interactive={type:'portal',id};scene.add(hit);portalHitboxes.push(hit);return hit;}

// Playable legacy shell is an interior layer only; the supplied GLB owns the street exterior.
const legacyWarehouseShell=[];
function legacyWarehouseBox(size,material,position,cast=false){const item=box(size,material,position,cast);legacyWarehouseShell.push(item);return item;}
legacyWarehouseBox([14, .25, 16], mats.floor, [0, -.13, 0], false);
legacyWarehouseBox([14, 4.2, .25], mats.wall, [0, 2.05, -8], false);
legacyWarehouseBox([.25, 4.2, 16], mats.wall, [-7, 2.05, 0], false);
legacyWarehouseBox([.25, 4.2, 16], mats.wall, [7, 2.05, 0], false);
legacyWarehouseBox([5.85,4.2,.25],mats.wall,[-4.08,2.05,8],false);
legacyWarehouseBox([5.85,4.2,.25],mats.wall,[4.08,2.05,8],false);
legacyWarehouseBox([2.3,1.48,.25],mats.wall,[0,3.46,8],false);
const loadingDoorJambWidth=.22;
const loadingDoorJambMaterial=new THREE.MeshStandardMaterial({color:0x173c2b,roughness:.68,metalness:.35});
legacyWarehouseBox([loadingDoorJambWidth,3.25,.3],loadingDoorJambMaterial,[-1.05,1.625,7.96],false);
legacyWarehouseBox([loadingDoorJambWidth,3.25,.3],loadingDoorJambMaterial,[1.05,1.625,7.96],false);
const ceiling = legacyWarehouseBox([14, .16, 16], mats.wall, [0, 4.1, 0], false);
ceiling.material = ceiling.material.clone(); ceiling.material.color.setHex(0x171b16);
portalHit([1.85,2.7,.35],[0,1.35,7.5],'warehouse-exit');
portalHit([1.85,2.7,.35],[0,1.35,8.45],'warehouse-entrance');
legacyWarehouseBox([.62,4.05,.62],mats.wall,[0,2.02,1.25],false);
const ceilingPanelMaterial=new THREE.MeshStandardMaterial({color:0xfff4d2,emissive:0xffdca0,emissiveIntensity:1.6,roughness:.35});
for(const x of [-4.2,0,4.2]){
  box([1.05,.045,.58],ceilingPanelMaterial,[x,3.98,2.3],false);
  const roomLight=new THREE.PointLight(0xffe3b5,3.2,8,2);roomLight.position.set(x,3.72,2.3);scene.add(roomLight);
}

// Architectural ribs, shelves and clutter
const architecturalFallback=[];
for (let z = -6; z <= 6; z += 3) {
  architecturalFallback.push(box([.16, 4, .16], mats.metal, [-6.7, 2, z]));
  architecturalFallback.push(box([.16, 4, .16], mats.metal, [6.7, 2, z]));
}
architecturalFallback.forEach(item=>item.visible=false);
legacyWarehouseBox([14,.42,.12],mats.metal,[0,.21,-7.82]);
legacyWarehouseBox([.12,.42,16],mats.metal,[-6.82,.21,0]);
legacyWarehouseBox([.12,.42,16],mats.metal,[6.82,.21,0]);
const shelfFallback=[];
for (const y of [.5, 1.3, 2.1]) shelfFallback.push(box([3.4, .1, .7], mats.wood, [-4.9, y, -5.9]));
for (let i=0;i<8;i++) {
  const crate = box([.55 + (i%2)*.18, .38, .5], i%3 ? mats.wood : mats.metal, [-5.9+(i%3)*.75, .28+Math.floor(i/3)*.42, -6]);
  crate.rotation.y = (i%2)*.12;
  shelfFallback.push(crate);
}

// Eight grow stations: the original rear row plus four side stations that preserve the central aisle.
const benchFallback=[];
for(const station of WAREHOUSE_GROW_STATIONS){
  benchFallback.push(box([1.18,.12,.92],mats.wood,[station.x,.78,station.z]));
  for(const x of [station.x-.48,station.x+.48])for(const z of [station.z-.34,station.z+.34])benchFallback.push(box([.09,.78,.09],mats.metal,[x,.39,z]));
}
const growLights = [];
const lightFixtureFallback=[];
const suspensionMaterial=new THREE.MeshStandardMaterial({color:0xaeb6ad,roughness:.52,metalness:.62});
for(const station of WAREHOUSE_GROW_STATIONS) {
  const {x,z}=station;
  const fixture = box([1.15,.12,.38], mats.metal,[x,3.08,z]);
  lightFixtureFallback.push(fixture);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(.96,.035,.26), mats.lime);
  panel.position.set(0,-.08,0); fixture.add(panel);
  for(const cableX of [x-.38,x+.38]){
    box([.032,.92,.032],suspensionMaterial,[cableX,3.55,z]);
    box([.14,.045,.14],suspensionMaterial,[cableX,3.99,z],false);
  }
  box([.9,.06,.12],suspensionMaterial,[x,4.01,z]);
  const light = new THREE.PointLight(0xaaff69, 6.4, 4.6, 1.8); light.position.set(x,2.93,z); scene.add(light); growLights.push(light);
}

// Illustrated plant-growth board behind the vendor counter
const growthDiagramTexture=new THREE.TextureLoader().load(ASSET_URLS.textures.growthDiagram);
growthDiagramTexture.colorSpace=THREE.SRGBColorSpace;
const boardFrame=box([4.2,2.42,.12],mats.metal,[3.6,2.25,-7.8]);
const boardGraphic=new THREE.Mesh(new THREE.PlaneGeometry(3.9,2.19),new THREE.MeshBasicMaterial({map:growthDiagramTexture,toneMapped:false}));
boardGraphic.position.set(0,0,.07);boardFrame.add(boardGraphic);

// Branded wall sign built from geometry/DOM-like canvas texture
const labelCanvas=document.createElement('canvas'); labelCanvas.width=1024;labelCanvas.height=256;
const ctx=labelCanvas.getContext('2d');
const signLeft='STOCK';const signAccent='DEALER';const signGap=18;const signMaxWidth=964;
ctx.fillStyle='#0b0f0a';ctx.fillRect(0,0,1024,256);
let signFontSize=130;ctx.font=`900 ${signFontSize}px Arial`;
let signLeftWidth=ctx.measureText(signLeft).width;let signAccentWidth=ctx.measureText(signAccent).width;let signTotalWidth=signLeftWidth+signGap+signAccentWidth;
if(signTotalWidth>signMaxWidth){signFontSize*=signMaxWidth/signTotalWidth;ctx.font=`900 ${signFontSize}px Arial`;signLeftWidth=ctx.measureText(signLeft).width;signAccentWidth=ctx.measureText(signAccent).width;signTotalWidth=signLeftWidth+signGap+signAccentWidth;}
const signX=(labelCanvas.width-signTotalWidth)/2;ctx.fillStyle='#eef5e8';ctx.fillText(signLeft,signX,175);ctx.fillStyle='#9cff38';ctx.fillText(signAccent,signX+signLeftWidth+signGap,175);
const tex=new THREE.CanvasTexture(labelCanvas);tex.colorSpace=THREE.SRGBColorSpace;
const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),new THREE.MeshBasicMaterial({map:tex}));sign.position.set(-3.6,2.65,-7.83);scene.add(sign);

function normalizeAsset(model,targetHeight){const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetHeight/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>material.side=THREE.DoubleSide);}});const wrapper=new THREE.Group();wrapper.add(model);return wrapper;}
console.info('Stockdealer · rectilinear warehouse shell retained after V3 wall QA');
new GLTFLoader().load(ASSET_URLS.warehouse.growBench,gltf=>{const template=normalizeAsset(gltf.scene,.84);for(const station of WAREHOUSE_GROW_STATIONS){const bench=template.clone(true);bench.scale.x=.62;bench.position.set(station.x,0,station.z);scene.add(bench);}benchFallback.forEach(item=>item.visible=false);console.info('Stockdealer · eight Meshy V3 grow tables aligned with pots');},undefined,error=>console.warn('Stockdealer · grow bench fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.shelf,gltf=>{const shelf=normalizeAsset(gltf.scene,2.35);shelf.position.set(-4.9,0,-5.9);scene.add(shelf);shelfFallback.forEach(item=>item.visible=false);console.info('Stockdealer · Meshy V3 shelf loaded');},undefined,error=>console.warn('Stockdealer · shelf fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.growLight,gltf=>{const template=normalizeAsset(gltf.scene,.9);for(const station of WAREHOUSE_GROW_STATIONS){const fixture=template.clone(true);fixture.position.set(station.x,3.08,station.z);scene.add(fixture);}lightFixtureFallback.forEach(item=>item.visible=false);console.info('Stockdealer · eight suspended Meshy V3 grow lights loaded');},undefined,error=>console.warn('Stockdealer · grow light fallback',error));
const loadingDoorPosition={x:0,z:7.82};
const loadingDoorTravel=2.7;
let loadingDoorLeaf=null;
let loadingDoorOpen=0;
function loadLoadingDoorPart(url,label,isLeaf=false){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const scale=3.25/1.0003;model.scale.setScalar(scale);model.position.set(-.00098*scale,.5*scale,0);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>{if(material.map){material.emissiveMap=material.map;material.emissive?.setScalar(.42);material.emissiveIntensity=.42;}material.roughness=.62;});}});const part=new THREE.Group();part.add(model);part.position.set(loadingDoorPosition.x,0,loadingDoorPosition.z);scene.add(part);legacyWarehouseShell.push(part);part.visible=warehouseVisibilityForLocation(state?.location).legacyInterior;if(isLeaf)loadingDoorLeaf=part;console.info(`Stockdealer · Meshy V8 automatic loading door ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · loading door ${label} fallback`,error));}
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorFrame,'frame');
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorLeaf,'leaf',true);
const loadingDoorLight=new THREE.PointLight(0xb9ff9a,2.4,5.2,2);loadingDoorLight.position.set(0,3.55,7.15);scene.add(loadingDoorLight);legacyWarehouseShell.push(loadingDoorLight);
function normalizeLargest(model,targetSize,alignTop=false){const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetSize/Math.max(size.x,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,(alignTop?-bounds.max.y:-bounds.min.y)*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const wrapper=new THREE.Group();wrapper.add(model);return wrapper;}
const warehouseExpansionObjects=[];
function loadWarehouseProp(url,placements,label,mode='height'){
  const list=Array.isArray(placements)?placements:[placements];
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url,gltf=>{
    const first=list[0];
    const template=mode==='largest'?normalizeLargest(gltf.scene,first.targetSize,true):normalizeAsset(gltf.scene,first.targetHeight);
    list.forEach((placement,index)=>{
      const instance=index===0?template:template.clone(true);
      instance.position.set(...placement.position);instance.rotation.y=placement.rotationY??0;instance.userData.qaLabel=label;
      scene.add(instance);warehouseExpansionObjects.push(instance);
    });
    console.info(`Stockdealer · Meshy warehouse ${label} loaded ×${list.length}`);
  },undefined,error=>console.warn(`Stockdealer · warehouse ${label} omitted`,error));
}
loadWarehouseProp(ASSET_URLS.warehouse.soilPallet,WAREHOUSE_DECOR.soilPallet,'soil pallet');
loadWarehouseProp(ASSET_URLS.warehouse.airConditioner,WAREHOUSE_DECOR.airConditioner,'wall air conditioner');
loadWarehouseProp(ASSET_URLS.warehouse.exhaustFan,WAREHOUSE_DECOR.fans,'exhaust fan');
loadWarehouseProp(ASSET_URLS.warehouse.recyclingBin,WAREHOUSE_DECOR.recyclingBin,'recycling bin');
const roadMaterial=new THREE.MeshStandardMaterial({color:0x242827,roughness:.98});
const curbMaterial=new THREE.MeshStandardMaterial({color:0x999d91,roughness:1});
const grassMaterials=[
  new THREE.MeshStandardMaterial({color:0x2f7429,roughness:1,flatShading:true}),
  new THREE.MeshStandardMaterial({color:0x356f2b,roughness:1,flatShading:true}),
];
STREET_LAYOUT.grass.forEach((patch,index)=>box([patch.width,.08,patch.depth],grassMaterials[index%grassMaterials.length],[patch.x,-.01,patch.z],false));
box([8.4,.08,104],roadMaterial,[0,-.02,58],false);
for(const x of [-5.1,5.1]){
  box([1.8,.16,24.4],curbMaterial,[x,.04,18.2],false);
  box([1.8,.16,72.4],curbMaterial,[x,.04,73.8],false);
}
const streetIntersection=box([STREET_LAYOUT.crossStreet.width,.08,STREET_LAYOUT.crossStreet.depth],roadMaterial,[STREET_LAYOUT.crossStreet.x,-.015,STREET_LAYOUT.crossStreet.z],false);
STREET_LAYOUT.crossCurbs.forEach(curb=>box([curb.width,.16,curb.depth],curbMaterial,[curb.x,.04,curb.z],false));
const laneMaterial=new THREE.MeshStandardMaterial({color:0xd7d3b2,roughness:.9});
for(const z of [9,17,21,25,29,39,43,47,51,55,59,63,67,71,75,79,83,87,91,95,99,103,107])box([.1,.012,2.1],laneMaterial,[0,.03,z],false);
for(const x of [-49,-45,-41,-37,-33,-29,-25,-21,-17,-13,-9,-5,5,9,13,17,21,25,29,33,37,41,45,49])box([2.1,.012,.1],laneMaterial,[x,.03,STREET_LAYOUT.intersectionZ],false);
const crossingMaterial=new THREE.MeshStandardMaterial({color:0xe7e3cf,roughness:.94});
for(const x of [-3.3,-2.2,-1.1,0,1.1,2.2,3.3])box([.56,.016,2.1],crossingMaterial,[x,.035,STREET_LAYOUT.crossingZ],false);
const shopLayout=cityBuildingFor('shop');
const houseLayout=cityBuildingFor('house');
portalHit([.35,2.7,1.1],[shopLayout.portalX,1.35,shopLayout.portalZ],'shop-entrance');
loadCenteredFittedAsset(
  ASSET_URLS.city.shop,
  { x: shopLayout.positionX, z: shopLayout.positionZ, height: 5.4, maxWidthX: 4.2, maxDepthZ: 6, groundY: .02, rotationY: 0, scaleY: 1.7, scaleZ: 1.8 },
  'city pack residential 9004 replacement',
);
new GLTFLoader().load(ASSET_URLS.city.house,gltf=>{const building=normalizeAsset(gltf.scene,5.8);building.rotation.y=-Math.PI/2;building.position.set(houseLayout.positionX,houseLayout.positionY,houseLayout.positionZ);scene.add(building);console.info('Stockdealer · complete one-piece cute Meshy V5 house loaded');},undefined,error=>console.warn('Stockdealer · V5 house omitted',error));

// Meshy V9 street-life layer. Repeated objects share one downloaded template.
const streetActors={};
const streetMixers=[];
let househeadMixer=null;
let foxWalkerMixer=null;
let neonCatWalkerMixer=null;
const streetLights=[];
function tuneNightMaterials(root,intensity=.12){root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(material=>{const tuned=material.clone();if(tuned.map&&tuned.emissive){tuned.emissiveMap=tuned.map;tuned.emissive.set(0xffffff);tuned.emissiveIntensity=intensity;}tuned.roughness=Math.max(.48,tuned.roughness??.75);return tuned;});if(object.material.length===1)object.material=object.material[0];});}
const streetAssetLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function loadStreetSet(url,height,placements,label,onPlace){streetAssetLoader.load(url,gltf=>{const fitted=placements[0]?.maxWidthX?fitScaleForWorldBox(new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()),{maxWidthX:placements[0].maxWidthX,maxDepthZ:placements[0].maxDepthZ,maxHeight:placements[0].height},placements[0].rotationY??0):null;const template=normalizeAsset(gltf.scene,fitted?new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y*fitted:height);tuneNightMaterials(template);placements.forEach((placement,index)=>{const instance=index===0?template:template.clone(true);instance.position.set(placement.x,placement.groundY??placement.y??.08,placement.z);instance.rotation.y=placement.rotationY??0;scene.add(instance);onPlace?.(instance,placement,index,gltf.animations);});console.info(`Stockdealer · Meshy street asset ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · street asset ${label} omitted`,error));}
function loadCenteredFittedAsset(url,placement,label,onLoad){const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);loader.load(url,gltf=>{const model=gltf.scene;tuneNightMaterials(model);const rawBounds=new THREE.Box3().setFromObject(model);const rawSize=rawBounds.getSize(new THREE.Vector3());const rawCenter=rawBounds.getCenter(new THREE.Vector3());const scale=fitScaleForWorldBox(rawSize,{maxWidthX:placement.maxWidthX,maxDepthZ:placement.maxDepthZ,maxHeight:placement.height},placement.rotationY??0);model.scale.setScalar(scale);model.position.set(-rawCenter.x*scale,-rawBounds.min.y*scale,-rawCenter.z*scale);const wrapper=new THREE.Group();wrapper.position.set(placement.x,placement.groundY??0,placement.z);wrapper.rotation.y=placement.rotationY??0;wrapper.scale.x*=placement.scaleX??1;wrapper.scale.y*=placement.scaleY??1;wrapper.scale.z*=placement.scaleZ??1;wrapper.add(model);scene.add(wrapper);onLoad?.(wrapper);console.info(`Stockdealer · ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · ${label} omitted`,error));}
loadStreetSet(ASSET_URLS.street.lamp,3.65,STREET_LAYOUT.lamps,'streetlamps',(lamp,placement)=>{const light=new THREE.PointLight(0xffc66d,6.4,8.5,2);light.position.set(placement.x,3.05,placement.z);light.userData.baseIntensity=6.4;scene.add(light);streetLights.push(light);});
loadStreetSet(ASSET_URLS.street.tree,3.85,STREET_LAYOUT.trees.map((tree,index)=>({...tree,rotationY:index*1.17})),'street trees');
loadStreetSet(ASSET_URLS.street.shrub,1.02,STREET_LAYOUT.shrubs,'shrub planters');
loadStreetSet(ASSET_URLS.street.van,STREET_LAYOUT.van.height,[STREET_LAYOUT.van],'delivery van',(actor)=>{streetActors.van=actor;});
loadStreetSet(ASSET_URLS.street.loadingZone,STREET_LAYOUT.loadingZone.height,[STREET_LAYOUT.loadingZone],'loading-zone cluster');
loadStreetSet(ASSET_URLS.street.furniture,STREET_LAYOUT.furniture.height,[STREET_LAYOUT.furniture],'street-furniture island');
loadStreetSet(ASSET_URLS.street.neighborOlder,STREET_LAYOUT.neighborOlder.height,[STREET_LAYOUT.neighborOlder],'older neighbor',(actor,placement,index,animations)=>{streetActors.older=actor;if(animations?.[0]){const mixer=new THREE.AnimationMixer(actor);mixer.clipAction(animations[0]).play();streetMixers.push(mixer);}});
loadStreetSet(ASSET_URLS.street.househeadIdle,STREET_LAYOUT.househead.height,[STREET_LAYOUT.househead],'househead character',(actor,placement,index,animations)=>{streetActors.househead=actor;const idleClip=THREE.AnimationClip.findByName(animations,'Househead_Idle');if(idleClip){househeadMixer=new THREE.AnimationMixer(actor);househeadMixer.clipAction(idleClip).play();streetMixers.push(househeadMixer);}});
loadStreetSet(ASSET_URLS.street.foxWalker,STREET_LAYOUT.foxWalker.height,[{...STREET_LAYOUT.foxWalker,z:STREET_LAYOUT.foxWalker.minZ}],'animated fox walker',(actor,placement,index,animations)=>{streetActors.foxWalker=actor;const walkClip=animations?.[0];if(walkClip){foxWalkerMixer=new THREE.AnimationMixer(actor);foxWalkerMixer.clipAction(walkClip).play();streetMixers.push(foxWalkerMixer);}});
loadStreetSet(ASSET_URLS.street.neonCatWalker,STREET_LAYOUT.neonCatWalker.height,[{...STREET_LAYOUT.neonCatWalker,z:STREET_LAYOUT.neonCatWalker.maxZ}],'animated neon cat walker',(actor,placement,index,animations)=>{streetActors.neonCatWalker=actor;const walkClip=animations?.[0];if(walkClip){neonCatWalkerMixer=new THREE.AnimationMixer(actor);neonCatWalkerMixer.clipAction(walkClip).play();streetMixers.push(neonCatWalkerMixer);}});
const househeadHit=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.9,1.35),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
househeadHit.position.set(STREET_LAYOUT.househead.x,.95,STREET_LAYOUT.househead.z);househeadHit.userData.interactive={type:'househead'};scene.add(househeadHit);
loadStreetSet(ASSET_URLS.street.cat,STREET_LAYOUT.cat.height,[STREET_LAYOUT.cat],'street cat',(actor)=>{streetActors.cat=actor;});
const cityPackReplacesPlacement=placement=>STREET_LAYOUT.cityPackBuildings.some(building=>building.replaces===placement.asset&&building.x===placement.x&&building.z===placement.z);
loadStreetSet(ASSET_URLS.street.simpleHouseB,STREET_LAYOUT.houses[1].height,[STREET_LAYOUT.houses[1]],'simple house B');
const streetHouseSets=[
  ['simpleHouseC',ASSET_URLS.street.simpleHouseC,'simple house C'],
  ['simpleHouseD',ASSET_URLS.street.simpleHouseD,'simple house D'],
  ['simpleHouseE',ASSET_URLS.street.simpleHouseE,'simple house E'],
  ['simpleHouseF',ASSET_URLS.street.simpleHouseF,'simple house F'],
  ['simpleHouseG',ASSET_URLS.street.simpleHouseG,'simple house G'],
  ['simpleHouseH',ASSET_URLS.street.simpleHouseH,'simple house H'],
];
for(const [asset,url,label] of streetHouseSets){
  const placements=[...STREET_LAYOUT.houses,...STREET_LAYOUT.branchHouses].filter(house=>house.asset===asset&&!cityPackReplacesPlacement(house));
  if(placements.length)loadStreetSet(url,placements[0].height,placements,`${label} row`);
}
const infillHouseSets=[
  ['infillHouse1',ASSET_URLS.street.infillHouse1,'infill house 1'],
  ['infillHouse2',ASSET_URLS.street.infillHouse2,'infill house 2'],
  ['infillHouse3',ASSET_URLS.street.infillHouse3,'infill house 3'],
  ['infillHouse4',ASSET_URLS.street.infillHouse4,'infill house 4'],
];
for(const [asset,url,label] of infillHouseSets){
  const placement=STREET_LAYOUT.infillHouses.find(house=>house.asset===asset);
  loadCenteredFittedAsset(url,placement,label);
}
for(const placement of STREET_LAYOUT.cityPackBuildings){
  loadCenteredFittedAsset(ASSET_URLS.street[placement.asset],placement,`city pack ${placement.asset}`);
}
let warehouseExterior=null;
loadCenteredFittedAsset(ASSET_URLS.warehouse.exterior,{x:0,z:-1.3,height:8.2,maxWidthX:14,maxDepthZ:18.4,groundY:0,rotationY:0},'supplied warehouse exterior',wrapper=>{warehouseExterior=wrapper;warehouseExterior.visible=warehouseVisibilityForLocation(state?.location).suppliedExterior;});
loadCenteredFittedAsset(ASSET_URLS.street.restaurant,STREET_LAYOUT.restaurant,'right-branch restaurant');
portalHit(
  [RESTAURANT_EXTERIOR_INTERACTION.size.x, RESTAURANT_EXTERIOR_INTERACTION.size.y, RESTAURANT_EXTERIOR_INTERACTION.size.z],
  [RESTAURANT_EXTERIOR_INTERACTION.position.x, RESTAURANT_EXTERIOR_INTERACTION.position.y, RESTAURANT_EXTERIOR_INTERACTION.position.z],
  RESTAURANT_EXTERIOR_INTERACTION.id,
);
const restaurantFrontLight=new THREE.PointLight(0xffbe73,4.6,9,2);restaurantFrontLight.position.set(STREET_LAYOUT.restaurant.x,3.2,STREET_LAYOUT.restaurant.z-STREET_LAYOUT.restaurant.maxDepthZ/2-1);restaurantFrontLight.userData.baseIntensity=4.6;scene.add(restaurantFrontLight);streetLights.push(restaurantFrontLight);
for(const [x,y,z,color,intensity] of [[-6,2.2,14.7,0xffd39a,2.6],[6,2.35,houseLayout.positionZ,0xffc77d,2.4],[0,3.2,42,0xa7c6ff,1.4]]){const glow=new THREE.PointLight(color,intensity,7.5,2);glow.position.set(x,y,z);glow.userData.baseIntensity=intensity;scene.add(glow);streetLights.push(glow);}
let streetAmbienceContext=null;
let vehicleRouteState={segment:0,distance:0};
let foxPatrolState={distance:STREET_LAYOUT.foxWalker.minZ,direction:1};
let neonCatPatrolState={distance:STREET_LAYOUT.neonCatWalker.maxZ,direction:-1};
function startStreetAmbience(){if(streetAmbienceContext){streetAmbienceContext.resume();return;}const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return;streetAmbienceContext=new AudioContext();const length=streetAmbienceContext.sampleRate*3;const buffer=streetAmbienceContext.createBuffer(1,length,streetAmbienceContext.sampleRate);const data=buffer.getChannelData(0);let value=0;for(let i=0;i<length;i++){value=value*.985+(Math.random()*2-1)*.015;data[i]=value;}const wind=streetAmbienceContext.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=streetAmbienceContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;const gain=streetAmbienceContext.createGain();gain.gain.value=.026;wind.connect(filter).connect(gain).connect(streetAmbienceContext.destination);wind.start();}

const interiorObstacles={
  'shop-interior':[],
  'house-interior':[],
  'restaurant-interior':[...RESTAURANT_INTERIOR_LAYOUT.obstacles],
};
function makeInterior(location,centerZ,accent){
  const wall=new THREE.MeshStandardMaterial({color:0xc4c1b5,roughness:.96});
  const dark=new THREE.MeshStandardMaterial({color:accent,roughness:.78});
  box([9.5,.2,9.5],mats.floor,[0,-.1,centerZ],false);
  box([9.5,4.1,.2],wall,[0,2.05,centerZ-4.75],false);
  box([.2,4.1,9.5],wall,[-4.75,2.05,centerZ],false);
  box([.2,4.1,9.5],wall,[4.75,2.05,centerZ],false);
  box([3.55,4.1,.2],wall,[-2.98,2.05,centerZ+4.75],false);
  box([3.55,4.1,.2],wall,[2.98,2.05,centerZ+4.75],false);
  box([2.45,1.45,.2],wall,[0,3.38,centerZ+4.75],false);
  box([9.5,.15,9.5],dark,[0,4.08,centerZ],false);
  box([2.12,2.62,.12],dark,[0,1.31,centerZ+4.61]);
  const exitId=location==='shop-interior'?'shop-exit':'house-exit';
  portalHit([1.9,2.7,.4],[0,1.35,centerZ+4.35],exitId);
  let table=null;
  if(location==='shop-interior'){
    table=box([2.7,.15,1.15],mats.wood,[0,.82,centerZ-.55]);
    for(const x of [-1.2,1.2])for(const z of [centerZ-1,centerZ-.1])box([.12,.82,.12],mats.metal,[x,.4,z]);
    interiorObstacles[location].push({minX:-1.55,maxX:1.55,minZ:centerZ-1.25,maxZ:centerZ+.15});
  }
  const lamp=new THREE.PointLight(location==='shop-interior'?0xb9ff83:0xffd6a0,7,9,2);lamp.position.set(0,3.45,centerZ);scene.add(lamp);
  box([1.35,.1,.5],dark,[0,3.65,centerZ],false);
  return table;
}
makeInterior('shop-interior',-30,0x273a29);
makeInterior('house-interior',-48,0x493d31);
loadCenteredFittedAsset(ASSET_URLS.street.restaurantInterior,{x:0,z:-80,height:5.6,maxWidthX:22.5,maxDepthZ:36,groundY:0,rotationY:0},'instanced evening restaurant interior');
const restaurantExit=RESTAURANT_INTERIOR_LAYOUT.exitDoor;
const restaurantExitWallMaterial=new THREE.MeshStandardMaterial({color:0x3b1717,roughness:.92});
const restaurantExitFrameMaterial=new THREE.MeshStandardMaterial({color:0x79ff35,emissive:0x183b0c,emissiveIntensity:.9,roughness:.5,metalness:.18});
const restaurantExitDoorMaterial=new THREE.MeshStandardMaterial({color:0x10291a,roughness:.72,metalness:.12});
for(const x of [-6.45,6.45])box([10.1,4.3,.25],restaurantExitWallMaterial,[x,2.15,restaurantExit.wallZ],false);
box([2.8,1.25,.25],restaurantExitWallMaterial,[0,3.675,restaurantExit.wallZ],false);
box([2.35,2.65,.14],restaurantExitDoorMaterial,[0,1.325,restaurantExit.wallZ-.15],false);
for(const x of [-1.28,1.28])box([.16,2.9,.3],restaurantExitFrameMaterial,[x,1.45,restaurantExit.wallZ-.17],false);
box([2.72,.16,.3],restaurantExitFrameMaterial,[0,2.82,restaurantExit.wallZ-.17],false);
for(const y of [.58,1.28,1.98])box([2.05,.055,.06],restaurantExitFrameMaterial,[0,y,restaurantExit.wallZ-.235],false);
const restaurantExitSignCanvas=document.createElement('canvas');restaurantExitSignCanvas.width=640;restaurantExitSignCanvas.height=180;const restaurantExitSignContext=restaurantExitSignCanvas.getContext('2d');restaurantExitSignContext.fillStyle='#07100c';restaurantExitSignContext.fillRect(0,0,640,180);restaurantExitSignContext.strokeStyle='#79ff35';restaurantExitSignContext.lineWidth=10;restaurantExitSignContext.strokeRect(7,7,626,166);restaurantExitSignContext.fillStyle='#f3f8ef';restaurantExitSignContext.font='900 78px Arial';restaurantExitSignContext.textAlign='center';restaurantExitSignContext.textBaseline='middle';restaurantExitSignContext.fillText('EXIT  [ E ]',320,94);const restaurantExitSignTexture=new THREE.CanvasTexture(restaurantExitSignCanvas);restaurantExitSignTexture.colorSpace=THREE.SRGBColorSpace;const restaurantExitSign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.62),new THREE.MeshBasicMaterial({map:restaurantExitSignTexture,side:THREE.DoubleSide,toneMapped:false}));restaurantExitSign.position.set(0,3.12,restaurantExit.wallZ-.19);restaurantExitSign.rotation.y=Math.PI;scene.add(restaurantExitSign);
const restaurantExitLight=new THREE.PointLight(0x84ff52,3.8,5.5,2);restaurantExitLight.position.set(0,2.55,restaurantExit.wallZ-1.1);scene.add(restaurantExitLight);
portalHit(
  [restaurantExit.size.x,restaurantExit.size.y,restaurantExit.size.z],
  [restaurantExit.position.x,restaurantExit.position.y,restaurantExit.position.z],
  restaurantExit.id,
);
for(const [x,z] of [[-6,-70],[5,-80],[-5,-90]]){const restaurantLight=new THREE.PointLight(0xffb56b,4.8,13,2);restaurantLight.position.set(x,3,z);scene.add(restaurantLight);}

// Plants and pots
const pots=[];
const growTableTopY=.84;
const supportInset=.008;
const plantTemplates=new Map();
let meshyMatureBudTemplate=null;
const warehouseJarBudGroups=[];
function tintWarehouseBud(root,color){root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(source=>{const material=source.clone();material.map=null;material.color.set(color);material.roughness=.72;material.metalness=0;material.emissive=new THREE.Color(color).multiplyScalar(.1);material.emissiveIntensity=.42;return material;});if(object.material.length===1)object.material=object.material[0];});}
function populateWarehouseJarBuds(entry){
  const {group,config}=entry;group.clear();
  WAREHOUSE_JAR_BUD_PLACEMENTS.forEach(([x,y,z],index)=>{
    if(meshyMatureBudTemplate){const bud=meshyMatureBudTemplate.clone(true);bud.scale.setScalar(.55+(index%3)*.05);bud.rotation.set(index*.37,index*.83,index*.19);bud.position.set(x,y,z);tintWarehouseBud(bud,config.color);group.add(bud);}
    else{const bud=new THREE.Mesh(new THREE.IcosahedronGeometry(.06+(index%3)*.004,1),new THREE.MeshStandardMaterial({color:config.color,roughness:.78,emissive:new THREE.Color(config.color).multiplyScalar(.08)}));bud.scale.set(.9,1.12,.9);bud.position.set(x,y,z);group.add(bud);}
  });
}
function createWarehouseJar(config){
  const jar=new THREE.Group();jar.position.set(...config.position);jar.userData.qaLabel=`${config.ticker} bud jar`;
  const glass=new THREE.MeshPhysicalMaterial({color:0xe9fff1,transparent:true,opacity:.24,transmission:.42,roughness:.14,metalness:0,side:THREE.DoubleSide,depthWrite:false});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.56,18,1,true),glass);body.position.y=.3;jar.add(body);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.035,18),glass);bottom.position.y=.035;jar.add(bottom);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.225,.225,.075,18),new THREE.MeshStandardMaterial({color:0x5b635d,roughness:.38,metalness:.7}));lid.position.y=.615;jar.add(lid);
  const buds=new THREE.Group();jar.add(buds);scene.add(jar);warehouseExpansionObjects.push(jar);
  const entry={group:buds,config};warehouseJarBudGroups.push(entry);populateWarehouseJarBuds(entry);
}
WAREHOUSE_JARS.forEach(createWarehouseJar);
const leafMat = new THREE.MeshStandardMaterial({color:0x357c34,roughness:.85,side:THREE.DoubleSide});
const lightLeafMat = new THREE.MeshStandardMaterial({color:0x62a94c,roughness:.8,side:THREE.DoubleSide});
const budMat = new THREE.MeshStandardMaterial({color:0x8bad62,roughness:.9,emissive:0x192a10,emissiveIntensity:.25});
function createMatureBudOverlay(ticker){
  const variant=matureBudVariant(ticker||'HOOD');
  const group=new THREE.Group();group.userData={matureBudTicker:variant.ticker,matureBudColor:variant.color};
  if(!meshyMatureBudTemplate)return group;
  variant.clusters.forEach(([x,y,z],index)=>{
    const bud=meshyMatureBudTemplate.clone(true);bud.position.set(x,y,z);bud.rotation.set(index*.17,index*.77,index*.11);bud.scale.setScalar(.82+(index%3)*.09);
    bud.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(source=>{const material=source.clone();material.map=null;material.color.set(variant.color);material.roughness=.78;material.metalness=0;material.emissive=new THREE.Color(variant.color).multiplyScalar(.08);material.emissiveIntensity=.35;return material;});if(object.material.length===1)object.material=object.material[0];});group.add(bud);
  });
  return group;
}
function createLeaf(scale, y, angle, material=leafMat){
  const geo=new THREE.ConeGeometry(.11*scale,.55*scale,5);geo.rotateZ(Math.PI/2);
  const leaf=new THREE.Mesh(geo,material);leaf.position.y=y;leaf.rotation.y=angle;leaf.rotation.z=-.12;leaf.castShadow=true;return leaf;
}
function rebuildPlant(pot){
  if(pot.plant) pot.group.remove(pot.plant);
  const stage=stageFor(pot.growth); const plant=new THREE.Group(); pot.plant=plant;pot.group.add(plant);
  if(pot.potMesh)pot.potMesh.visible=true;if(pot.soil)pot.soil.visible=true;
  if(plantTemplates.has(stage)){pot.potMesh.visible=false;pot.soil.visible=false;plant.userData.meshy=true;plant.add(plantTemplates.get(stage).clone(true));if(stage===5)plant.add(createMatureBudOverlay(pot.seedTicker));return;}
  if(stage===0)return;
  const heights=[.03,.16,.42,.74,1.0,1.12]; const height=heights[stage];
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,height,7),new THREE.MeshStandardMaterial({color:0x4d8138,roughness:.9}));stem.position.y=.17+height/2;stem.castShadow=true;plant.add(stem);
  const count=[0,2,5,9,12,14][stage];
  for(let i=0;i<count;i++){const y=.25+(i/Math.max(1,count-1))*height*.82;const leaf=createLeaf(.48+stage*.09,y,i*2.35,i%2?leafMat:lightLeafMat);plant.add(leaf);}
  if(stage===4){for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.07,1),budMat);b.scale.set(.75,1.5,.75);b.position.set(Math.cos(i*2.4)*(.12+(i%3)*.025),.55+(i/4)*height*.63,Math.sin(i*2.4)*(.12+(i%3)*.025));b.castShadow=true;plant.add(b);}}
  if(stage===5)plant.add(createMatureBudOverlay(pot.seedTicker));
  plant.scale.setScalar(.92+stage*.025);
}
WAREHOUSE_GROW_STATIONS.forEach((station,index)=>{
  const stationLayout=station;
  const group=new THREE.Group();group.position.set(stationLayout.x,supportedOriginY({surfaceY:growTableTopY,inset:supportInset}),stationLayout.z);scene.add(group);
  const potMesh=new THREE.Mesh(new THREE.CylinderGeometry(.34,.27,.46,9),mats.pot);potMesh.position.y=.23;potMesh.castShadow=true;group.add(potMesh);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.025,16),mats.soil);soil.position.y=.47;group.add(soil);
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,1.65,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.y=.85;group.add(hit);
  const pot={group,hit,potMesh,soil,growth:0,water:0,seedTicker:null,plantedAt:null,wateredAt:null,plant:null,index,location:'warehouse'};hit.userData.interactive={type:'pot',pot};pots.push(pot);rebuildPlant(pot);
});

const houseGrowStations=[];
const houseStationMetal=new THREE.MeshStandardMaterial({color:0x252d27,roughness:.48,metalness:.68});
const houseStationLight=new THREE.MeshStandardMaterial({color:0xd8ffc0,emissive:0x8fff48,emissiveIntensity:2.2,roughness:.35});
for(let index=0;index<15;index++){
  const station=new THREE.Group();const column=index%5,row=Math.floor(index/5);station.position.set(-3.2+column*1.6,0,-50.45+row*2.22);station.visible=false;scene.add(station);
  const table=new THREE.Mesh(new THREE.BoxGeometry(1.08,.1,.82),mats.wood);table.position.y=.72;table.castShadow=true;table.receiveShadow=true;station.add(table);
  for(const x of [-.44,.44]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.72,.07),houseStationMetal);leg.position.set(x,.36,0);station.add(leg);}
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.06,1.52,.06),houseStationMetal);frame.position.set(.48,1.44,.29);station.add(frame);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.94,.06,.06),houseStationMetal);arm.position.set(0,2.17,.29);station.add(arm);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.8,.08,.34),houseStationLight);lamp.position.set(0,2.09,.14);station.add(lamp);
  const group=new THREE.Group();group.position.y=.77;station.add(group);
  const potMesh=new THREE.Mesh(new THREE.CylinderGeometry(.31,.25,.43,9),mats.pot);potMesh.position.y=.215;potMesh.castShadow=true;group.add(potMesh);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.025,16),mats.soil);soil.position.y=.44;group.add(soil);
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.65,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.y=.83;group.add(hit);
  const pot={group,hit,potMesh,soil,growth:0,water:0,seedTicker:null,plantedAt:null,wateredAt:null,plant:null,index:pots.length,location:'house-interior'};hit.userData.interactive={type:'pot',pot};pots.push(pot);houseGrowStations.push(station);rebuildPlant(pot);
}
function refreshHouseGrowStations(){const capacity=activeProperty()?.capacity??0;houseGrowStations.forEach((station,index)=>{station.visible=index<capacity;station.visible=station.visible&&state.location==='house-interior';});}

function loadPlantStage(stage,url,targetHeight,label){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetHeight/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});plantTemplates.set(stage,model);pots.filter(p=>stageFor(p.growth)===stage).forEach(rebuildPlant);console.info(`Stockdealer · Meshy ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · ${label} fallback`,error));}
loadPlantStage(0,'/models/plants/pot-empty.glb',.5,'empty pot');
loadPlantStage(1,'/models/plants/planted-seed.glb',.5,'planted seed');
loadPlantStage(2,'/models/plants/sprout.glb',.72,'sprout');
loadPlantStage(3,'/models/plants/vegetative.glb',1.36,'vegetative plant');
loadPlantStage(4,'/models/plants/flowering.glb',1.52,'flowering plant');
loadPlantStage(5,'/models/plants/mature-buds.glb',1.55,'mature plant');
new GLTFLoader().load(ASSET_URLS.plants.matureBudCluster,gltf=>{meshyMatureBudTemplate=normalizeAsset(gltf.scene,.2);pots.filter(p=>stageFor(p.growth)===5).forEach(rebuildPlant);warehouseJarBudGroups.forEach(populateWarehouseJarBuds);console.info('Stockdealer · Meshy cannabis bud geometry loaded into plants and shelf jars');},undefined,error=>console.warn('Stockdealer · Meshy cannabis bud geometry omitted',error));

// Low-poly vendor character
const vendor=new THREE.Group();vendor.position.set(4.8,0,-4.7);scene.add(vendor);
const vendorFallback=new THREE.Group();vendor.add(vendorFallback);
const vendorMat=new THREE.MeshStandardMaterial({color:0x202a1e,roughness:.82});
const skin=new THREE.MeshStandardMaterial({color:0x9b6a4d,roughness:.9});
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.78,3,7),vendorMat);body.position.y=1.05;body.castShadow=true;vendorFallback.add(body);
const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),skin);head.position.y=1.76;head.castShadow=true;vendorFallback.add(head);
const cap=new THREE.Mesh(new THREE.CylinderGeometry(.31,.34,.13,7),mats.lime);cap.position.y=2;vendorFallback.add(cap);
const vendorHit=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,2.3,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));vendorHit.position.y=1.1;vendorHit.userData.interactive={type:'vendor'};vendor.add(vendorHit);
const counter=box([2.6,1.05,.75],mats.wood,[4.7,.52,-5.7]);
new GLTFLoader().load(ASSET_URLS.warehouse.vendorCounter,gltf=>{const model=normalizeAsset(gltf.scene,1.05);model.position.set(4.7,0,-5.7);scene.add(model);counter.visible=false;console.info('Stockdealer · Meshy V3 vendor counter loaded');},undefined,error=>console.warn('Stockdealer · vendor counter fallback',error));
let vendorMixer=null;
let vendorRequestedClip='idle';
let vendorActiveAction=null;
const vendorActions={};
function setVendorAnimation(name){
  vendorRequestedClip=name;
  const next=vendorActions[name];
  if(!next||next===vendorActiveAction)return;
  next.reset().fadeIn(.22).play();
  if(vendorActiveAction)vendorActiveAction.fadeOut(.22);
  vendorActiveAction=next;
}
new GLTFLoader().load(ASSET_URLS.vendor.idle,gltf=>{
  const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=1.92/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>{material.flatShading=true;material.needsUpdate=true;});}});vendor.add(model);vendorFallback.visible=false;
  vendorMixer=new THREE.AnimationMixer(model);
  if(gltf.animations[0])vendorActions.idle=vendorMixer.clipAction(gltf.animations[0]);
  setVendorAnimation(vendorRequestedClip);
  new GLTFLoader().load(ASSET_URLS.vendor.talk,talkGltf=>{if(talkGltf.animations[0])vendorActions.talk=vendorMixer.clipAction(talkGltf.animations[0]);setVendorAnimation(vendorRequestedClip);console.info('Stockdealer · Meshy V37 low-poly Vlad Tenev talk animation loaded');},undefined,error=>console.warn('Stockdealer · Vlad Tenev talk animation omitted',error));
  console.info('Stockdealer · Meshy V37 low-poly animated Vlad Tenev loaded');
},undefined,error=>console.warn('Stockdealer · animated Vlad Tenev fallback',error));

// Tool viewmodel
const weaponRoot=new THREE.Group();weaponRoot.position.set(.58,-.47,-.95);camera.add(weaponRoot);
const tools=Array.from({ length: 10 },()=>new THREE.Group());tools.forEach(t=>weaponRoot.add(t));
function makeProceduralCan(){
  const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({color:0x4f8a48,roughness:.55,metalness:.15});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.21,.26,.38,9),m);body.rotation.z=Math.PI/2;g.add(body);
  const spout=new THREE.Mesh(new THREE.CylinderGeometry(.055,.1,.62,7),m);spout.rotation.z=Math.PI/2;spout.position.x=-.38;g.add(spout);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.23,.035,7,12,Math.PI*1.5),m);handle.rotation.y=Math.PI/2;handle.position.set(.05,.18,0);g.add(handle);return g;
}
const fallbackCan=makeProceduralCan();tools[0].add(fallbackCan);
const scissorsMat=new THREE.MeshStandardMaterial({color:0x87918a,metalness:.8,roughness:.25});
const scissorsFallback=new THREE.Group();for(const z of [-.09,.09]){const blade=new THREE.Mesh(new THREE.BoxGeometry(.52,.055,.08),scissorsMat);blade.position.set(-.2,z*.8,z);blade.rotation.z=z*1.8;scissorsFallback.add(blade);}tools[1].add(scissorsFallback);tools[1].position.set(.05,.05,0);
const bagFallback=new THREE.Group();
const bag=new THREE.Mesh(new THREE.BoxGeometry(.38,.5,.13),new THREE.MeshStandardMaterial({color:0xa6854b,roughness:1,flatShading:true}));bag.rotation.z=-.12;bagFallback.add(bag);
const bagFold=new THREE.Mesh(new THREE.BoxGeometry(.4,.075,.145),new THREE.MeshStandardMaterial({color:0xc2a66c,roughness:1,flatShading:true}));bagFold.position.set(-.004,.225,.006);bag.add(bagFold);
const shopMarkCanvas=document.createElement('canvas');shopMarkCanvas.width=240;shopMarkCanvas.height=300;
const shopMarkContext=shopMarkCanvas.getContext('2d');shopMarkContext.scale(2,2);shopMarkContext.fillStyle='#00C805';
for(const path of [
  'M73.96 33.73h-30.4c-1.1 0-2.03.44-2.8 1.4l-21.8 27c-3.2 4-4 7.7-4 13v27.6C7.86 122.63 3.36 136.13.06 148.33c-.2.78.1 1.2.8 1.2h3.3c.6 0 1.2-.3 1.4-.8C30.46 85.33 57.56 53.93 74.56 35.13c.7-.8.4-1.4-.6-1.4Z',
  'M74.86 2.63c-2.04.79-4 2.13-4.9 2.9-9 7.7-15 13.8-20.7 19.8-.7.7-.4 1.4.6 1.4h33.7c3.1 0 4.9 1.8 4.9 4.9v38c0 1 .8 1.3 1.4.4l20.3-26.5c3.3-4.3 4.3-5.6 5.2-11.6 1.2-8.8.5-22.3-4.8-27.9-4.7-5-25.9-5.2-35.7-1.4Z',
  'M79.96 41.33c-20.9 23.3-37.2 47.8-52.3 77.3-.38.74.1 1.4 1 1.1l31.2-9.6c3.52-1.08 5.5-2.5 7.2-5.3l13.9-22.9c.3-.6.4-1.3.4-1.8v-38.2c0-1-.7-1.4-1.4-.6Z',
])shopMarkContext.fill(new Path2D(path));
const shopMarkTexture=new THREE.CanvasTexture(shopMarkCanvas);shopMarkTexture.colorSpace=THREE.SRGBColorSpace;
tools[2].add(bagFallback);
let meshyLoaded=false;
fetch('/models/watering-can.glb',{method:'HEAD'}).then(r=>{if(!r.ok)return;new GLTFLoader().load('/models/watering-can.glb',gltf=>{
  const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);model.scale.setScalar(.62/Math.max(size.x,size.y,size.z));model.rotation.set(.15,-1.18,-.08);model.position.set(-.12,.03,0);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material.roughness=Math.max(.35,o.material.roughness??.7)}});tools[0].add(model);fallbackCan.visible=false;meshyLoaded=true;showToast('MESHY LOW-POLY TOOL LOADED');
  console.info('Stockdealer · Meshy low-poly watering can loaded');
});}).catch(()=>{});
function loadViewModel(index,url,targetSize,rotation,position,fallback,label,screenRotation=0,depthTilt=0){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());model.position.set(-center.x,-center.y,-center.z);const wrapper=new THREE.Group();wrapper.add(model);wrapper.scale.setScalar(targetSize/Math.max(size.x,size.y,size.z));wrapper.rotation.set(...rotation);if(screenRotation)wrapper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),screenRotation));if(depthTilt)wrapper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(.66,.75,0).normalize(),depthTilt));wrapper.position.set(...position);model.traverse(o=>{if(o.isMesh)o.castShadow=true;});tools[index].add(wrapper);fallback.visible=false;console.info(`Stockdealer · Meshy ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · ${label} fallback`,error));}
const trimmerScreenRotation=2.18;
const trimmerDepthTilt=-.85;
loadViewModel(1,'/models/tools/trimmers.glb',.43,[.12,.95,2.36],[-.12,-.02,-.12],scissorsFallback,'trimmers',trimmerScreenRotation,trimmerDepthTilt);
loadViewModel(2,ASSET_URLS.items.seedPack,.55,[.08,-.35,-.08],[-.03,.08,0],bagFallback,'V7 Robinhood seed pack');
Object.entries(ASSET_URLS.items.stockSeedPacks).forEach(([ticker,url],index)=>{
  const stockSeedFallback=bagFallback.clone(true);
  const isQqq=ticker==='QQQ';
  tools[index+3].add(stockSeedFallback);
  loadViewModel(index + 3, url, isQqq?.48:.55, [.08,-.35,-.08], [-.03,isQqq?.17:.08,0], stockSeedFallback, `${ticker} tokenized-stock seed pack`);
});
let budInventoryModel=null;
new GLTFLoader().load('/models/plants/harvested-bud.glb',gltf=>{budInventoryModel=normalizeAsset(gltf.scene,.3);budInventoryModel.position.set(4.05,1.06,-5.62);budInventoryModel.visible=false;scene.add(budInventoryModel);console.info('Stockdealer · Meshy harvested bud loaded');},undefined,error=>console.warn('Stockdealer · harvested bud omitted',error));

let localPlayerAvatar=null,localPlayerMixer=null,localPlayerAction=null,localPlayerSkinKey=null;
function loadLocalPlayerSkin(skin){
  if(!skin||localPlayerSkinKey===skin.key)return;
  if(localPlayerAvatar)scene.remove(localPlayerAvatar);
  localPlayerAvatar=null;localPlayerMixer=null;localPlayerAction=null;localPlayerSkinKey=skin.key;
  new GLTFLoader().load(skin.url,gltf=>{
    if(localPlayerSkinKey!==skin.key)return;
    const model=normalizeAsset(gltf.scene,1.8);
    model.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(source=>{const material=source.clone();material.colorWrite=false;material.depthWrite=false;return material;});if(object.material.length===1)object.material=object.material[0];});
    localPlayerAvatar=model;scene.add(model);localPlayerMixer=new THREE.AnimationMixer(model);const clip=gltf.animations.find(animation=>animation.name==='Casual_Walk')||gltf.animations[0];if(clip){localPlayerAction=localPlayerMixer.clipAction(clip);localPlayerAction.play();localPlayerAction.paused=true;}console.info(`Stockdealer · session player skin ${skin.key} loaded`);
  },undefined,error=>console.warn(`Stockdealer · session player skin ${skin.key} omitted`,error));
}

const remotePlayers=new Map();
let multiplayerClient=null,multiplayerConnecting=false,lastMultiplayerInputAt=0,multiplayerGeneration=0,authenticatedWallet=null,walletConnectionGeneration=0;
const localServerTarget=new THREE.Vector2();let localServerReady=false;
const authenticateWalletSession=createSerializedAuthenticator();
function setMultiplayerStatus(status){ui.onlinePlayers.textContent=status;}
function makeRemotePlayer(address){
  const group=new THREE.Group();
  const fallback=new THREE.Group();group.add(fallback);
  const bodyMaterial=new THREE.MeshStandardMaterial({color:0x78ff35,emissive:0x1d5c0b,emissiveIntensity:.9,roughness:.72,flatShading:true});
  const skinMaterial=new THREE.MeshStandardMaterial({color:0xffc08a,emissive:0x3a1604,emissiveIntensity:.35,roughness:.8,flatShading:true});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.9,3,8),bodyMaterial);body.position.y=1.04;body.castShadow=true;fallback.add(body);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.27,1),skinMaterial);head.position.y=1.78;head.castShadow=true;fallback.add(head);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=48;const context=labelCanvas.getContext('2d');context.fillStyle='rgba(5,9,6,.88)';context.fillRect(0,0,256,48);context.strokeStyle='#91ff2b';context.strokeRect(1,1,254,46);context.fillStyle='#dfffc4';context.font='bold 18px monospace';context.textAlign='center';context.fillText(compactWallet(address),128,31);const labelTexture=new THREE.CanvasTexture(labelCanvas);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthTest:false}));label.scale.set(1.25,.235,1);label.position.y=2.12;group.add(label);
  const skin=PLAYER_SKINS[Number.parseInt(address.slice(-1),16)%PLAYER_SKINS.length];
  new GLTFLoader().load(skin.url,gltf=>{if(!group.parent)return;const model=normalizeAsset(gltf.scene,1.8);model.rotation.y=Math.PI;group.add(model);fallback.visible=false;const mixer=new THREE.AnimationMixer(model);const clip=gltf.animations.find(animation=>animation.name==='Casual_Walk')||gltf.animations[0];if(clip){const action=mixer.clipAction(clip);action.play();action.paused=true;group.userData.action=action;}group.userData.mixer=mixer;console.info(`Stockdealer · remote ${skin.key} player loaded`);},undefined,error=>console.warn('Stockdealer · remote player GLB fallback retained',error));
  scene.add(group);return group;
}
function onMultiplayerSnapshot(snapshot){
  ui.onlinePlayers.textContent=String(snapshot.players.length);
  const receivedAt=performance.now();
  const seen=new Set();
  for(const player of snapshot.players){if(!player?.userId||![player.x,player.z,player.yaw].every(Number.isFinite))continue;if(player.address?.toLowerCase()===state.walletAddress?.toLowerCase()){if(state.location==='street'){localServerTarget.set(player.x,player.z);if(!localServerReady){camera.position.x=player.x;camera.position.z=player.z;localServerReady=true;}}continue;}seen.add(player.userId);let group=remotePlayers.get(player.userId);if(!group){group=makeRemotePlayer(player.address);group.position.set(player.x,.02,player.z);remotePlayers.set(player.userId,group);}group.userData.motion=beginRemoteMotion(group.userData.motion,{x:player.x,z:player.z,yaw:player.yaw},receivedAt);group.visible=state.location==='street';}
  for(const [id,group] of remotePlayers)if(!seen.has(id)){scene.remove(group);remotePlayers.delete(id);}
}
async function ensureAuthenticatedSession(wallet){if(authenticatedWallet?.toLowerCase()===wallet?.toLowerCase())return;if(state.walletAddress?.toLowerCase()!==wallet.toLowerCase())throw new Error('ACCOUNT_CHANGED_BEFORE_AUTH');await authenticateWalletSession({ethereum:globalThis.ethereum,account:wallet});if(state.walletAddress?.toLowerCase()!==wallet.toLowerCase())throw new Error('ACCOUNT_CHANGED_DURING_AUTH');authenticatedWallet=wallet;}
async function syncMultiplayerLocation(){
  if(state.location!=='street'){
    multiplayerGeneration++;multiplayerClient?.close();multiplayerClient=null;localServerReady=false;setMultiplayerStatus(state.walletAddress?'PRIVATE':'OFF');for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();return;
  }
  const spectator=state.mode==='spectator';
  if(!spectator&&!state.walletAddress){multiplayerGeneration++;multiplayerClient?.close();multiplayerClient=null;localServerReady=false;setMultiplayerStatus('OFF');for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();return;}
  if(multiplayerClient||multiplayerConnecting)return;
  multiplayerConnecting=true;const generation=++multiplayerGeneration,wallet=state.walletAddress;
  setMultiplayerStatus('CONNECTING');
  try{
    if(!spectator)await ensureAuthenticatedSession(wallet);
    if(generation!==multiplayerGeneration||state.location!=='street'||(spectator?state.mode!=='spectator':state.walletAddress?.toLowerCase()!==wallet.toLowerCase()))return;
    localServerReady=false;
    let client;
    const clientOptions={onSnapshot:onMultiplayerSnapshot,onStatus:status=>{if(multiplayerClient!==client)return;if(status.state==='connecting')setMultiplayerStatus('CONNECTING');else if(status.state==='socket-open')setMultiplayerStatus(spectator?'WATCHING':'JOINING');else if(status.state==='online')setMultiplayerStatus(String(status.players));else if(status.state==='closed')setMultiplayerStatus(status.willReconnect?'RECONNECTING':`CLOSED ${status.code}`);},onClose:(_event,{willReconnect}={})=>{if(multiplayerClient!==client)return;localServerReady=false;if(!willReconnect)multiplayerClient=null;for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();}};
    client=spectator?new MultiplayerClient({spectator:true,...clientOptions}):new MultiplayerClient(clientOptions);
    multiplayerClient=client;client.connect();
  }catch(error){multiplayerClient=null;setMultiplayerStatus(spectator?'CONNECTION ERROR':'AUTH ERROR');console.warn('Stockdealer · outside multiplayer unavailable',error);}finally{multiplayerConnecting=false;}
}

// State and interaction
const state={tokenBalance:null,seeds:4,buds:0,claimableStocks:{},properties:new Map(HOUSE_PROPERTIES.map(property=>[property.id,property])),walletAddress:null,onchainSnapshot:null,activePropertyId:null,selectedPropertyId:null,slot:0,locked:false,near:null,location:INITIAL_PLAYER_SPAWN.location,pendingPortal:null,mode:'pending',playerSkin:null};
function activeProperty(){return state.activePropertyId?state.properties.get(state.activePropertyId):null;}
function applyActivePropertyCrops(){if(!state.onchainSnapshot||!state.activePropertyId)return;const houseId=onchainPropertyId(state.activePropertyId),growthForStage=[0,1,2,4,7,10];for(let plotId=0;plotId<houseGrowStations.length;plotId++){const pot=pots[WAREHOUSE_GROW_STATIONS.length+plotId];const crop=state.onchainSnapshot.crops.find(candidate=>candidate.houseId===houseId&&candidate.plotId===plotId);Object.assign(pot,crop?{growth:growthForStage[crop.stage]??0,water:crop.wateredAt?100:0,seedTicker:crop.ticker,plantedAt:crop.plantedAt*1000,wateredAt:crop.wateredAt?crop.wateredAt*1000:null}:{growth:0,water:0,seedTicker:null,plantedAt:null,wateredAt:null});rebuildPlant(pot);}}
async function refreshOnchainState(){if(!state.walletAddress)return false;const response=await fetch('/api/state',{credentials:'include',cache:'no-store'});if(!response.ok)throw new Error('ONCHAIN_STATE_UNAVAILABLE');const snapshot=validateOnchainSnapshot(await response.json(),state.walletAddress);state.onchainSnapshot=snapshot;state.seeds=snapshot.totalSeeds;for(const record of snapshot.properties){let propertyId;try{propertyId=propertyIdFromOnchain(record.houseId);}catch{continue;}const property=state.properties.get(propertyId);if(property)state.properties.set(propertyId,Object.freeze({...property,owner:/^0x0{40}$/i.test(record.owner)?null:record.owner,purchasePrice:record.configured?record.price:null,capacity:record.capacity||property.capacity,mode:record.owner?.toLowerCase()===state.walletAddress.toLowerCase()?'ONCHAIN_OWNER':record.owner&&!/^0x0{40}$/i.test(record.owner)?'ONCHAIN_OCCUPIED':'UNOWNED'}));}applyActivePropertyCrops();refresh();return true;}
const input=new InputController();let yaw=INITIAL_PLAYER_SPAWN.yaw,pitch=0,last=performance.now(),toolKick=0,bob=0;
const playerRadius=.28;
const collisionObstaclesByLocation={
  warehouse:[
    {minX:-3.55,maxX:3.55,minZ:-2.85,maxZ:-1.55},
    ...WAREHOUSE_GROW_STATIONS.slice(4).map(stationCollider),
    {minX:-6.45,maxX:-4.25,minZ:1.75,maxZ:4.75},
    {minX:5.18,maxX:6.15,minZ:2.95,maxZ:3.95},
    {minX:-6.65,maxX:-3.15,minZ:-6.35,maxZ:-5.45},
    {minX:3.4,maxX:6,minZ:-6.1,maxZ:-5.25},
    {minX:4.1,maxX:5.5,minZ:-5.4,maxZ:-4},
    {minX:-.48,maxX:.48,minZ:.77,maxZ:1.73},
  ],
  street:[
    shopLayout.obstacle,
    houseLayout.obstacle,
    ...STREET_LAYOUT.obstacles,
  ],
  'shop-interior':interiorObstacles['shop-interior'],
  'house-interior':interiorObstacles['house-interior'],
  'restaurant-interior':interiorObstacles['restaurant-interior'],
};
const raycaster=new THREE.Raycaster();raycaster.far=3.2;
const interactives=[...pots.map(p=>p.hit),vendorHit,househeadHit,...portalHitboxes];
const ui={gate:document.querySelector('#gate'),loaderVideo:document.querySelector('#loaderVideo'),loaderActions:document.querySelector('#loaderActions'),hud:document.querySelector('#hud'),prompt:document.querySelector('#prompt'),toast:document.querySelector('#toast'),onlinePlayers:document.querySelector('#onlinePlayers'),stockdealerBalance:document.querySelector('#stockdealerBalance'),seeds:document.querySelector('#seeds'),buds:document.querySelector('#buds'),objective:document.querySelector('#objective'),chapter:document.querySelector('.chapter'),vendor:document.querySelector('#vendorPanel'),property:document.querySelector('#propertyPanel'),propertyTitle:document.querySelector('#propertyTitle'),propertyStatus:document.querySelector('#propertyStatus'),propertyCapacity:document.querySelector('#propertyCapacity'),propertyOwner:document.querySelector('#propertyOwner'),propertyMessage:document.querySelector('#propertyMessage'),propertyAction:document.querySelector('#propertyAction'),wallet:document.querySelector('#walletPanel'),walletAddress:document.querySelector('#walletAddress'),walletButton:document.querySelector('#wallet'),connectWallet:document.querySelector('#connectWallet'),portal:document.querySelector('#portalPanel'),neighborGuide:document.querySelector('#neighborGuide'),portalTitle:document.querySelector('#portalTitle'),portalMessage:document.querySelector('#portalMessage'),portalYes:document.querySelector('#portalYes'),portalNo:document.querySelector('#portalNo'),househeadQuestion:document.querySelector('#househeadQuestion'),househeadYes:document.querySelector('#househeadYes'),househeadNo:document.querySelector('#househeadNo'),stockdealerSwap:document.querySelector('#stockdealerSwap'),stockdealerSwapClose:document.querySelector('#stockdealerSwapClose')};
function compactWallet(wallet){return wallet?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:'NOT CONNECTED';}
async function connectPlayerWallet(){
  if(!globalThis.ethereum?.request){showToast('NO INJECTED WALLET FOUND');return null;}
  const generation=++walletConnectionGeneration;
  try{const accounts=await globalThis.ethereum.request({method:'eth_requestAccounts'});const wallet=accounts?.[0];if(generation!==walletConnectionGeneration)return null;if(!/^0x[0-9a-f]{40}$/i.test(wallet??''))throw new Error('Invalid wallet');state.walletAddress=wallet;ui.walletAddress.textContent=wallet;ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;showToast('WALLET CONNECTED · SIGN TO LOAD PROGRESS');await ensureAuthenticatedSession(wallet);if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return null;await reconcileEconomyJournal({ethereum:globalThis.ethereum,account:wallet}).catch(error=>{console.warn('Stockdealer · economy reconciliation required',error);showToast('ECONOMY RECONCILIATION REQUIRED');});await refreshOnchainState();if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return null;await syncMultiplayerLocation();return wallet;}catch(error){if(generation===walletConnectionGeneration)clearWalletContext();showToast(error?.code===4001?'WALLET CONNECTION REJECTED':'WALLET CONNECTION OR STATE LOAD FAILED');return null;}
}
function clearWalletContext(){walletConnectionGeneration++;multiplayerGeneration++;multiplayerClient?.close();multiplayerClient=null;localServerReady=false;authenticatedWallet=null;ui.onlinePlayers.textContent='0';state.walletAddress=null;state.onchainSnapshot=null;state.properties=new Map(HOUSE_PROPERTIES.map(property=>[property.id,property]));state.activePropertyId=null;state.selectedPropertyId=null;if(state.location==='house-interior'){state.location='street';camera.position.set(0,1.68,9.55);yaw=Math.PI;}for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();ui.walletAddress.textContent='NOT CONNECTED';ui.walletButton.textContent='WALLET — NOT CONNECTED';refresh();}
async function handleAccountsChanged(accounts){const wallet=accounts?.[0];if(isSameWalletAddress(state.walletAddress,wallet))return;clearWalletContext();const generation=walletConnectionGeneration;if(!/^0x[0-9a-f]{40}$/i.test(wallet??''))return;state.walletAddress=wallet;ui.walletAddress.textContent=wallet;ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;try{await ensureAuthenticatedSession(wallet);if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return;await reconcileEconomyJournal({ethereum:globalThis.ethereum,account:wallet}).catch(error=>{console.warn('Stockdealer · economy reconciliation required',error);showToast('ECONOMY RECONCILIATION REQUIRED');});await refreshOnchainState();if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return;await syncMultiplayerLocation();}catch(error){if(generation===walletConnectionGeneration)clearWalletContext();console.warn('Stockdealer · wallet context refresh failed',error);}}
function handleChainChanged(chainId){if(chainId?.toLowerCase()!=='0x1237'){clearWalletContext();showToast('SWITCH TO ROBINHOOD CHAIN MAINNET');}else if(state.walletAddress)handleAccountsChanged([state.walletAddress]);}
async function buySelectedSeeds(){
  if(!economyConfig.economyActive||vendorSelectedProduct.ticker==='HOOD')return;
  if(!state.walletAddress&&!await connectPlayerWallet())return;
  const original=vendorBuyButton.textContent;vendorBuyButton.disabled=true;vendorBuyButton.textContent='PREPARING SECURE QUOTE…';
  let result;try{
    try{result=await executeSeedPurchase({symbol:vendorSelectedProduct.ticker,account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum});}
    catch(error){vendorBuyButton.textContent=error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':'PURCHASE NOT SENT';showToast(error?.message==='ACTION_REJECTED'?'TRANSACTION REJECTED':'SEED PURCHASE FAILED SAFELY');return;}
    try{await refreshOnchainState();vendorBuyButton.textContent='PURCHASE CONFIRMED';showToast(`${vendorSelectedProduct.ticker} SEED PACK CONFIRMED · ${result.hash.slice(0,10)}…`);}
    catch(error){console.warn('Stockdealer · confirmed seed purchase awaiting authoritative state',error);vendorBuyButton.textContent='PURCHASE CONFIRMED';showToast('PURCHASE CONFIRMED · STATE SYNC PENDING');}
  }finally{setTimeout(()=>{vendorBuyButton.textContent=original;updateVendorEconomyButton();},1800);}
}
function selectedProperty(){return state.selectedPropertyId?state.properties.get(state.selectedPropertyId):null;}
function renderPropertyPanel(){
  const property=selectedProperty();if(!property)return;
  const access=propertyAccess(property,state.walletAddress);ui.propertyTitle.textContent=`PROPERTY ${property.id}`;ui.propertyStatus.textContent=access==='AVAILABLE'?'AVAILABLE':access==='OWNER'?'YOUR PROPERTY':'OCCUPIED';ui.propertyCapacity.textContent=String(property.capacity);ui.propertyOwner.textContent=property.owner??'AVAILABLE — NO OWNER';
  if(access==='OWNER'){ui.propertyMessage.textContent='This property belongs to your connected wallet. Enter its private grow interior.';ui.propertyAction.textContent='OPEN PROPERTY';ui.propertyAction.disabled=false;}
  else if(access==='OCCUPIED'){ui.propertyMessage.textContent='This property belongs to another wallet. Only its owner can enter.';ui.propertyAction.textContent='OWNED BY ANOTHER WALLET';ui.propertyAction.disabled=true;}
  else if(state.walletAddress&&economyConfig.economyActive){ui.propertyMessage.textContent='Price and basket minimums will be read from Robinhood Chain before signing.';ui.propertyAction.textContent='BUY PROPERTY ONCHAIN';ui.propertyAction.disabled=false;}
  else if(state.walletAddress&&qaEnabled){ui.propertyMessage.textContent='QA-only local ownership preview. No transaction will be sent.';ui.propertyAction.textContent='QA PREVIEW PURCHASE';ui.propertyAction.disabled=false;}
  else if(state.walletAddress){ui.propertyMessage.textContent='Property purchases remain locked until the token, basket routes and prices are activated.';ui.propertyAction.textContent='ECONOMY NOT ACTIVE';ui.propertyAction.disabled=true;}
  else{ui.propertyMessage.textContent='Connect your wallet to identify the buyer. No transaction will be sent.';ui.propertyAction.textContent='CONNECT WALLET TO BUY';ui.propertyAction.disabled=false;}
}
function openPropertyPanel(property){state.selectedPropertyId=property.id;renderPropertyPanel();openPanel(ui.property);}
function enterSelectedProperty(){const property=selectedProperty();if(propertyAccess(property,state.walletAddress)!=='OWNER')return;state.activePropertyId=property.id;state.location='house-interior';camera.position.set(0,1.68,-45.2);yaw=0;pitch=0;closePanels();applyActivePropertyCrops();refresh();syncMultiplayerLocation();showToast(`${property.id} PRIVATE INTERIOR LOADED`);canvas.requestPointerLock();}
async function usePropertyAction(){const property=selectedProperty();if(!property)return;const access=propertyAccess(property,state.walletAddress);if(access==='OWNER')return enterSelectedProperty();if(access==='OCCUPIED')return;if(!state.walletAddress&&!await connectPlayerWallet()){renderPropertyPanel();return;}if(!economyConfig.economyActive){if(qaEnabled){const purchased=purchasePreview(property,state.walletAddress);if(purchased){state.properties.set(property.id,purchased);renderPropertyPanel();showToast(`${property.id} ASSIGNED · QA PREVIEW`);}}return;}ui.propertyAction.disabled=true;ui.propertyAction.textContent='PREPARING HOUSE QUOTE…';let result;try{result=await executeHousePurchase({houseId:onchainPropertyId(property.id),account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum});}catch(error){renderPropertyPanel();showToast(error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':'HOUSE PURCHASE FAILED SAFELY');return;}try{await refreshOnchainState();renderPropertyPanel();showToast(`${property.id} PURCHASE CONFIRMED · ${result.hash.slice(0,10)}…`);}catch(error){console.warn('Stockdealer · confirmed property awaiting authoritative state',error);renderPropertyPanel();showToast('PURCHASE CONFIRMED · STATE SYNC PENDING');}}

function refresh(){refreshHouseGrowStations();ui.stockdealerBalance.textContent=state.tokenBalance??'—';ui.seeds.textContent=state.seeds;ui.buds.textContent=state.buds;if(budInventoryModel)budInventoryModel.visible=state.mode!=='spectator'&&state.buds>0;const warehouseVisibility=warehouseVisibilityForLocation(state.location);legacyWarehouseShell.forEach(item=>item.visible=warehouseVisibility.legacyInterior);warehouseExpansionObjects.forEach(item=>item.visible=warehouseVisibility.legacyInterior);if(warehouseExterior)warehouseExterior.visible=warehouseVisibility.suppliedExterior;document.querySelectorAll('.hotbar button').forEach((b,i)=>b.classList.toggle('active',i===state.slot));tools.forEach((t,i)=>t.visible=state.mode!=='spectator'&&i===state.slot);if(state.mode==='spectator'){ui.chapter.innerHTML='SPECTATOR MODE <b>•</b> FREE FLIGHT';ui.objective.textContent='WASD move · SPACE up · CTRL down · SHIFT boost';}else if(state.location==='warehouse'){ui.chapter.innerHTML='GROW ROOM 01 <b>•</b> NIGHT SHIFT';ui.objective.textContent=state.buds?`Review ${VENDOR_NAME} stock claims`:pots.some(p=>stageFor(p.growth)===5)?'Harvest the mature plant with trimmers':pots.some(p=>p.growth>0)?'Raise a plant to full bloom':'Plant a seed in an empty pot';}else if(state.location==='street'){ui.chapter.innerHTML='STOCKDEALER CITY <b>•</b> NIGHT';ui.objective.textContent='Approach a door and press E to enter';}else{ui.chapter.innerHTML=`${state.location==='shop-interior'?'SHOP':state.location==='restaurant-interior'?'RESTAURANT':'HOUSE'} INSTANCE <b>•</b> PRIVATE`;ui.objective.textContent='Explore the instance or use the door to leave';}}
if(qaEnabled)globalThis.__robinweedQA={camera,input,state,tools,selectSlot,setView(value){yaw=value;pitch=0;},position(){return camera.position.toArray();},setPosition(x,z){camera.position.x=x;camera.position.z=z;},setLocation(value){state.location=value;refresh();},foxWalker(){const actor=streetActors.foxWalker;if(!actor)return null;const bounds=new THREE.Box3().setFromObject(actor);return{position:actor.position.toArray(),rotationY:actor.rotation.y,boundsMin:bounds.min.toArray(),boundsMax:bounds.max.toArray(),mixerTime:foxWalkerMixer?.time??null};},neonCatWalker(){const actor=streetActors.neonCatWalker;if(!actor)return null;const bounds=new THREE.Box3().setFromObject(actor);return{position:actor.position.toArray(),rotationY:actor.rotation.y,boundsMin:bounds.min.toArray(),boundsMax:bounds.max.toArray(),mixerTime:neonCatWalkerMixer?.time??null};},loadingDoor(){return{openAmount:loadingDoorOpen,leafY:loadingDoorLeaf?.position.y??null,target:loadingDoorTarget(state.location,camera.position,loadingDoorPosition)};},pickTool(ndcX,ndcY){const probe=new THREE.Raycaster();probe.setFromCamera(new THREE.Vector2(ndcX,ndcY),camera);const isVisible=object=>{for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;};const hit=probe.intersectObject(tools[state.slot],true).find(result=>isVisible(result.object));if(!hit)return null;return{point:hit.point.toArray(),local:hit.object.worldToLocal(hit.point.clone()).toArray(),uv:hit.uv?.toArray()||null,faceIndex:hit.faceIndex};},openPortal(id){openPortalConfirm(id);},confirmPortal(){applyPendingPortal();},setVendorPanel(open){if(open)openPanel(ui.vendor);else closePanels();},setWallet(wallet){state.walletAddress=wallet;ui.walletAddress.textContent=wallet??'NOT CONNECTED';ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;},property(id){return state.properties.get(id)??null;},openProperty(id){openPropertyPanel(state.properties.get(id));},setPropertyOwner(id,wallet){const property=state.properties.get(id);state.properties.set(id,Object.freeze({...property,owner:wallet,mode:'FRONTEND_PREVIEW'}));},propertyPanel(){return{title:ui.propertyTitle.textContent,status:ui.propertyStatus.textContent,owner:ui.propertyOwner.textContent,action:ui.propertyAction.textContent,disabled:ui.propertyAction.disabled};},usePropertyAction,houseStations(){return houseGrowStations.map((station,index)=>({index,visible:station.visible,position:station.position.toArray()}));},warehouseStations(){return pots.filter(p=>p.location==='warehouse').map(p=>({index:p.index,position:p.group.position.toArray(),stage:stageFor(p.growth)}));},warehouseExpansion(){return warehouseExpansionObjects.map(object=>({label:object.userData.qaLabel??null,visible:object.visible,position:object.position.toArray(),bounds:new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray()}));},setPot(index,growth,seedTicker='HOOD'){const pot=pots[index];pot.growth=growth;pot.water=growth?60:0;pot.seedTicker=growth?seedTicker:null;rebuildPlant(pot);refresh();},plantVariant(index){const pot=pots[index];const overlay=pot.plant?.children.find(child=>child.userData.matureBudTicker);return{growth:pot.growth,seedTicker:pot.seedTicker,budTicker:overlay?.userData.matureBudTicker??null,budColor:overlay?.userData.matureBudColor??null};},setBuds(value){state.buds=value;refresh();}};
let toastTimer;function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1800);}
function selectSlot(slot){state.slot=slot;toolKick=.4;refresh();document.querySelector(`.hotbar button[data-slot="${slot}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});}
function activePot(){return state.near?.type==='pot'?state.near.pot:null;}
async function useOnchainTool(pot){const property=activeProperty();if(!property||!state.walletAddress)return showToast('OWNED PROPERTY AND WALLET REQUIRED');const houseId=onchainPropertyId(property.id),plotId=pot.index-WAREHOUSE_GROW_STATIONS.length;let action,args;if(state.slot>=2){const ticker=tickerForSlot(state.slot);if(ticker==='HOOD')return showToast('HOOD STOCK TOKEN UNAVAILABLE');action='plant';args=[houseId,plotId,`0x${[...new TextEncoder().encode(ticker)].map(byte=>byte.toString(16).padStart(2,'0')).join('').padEnd(64,'0')}`];}else if(state.slot===0){action='water';args=[houseId,plotId];}else{action='claimHarvest';args=[houseId,plotId,state.walletAddress];}let result;try{result=await executeCultivationAction({action,args,account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum});}catch(error){showToast(error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':`${action.toUpperCase()} FAILED SAFELY`);return;}try{await refreshOnchainState();showToast(`${action.toUpperCase()} CONFIRMED · ${result.hash.slice(0,10)}…`);}catch(error){console.warn('Stockdealer · confirmed cultivation awaiting authoritative state',error);showToast(`${action.toUpperCase()} CONFIRMED · STATE SYNC PENDING`);}}
async function useTool(){
  if(state.mode==='spectator')return;
  const pot=activePot();if(!pot)return;
  if(economyConfig.economyActive&&pot.location==='warehouse')return showToast('WAREHOUSE TUTORIAL · USE YOUR ONCHAIN PROPERTY TO GROW');
  if(economyConfig.economyActive&&pot.location==='house-interior')return useOnchainTool(pot);
  toolKick=1;
  if(state.slot >= 2){const result=plantSeed(pot,state.seeds,tickerForSlot(state.slot));if(!result.changed)return showToast(state.seeds?'POT IS ALREADY OCCUPIED':'NO SEEDS');Object.assign(pot,result.pot);state.seeds=result.seeds;rebuildPlant(pot);showToast(`${pot.seedTicker} SEED PLANTED · WATER ONCE TO START`);}
  if(state.slot===0){if(pot.growth===0)return showToast('PLANT A SEED FIRST');const next=waterPlant(pot);if(next.wateredAt===pot.wateredAt)return showToast(pot.growth>=10?'READY FOR TRIMMERS':'ALREADY WATERED · GROWTH CLOCK ACTIVE');Object.assign(pot,next);rebuildPlant(pot);spray();showToast('WATERED ONCE · NEXT STAGE IN 2 HOURS');}
  if(state.slot===1){const result=harvestPlant(pot);if(!result.changed)return showToast('NOT READY TO HARVEST');Object.assign(pot,result.pot);state.buds+=result.buds;state.claimableStocks[result.ticker]=(state.claimableStocks[result.ticker]||0)+result.buds;rebuildPlant(pot);showToast(`${result.ticker} HARVEST ×${result.buds} · STOCK CLAIM RECORDED`);}
  refresh();
}
function spray(){for(let i=0;i<14;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.008,4,3),new THREE.MeshBasicMaterial({color:0x8ad8dc,transparent:true,opacity:.8}));drop.position.copy(camera.position);const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);drop.position.add(dir.multiplyScalar(.7));drop.position.x+=(Math.random()-.5)*.15;scene.add(drop);drop.userData.velocity=new THREE.Vector3((Math.random()-.5)*.02,-.025-Math.random()*.02,(Math.random()-.5)*.02);drop.userData.life=1;particles.push(drop);}}
const particles=[];
function openPanel(panel){if(state.mode==='spectator')return;document.exitPointerLock();panel.classList.remove('hidden');if(panel===ui.vendor)setVendorAnimation(vendorClipForPanel(true));}
let househeadPanel='closed';
function renderHouseheadPanel(){ui.househeadQuestion.classList.toggle('hidden',househeadPanel!=='question');ui.stockdealerSwap.classList.toggle('hidden',househeadPanel!=='swap');}
function openHouseheadQuestion(){if(state.mode==='spectator')return;document.exitPointerLock();househeadPanel=nextHouseheadPanel(househeadPanel,'talk');renderHouseheadPanel();}
function openNeighborGuide(){if(state.mode==='spectator')return;document.exitPointerLock();closePanels();ui.neighborGuide.classList.remove('hidden');}
function closeHouseheadConversation(){househeadPanel=nextHouseheadPanel(househeadPanel,'close');renderHouseheadPanel();canvas.requestPointerLock();}
function closePanels(){ui.vendor.classList.add('hidden');ui.property.classList.add('hidden');ui.wallet.classList.add('hidden');ui.portal.classList.add('hidden');ui.neighborGuide.classList.add('hidden');househeadPanel='closed';renderHouseheadPanel();state.pendingPortal=null;setVendorAnimation(vendorClipForPanel(false));}
function openPortalConfirm(id){const config=portalFor(id);if(!config)return;state.pendingPortal=id;document.exitPointerLock();ui.portalTitle.textContent=config.title;ui.portalMessage.textContent=config.message;ui.portalYes.textContent=config.confirm;ui.portal.classList.remove('hidden');}
function cancelPortal(){state.pendingPortal=null;ui.portal.classList.add('hidden');canvas.requestPointerLock();}
function applyPendingPortal(){const config=portalFor(state.pendingPortal);if(!config)return cancelPortal();let spawn=config.spawn;if(state.pendingPortal==='house-exit'&&activeProperty()){spawn=streetSpawnForProperty(activeProperty());state.activePropertyId=null;}state.location=config.target;camera.position.set(spawn.x,1.68,spawn.z);yaw=spawn.yaw;pitch=0;state.pendingPortal=null;ui.portal.classList.add('hidden');refresh();syncMultiplayerLocation();showToast(`${config.target.replace('-', ' ').toUpperCase()} LOADED`);canvas.requestPointerLock();}

function revealLoaderActions(){ui.loaderActions.classList.remove('hidden');}
ui.loaderVideo.addEventListener('timeupdate',()=>{if(trailerButtonsVisible(ui.loaderVideo.currentTime,ui.loaderVideo.duration))revealLoaderActions();});
ui.loaderVideo.addEventListener('ended',()=>{ui.loaderVideo.pause();if(Number.isFinite(ui.loaderVideo.duration))ui.loaderVideo.currentTime=Math.max(0,ui.loaderVideo.duration-1/30);revealLoaderActions();});
ui.loaderVideo.play().catch(()=>{});
function beginSession(mode){state.mode=mode;ui.loaderVideo.pause();ui.gate.classList.add('hidden');ui.hud.classList.remove('hidden');document.body.classList.toggle('spectator-mode',mode==='spectator');if(mode==='player'){const assigned=assignSessionPlayerSkin(state);state.playerSkin=assigned.playerSkin;loadLocalPlayerSkin(state.playerSkin);}if(mode==='spectator'){state.tokenBalance=null;state.seeds=0;state.buds=0;state.location='street';camera.position.set(0,11,34);yaw=Math.PI;pitch=-.18;}refresh();syncMultiplayerLocation();startStreetAmbience();canvas.requestPointerLock();}
async function enterPlayerSession(){const play=document.querySelector('#play');play.disabled=true;play.textContent='CONNECT WALLET · SIGN IN · LOAD PROGRESS';const wallet=await connectPlayerWallet();if(!wallet||state.walletAddress?.toLowerCase()!==wallet.toLowerCase()||authenticatedWallet?.toLowerCase()!==wallet.toLowerCase()){play.disabled=false;play.textContent='ENTER THE GAME';return;}beginSession('player');}
document.querySelector('#play').addEventListener('click',enterPlayerSession);
document.querySelector('#spectate').addEventListener('click',()=>beginSession('spectator'));
canvas.addEventListener('pointerdown',()=>{startStreetAmbience();if(state.mode==='spectator'){if(!state.locked)canvas.requestPointerLock();return;}const actions=input.primaryDown();if(actions.some(a=>a.type==='use-tool'))useTool();else if(!state.locked&&ui.vendor.classList.contains('hidden')&&ui.property.classList.contains('hidden')&&ui.wallet.classList.contains('hidden')&&ui.portal.classList.contains('hidden')&&ui.neighborGuide.classList.contains('hidden')&&ui.househeadQuestion.classList.contains('hidden')&&ui.stockdealerSwap.classList.contains('hidden'))canvas.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;input.setGameplayEnabled(state.locked);ui.gate.classList.toggle('hidden',state.locked||!ui.hud.classList.contains('hidden'));if(state.locked){ui.hud.classList.remove('hidden');closePanels();}});
document.addEventListener('mousemove',e=>{if(!state.locked)return;yaw-=e.movementX*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch-e.movementY*.0022));});
document.addEventListener('keydown',e=>{for(const action of input.keyDown(e.code,e.repeat)){if(state.mode==='spectator')continue;if(action.type==='select-slot')selectSlot(action.slot);if(action.type==='interact'&&state.near?.type==='vendor')openPanel(ui.vendor);if(action.type==='interact'&&state.near?.type==='neighbor-guide')openNeighborGuide();if(action.type==='interact'&&state.near?.type==='househead')openHouseheadQuestion();if(action.type==='interact'&&state.near?.type==='property')openPropertyPanel(state.properties.get(state.near.id));if(action.type==='interact'&&state.near?.type==='portal')openPortalConfirm(state.near.id);}});
document.addEventListener('keyup',e=>input.keyUp(e.code));
window.addEventListener('blur',()=>input.releaseAll());
document.querySelectorAll('.hotbar button').forEach(b=>b.addEventListener('click',()=>selectSlot(Number(b.dataset.slot))));
document.querySelector('#wallet').addEventListener('click',()=>openPanel(ui.wallet));
ui.connectWallet.addEventListener('click',connectPlayerWallet);
globalThis.ethereum?.on?.('accountsChanged',handleAccountsChanged);
globalThis.ethereum?.on?.('chainChanged',handleChainChanged);
globalThis.ethereum?.on?.('disconnect',clearWalletContext);
ui.propertyAction.addEventListener('click',usePropertyAction);
vendorBuyButton.addEventListener('click',buySelectedSeeds);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{closePanels();canvas.requestPointerLock();}));
ui.portalYes.addEventListener('click',applyPendingPortal);
ui.portalNo.addEventListener('click',cancelPortal);
ui.househeadYes.addEventListener('click',()=>{househeadPanel=nextHouseheadPanel(househeadPanel,'accept');renderHouseheadPanel();});
ui.househeadNo.addEventListener('click',()=>{househeadPanel=nextHouseheadPanel(househeadPanel,'decline');renderHouseheadPanel();canvas.requestPointerLock();});
ui.stockdealerSwapClose.addEventListener('click',closeHouseheadConversation);
document.querySelector('#equipSelectedSeed').addEventListener('click',()=>{const product=vendorSelectedProduct;selectSlot(product.slot);closePanels();showToast(`${product.ticker} PACKAGE EQUIPPED · FRONTEND PREVIEW`);canvas.requestPointerLock();});

function updateNear(){if(state.mode==='spectator'){state.near=null;ui.prompt.classList.remove('show');return;}const nearbyProperty=state.location==='street'?propertyNear(camera.position,[...state.properties.values()]):null;if(state.location==='street'&&isNeighborGuideNearby(camera.position,STREET_LAYOUT.neighborOlder)){state.near={type:'neighbor-guide'};}else if(state.location==='street'&&isHouseheadNearby(camera.position,STREET_LAYOUT.househead)){state.near={type:'househead'};}else if(nearbyProperty){state.near={type:'property',id:nearbyProperty.id};}else{raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const isVisible=object=>{for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;};const hits=raycaster.intersectObjects(interactives,false).filter(hit=>{const interactive=hit.object.userData.interactive;return isVisible(hit.object)&&(interactive?.type!=='pot'||interactive.pot.location===state.location);});state.near=hits[0]?.object.userData.interactive||null;}if(!state.near){ui.prompt.classList.remove('show');return;}let text='';if(state.near.type==='vendor')text=`[ E ] TALK TO ${VENDOR_NAME.toUpperCase()}`;else if(state.near.type==='neighbor-guide')text='[ E ] TALK TO OLD NEIGHBOR';else if(state.near.type==='househead')text='[ E ] TALK TO MEADGod';else if(state.near.type==='property'){const property=state.properties.get(state.near.id);const access=propertyAccess(property,state.walletAddress);text=access==='AVAILABLE'?`[ E ] BUY PROPERTY ${property.id}`:access==='OWNER'?`[ E ] OPEN PROPERTY ${property.id}`:`[ E ] OWNED BY ${compactWallet(property.owner)}`;}else if(state.near.type==='portal')text=`[ E ] ${portalFor(state.near.id)?.title||'USE DOOR'}`;else{const p=state.near.pot;const s=stageFor(p.growth);text=p.growth===0?'EMPTY POT · EQUIP SEED BAG':`${STAGES[s].name.toUpperCase()} · WATER ${Math.round(p.water)}%`;}ui.prompt.textContent=text;ui.prompt.classList.add('show');}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,(now-last)/1000);last=now;let playerMoving=false;
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
  if(state.locked){const direction=movementVector(yaw,code=>input.isHeld(code));const moving=direction.x!==0||direction.z!==0;playerMoving=moving;if(state.mode==='spectator'){const up=(input.isHeld('Space')?1:0)-(input.isHeld('ControlLeft')||input.isHeld('ControlRight')||input.isHeld('KeyC')?1:0);const speed=input.isHeld('ShiftLeft')?15:8;const delta=spectatorFlightDelta({x:direction.x,z:direction.z,up},dt,speed);camera.position.x+=delta.x;camera.position.y=Math.max(.75,Math.min(45,camera.position.y+delta.y));camera.position.z+=delta.z;}else{if(moving){const speed=input.isHeld('ShiftLeft')?5.1:3.25;const next=moveCircle(camera.position,{x:direction.x*dt*speed,z:direction.z*dt*speed},collisionObstaclesByLocation[state.location]||[],boundsForLocation(state.location),playerRadius);camera.position.x=next.x;camera.position.z=next.z;bob+=dt*11;}camera.position.y=1.68+Math.sin(bob)*.025*(moving?1:0);}}
  if(state.location==='street'&&localServerReady){const corrected=reconcilePredictedPosition({x:camera.position.x,z:camera.position.z},{x:localServerTarget.x,z:localServerTarget.y},dt,playerMoving);camera.position.x=corrected.x;camera.position.z=corrected.z;}
  if(localPlayerAvatar){localPlayerAvatar.position.set(camera.position.x,state.location==='street'?.02:0,camera.position.z);localPlayerAvatar.rotation.y=yaw;if(localPlayerAction)localPlayerAction.paused=!playerMoving;localPlayerMixer?.update(dt);}
  if(state.mode==='player'&&state.location==='street'&&multiplayerClient){const cadence=advanceCadence(lastMultiplayerInputAt,now,50);if(cadence.send){lastMultiplayerInputAt=cadence.deadline;const buttons=[];if(input.isHeld('KeyW'))buttons.push('forward');if(input.isHeld('KeyS'))buttons.push('backward');if(input.isHeld('KeyA'))buttons.push('left');if(input.isHeld('KeyD'))buttons.push('right');if(input.isHeld('ShiftLeft'))buttons.push('run');multiplayerClient.sendInput(buttons,yaw);}}
  for(const group of remotePlayers.values()){group.visible=state.location==='street';if(!group.userData.motion)continue;const previousX=group.position.x,previousZ=group.position.z;const pose=sampleRemoteMotion(group.userData.motion,now);group.position.set(pose.x,.02,pose.z);group.rotation.y=pose.yaw;const moving=Math.hypot(pose.x-previousX,pose.z-previousZ)>1e-5;if(group.userData.action)group.userData.action.paused=!moving;group.userData.mixer?.update(dt);}
  pots.forEach(p=>{const next=advancePlant(p);if(next.growth!==p.growth){p.growth=next.growth;rebuildPlant(p);refresh();}if(p.plant&&!p.plant.userData.meshy)p.plant.rotation.y=Math.sin(now*.00065+p.index)*.035;});
  if(vendorPreviewModel)vendorPreviewModel.rotation.y+=dt*.42;if(!ui.vendor.classList.contains('hidden'))vendorPreviewRenderer.render(vendorPreviewScene,vendorPreviewCamera);
  toolKick=Math.max(0,toolKick-dt*3.4);weaponRoot.rotation.x=-Math.sin(toolKick*Math.PI)*.55;weaponRoot.rotation.z=Math.sin(bob)*.018;
  loadingDoorOpen=advanceLoadingDoor(loadingDoorOpen,loadingDoorTarget(state.location,camera.position,loadingDoorPosition),dt);if(loadingDoorLeaf)loadingDoorLeaf.position.y=loadingDoorOpen*loadingDoorTravel;
  particles.forEach((p,i)=>{p.position.add(p.userData.velocity);p.userData.velocity.y-=.0015;p.userData.life-=dt*1.7;p.material.opacity=p.userData.life;if(p.userData.life<=0){scene.remove(p);particles.splice(i,1);}});
  growLights.forEach((l,i)=>l.intensity=7.2+Math.sin(now*.0017+i)*.35);
  streetLights.forEach((light,i)=>light.intensity=(light.userData.baseIntensity??2.35)+Math.sin(now*.0011+i*1.7)*.18);
  nightClouds.forEach((cloud,i)=>{cloud.position.x+=dt*(.08+i*.025);if(cloud.position.x>18)cloud.position.x=-18;});
  vehicleRouteState=advanceVehicleRoute(vehicleRouteState,dt,STREET_LAYOUT.vehicleRoute,STREET_LAYOUT.van.speed);
  if(streetActors.van){streetActors.van.position.x=vehicleRouteState.x;streetActors.van.position.z=vehicleRouteState.z;const turn=Math.atan2(Math.sin(vehicleRouteState.rotationY-streetActors.van.rotation.y),Math.cos(vehicleRouteState.rotationY-streetActors.van.rotation.y));streetActors.van.rotation.y+=turn*Math.min(1,dt*4.2);}
  foxPatrolState=advancePatrol(foxPatrolState,dt,STREET_LAYOUT.foxWalker.minZ,STREET_LAYOUT.foxWalker.maxZ,STREET_LAYOUT.foxWalker.speed);
  if(streetActors.foxWalker){streetActors.foxWalker.position.z=foxPatrolState.distance;const heading=foxPatrolState.direction>0?0:Math.PI;const turn=Math.atan2(Math.sin(heading-streetActors.foxWalker.rotation.y),Math.cos(heading-streetActors.foxWalker.rotation.y));streetActors.foxWalker.rotation.y+=turn*Math.min(1,dt*5);}
  neonCatPatrolState=advancePatrol(neonCatPatrolState,dt,STREET_LAYOUT.neonCatWalker.minZ,STREET_LAYOUT.neonCatWalker.maxZ,STREET_LAYOUT.neonCatWalker.speed);
  if(streetActors.neonCatWalker){streetActors.neonCatWalker.position.z=neonCatPatrolState.distance;const heading=neonCatPatrolState.direction>0?0:Math.PI;const turn=Math.atan2(Math.sin(heading-streetActors.neonCatWalker.rotation.y),Math.cos(heading-streetActors.neonCatWalker.rotation.y));streetActors.neonCatWalker.rotation.y+=turn*Math.min(1,dt*5);}
  if(streetActors.cat){streetActors.cat.position.y=.08+Math.sin(now*.0017)*.006;streetActors.cat.rotation.z=Math.sin(now*.0012)*.008;}
  if(streetActors.older){streetActors.older.rotation.z=Math.sin(now*.0012)*.012;streetActors.older.rotation.y=STREET_LAYOUT.neighborOlder.rotationY+Math.sin(now*.00055)*.08;}
  streetMixers.forEach(mixer=>mixer.update(dt));
  if(state.location==='warehouse')vendor.rotation.y=vendorYawTowardPlayer(vendor.position,camera.position);
  if(vendorMixer)vendorMixer.update(dt);
  updateNear();renderer.render(scene,camera);
}
refresh();animate(performance.now());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
console.info('Stockdealer ready · economy fail-closed until verified mainnet activation');
