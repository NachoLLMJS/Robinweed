import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { stageFor, STAGES, plantSeed, waterPlant, harvestPlant } from './plantState.js';
import { InputController } from './inputController.js';
import { movementVector } from './movementMath.js';
import { moveCircle } from './collisionMath.js';
import { ASSET_URLS, vendorClipForPanel } from './assetManifest.js';
import { portalFor, boundsForLocation, cityBuildingFor } from './navigationState.js';
import { VENDOR_NAME, buildingUsesRobinhoodLogo } from './branding.js';
import { supportedOriginY } from './placementMath.js';
import { loadingDoorTarget, advanceLoadingDoor } from './loadingDoorState.js';
import { STREET_LAYOUT, advanceVehicleRoute } from './streetLifeState.js';
import './style.css';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c110b);
scene.fog = new THREE.FogExp2(0x0c110b, 0.031);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 80);
camera.position.set(0, 1.68, 6.7);
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

// Concrete basement shell
box([14, .25, 16], mats.floor, [0, -.13, 0], false);
box([14, 4.2, .25], mats.wall, [0, 2.05, -8], false);
box([.25, 4.2, 16], mats.wall, [-7, 2.05, 0], false);
box([.25, 4.2, 16], mats.wall, [7, 2.05, 0], false);
box([5.85,4.2,.25],mats.wall,[-4.08,2.05,8],false);
box([5.85,4.2,.25],mats.wall,[4.08,2.05,8],false);
box([2.3,1.48,.25],mats.wall,[0,3.46,8],false);
const loadingDoorJambWidth=.22;
const loadingDoorJambMaterial=new THREE.MeshStandardMaterial({color:0x173c2b,roughness:.68,metalness:.35});
box([loadingDoorJambWidth,3.25,.3],loadingDoorJambMaterial,[-1.05,1.625,7.96],false);
box([loadingDoorJambWidth,3.25,.3],loadingDoorJambMaterial,[1.05,1.625,7.96],false);
const ceiling = box([14, .16, 16], mats.wall, [0, 4.1, 0], false);
ceiling.material = ceiling.material.clone(); ceiling.material.color.setHex(0x171b16);
portalHit([1.85,2.7,.35],[0,1.35,7.5],'warehouse-exit');
portalHit([1.85,2.7,.35],[0,1.35,8.45],'warehouse-entrance');
box([.62,4.05,.62],mats.wall,[0,2.02,1.25],false);
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
box([14,.42,.12],mats.metal,[0,.21,-7.82]);
box([.12,.42,16],mats.metal,[-6.82,.21,0]);
box([.12,.42,16],mats.metal,[6.82,.21,0]);
const shelfFallback=[];
for (const y of [.5, 1.3, 2.1]) shelfFallback.push(box([3.4, .1, .7], mats.wood, [-4.9, y, -5.9]));
for (let i=0;i<8;i++) {
  const crate = box([.55 + (i%2)*.18, .38, .5], i%3 ? mats.wood : mats.metal, [-5.9+(i%3)*.75, .28+Math.floor(i/3)*.42, -6]);
  crate.rotation.y = (i%2)*.12;
  shelfFallback.push(crate);
}

// Grow bench
const benchFallback=[box([6.8, .18, 2.25], mats.wood, [0, .82, -2.2])];
for (const x of [-3.1,3.1]) for (const z of [-3,-1.4]) benchFallback.push(box([.15,.82,.15], mats.metal,[x,.4,z]));
const growLights = [];
const lightFixtureFallback=[];
const suspensionMaterial=new THREE.MeshStandardMaterial({color:0xaeb6ad,roughness:.52,metalness:.62});
for(const x of [-2.4,-.8,.8,2.4]) {
  const fixture = box([1.15,.12,.38], mats.metal,[x,3.08,-2.2]);
  lightFixtureFallback.push(fixture);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(.96,.035,.26), mats.lime);
  panel.position.set(0,-.08,0); fixture.add(panel);
  for(const cableX of [x-.38,x+.38]){
    box([.032,.92,.032],suspensionMaterial,[cableX,3.55,-2.2]);
    box([.14,.045,.14],suspensionMaterial,[cableX,3.99,-2.2],false);
  }
  box([.9,.06,.12],suspensionMaterial,[x,4.01,-2.2]);
  const light = new THREE.PointLight(0xaaff69, 6.4, 4.6, 1.8); light.position.set(x,2.93,-2.2); scene.add(light); growLights.push(light);
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
console.info('Robinweed · rectilinear warehouse shell retained after V3 wall QA');
new GLTFLoader().load(ASSET_URLS.warehouse.growBench,gltf=>{const template=normalizeAsset(gltf.scene,.84);for(const x of [-2.4,-.8,.8,2.4]){const bench=template.clone(true);bench.scale.x=.62;bench.position.set(x,0,-2.2);scene.add(bench);}benchFallback.forEach(item=>item.visible=false);console.info('Robinweed · four Meshy V3 grow tables aligned with pots');},undefined,error=>console.warn('Robinweed · grow bench fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.shelf,gltf=>{const shelf=normalizeAsset(gltf.scene,2.35);shelf.position.set(-4.9,0,-5.9);scene.add(shelf);shelfFallback.forEach(item=>item.visible=false);console.info('Robinweed · Meshy V3 shelf loaded');},undefined,error=>console.warn('Robinweed · shelf fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.growLight,gltf=>{const template=normalizeAsset(gltf.scene,.9);for(const x of [-2.4,-.8,.8,2.4]){const fixture=template.clone(true);fixture.position.set(x,3.08,-2.2);scene.add(fixture);}lightFixtureFallback.forEach(item=>item.visible=false);console.info('Robinweed · four suspended Meshy V3 grow lights loaded');},undefined,error=>console.warn('Robinweed · grow light fallback',error));
const loadingDoorPosition={x:0,z:7.82};
const loadingDoorTravel=2.7;
let loadingDoorLeaf=null;
let loadingDoorOpen=0;
function loadLoadingDoorPart(url,label,isLeaf=false){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const scale=3.25/1.0003;model.scale.setScalar(scale);model.position.set(-.00098*scale,.5*scale,0);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>{if(material.map){material.emissiveMap=material.map;material.emissive?.setScalar(.42);material.emissiveIntensity=.42;}material.roughness=.62;});}});const part=new THREE.Group();part.add(model);part.position.set(loadingDoorPosition.x,0,loadingDoorPosition.z);scene.add(part);if(isLeaf)loadingDoorLeaf=part;console.info(`Robinweed · Meshy V8 automatic loading door ${label} loaded`);},undefined,error=>console.warn(`Robinweed · loading door ${label} fallback`,error));}
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorFrame,'frame');
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorLeaf,'leaf',true);
const loadingDoorLight=new THREE.PointLight(0xb9ff9a,2.4,5.2,2);loadingDoorLight.position.set(0,3.55,7.15);scene.add(loadingDoorLight);
function normalizeLargest(model,targetSize,alignTop=false){const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetSize/Math.max(size.x,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,(alignTop?-bounds.max.y:-bounds.min.y)*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const wrapper=new THREE.Group();wrapper.add(model);return wrapper;}
const roadMaterial=new THREE.MeshStandardMaterial({color:0x242827,roughness:.98});
const curbMaterial=new THREE.MeshStandardMaterial({color:0x999d91,roughness:1});
const grassMaterials=[
  new THREE.MeshStandardMaterial({color:0x2f7429,roughness:1,flatShading:true}),
  new THREE.MeshStandardMaterial({color:0x356f2b,roughness:1,flatShading:true}),
];
STREET_LAYOUT.grass.forEach((patch,index)=>box([patch.width,.08,patch.depth],grassMaterials[index%grassMaterials.length],[patch.x,-.01,patch.z],false));
box([8.4,.08,38],roadMaterial,[0,-.02,25],false);
for(const x of [-5.1,5.1]){
  box([1.8,.16,24.4],curbMaterial,[x,.04,18.2],false);
  box([1.8,.16,6.4],curbMaterial,[x,.04,40.8],false);
}
const streetIntersection=box([32,.08,7.2],roadMaterial,[0,-.015,STREET_LAYOUT.intersectionZ],false);
STREET_LAYOUT.crossCurbs.forEach(curb=>box([curb.width,.16,curb.depth],curbMaterial,[curb.x,.04,curb.z],false));
const laneMaterial=new THREE.MeshStandardMaterial({color:0xd7d3b2,roughness:.9});
for(const z of [9,17,21,25,29,39,43])box([.1,.012,2.1],laneMaterial,[0,.03,z],false);
for(const x of [-13,-9,-5,5,9,13])box([2.1,.012,.1],laneMaterial,[x,.03,STREET_LAYOUT.intersectionZ],false);
const crossingMaterial=new THREE.MeshStandardMaterial({color:0xe7e3cf,roughness:.94});
for(const x of [-3.3,-2.2,-1.1,0,1.1,2.2,3.3])box([.56,.016,2.1],crossingMaterial,[x,.035,STREET_LAYOUT.crossingZ],false);
const shopLayout=cityBuildingFor('shop');
const houseLayout=cityBuildingFor('house');
portalHit([.35,2.7,1.45],[shopLayout.portalX,1.35,14.7],'shop-entrance');
portalHit([.9,2.7,1.45],[houseLayout.portalX,1.35,houseLayout.positionZ],'house-entrance');
new GLTFLoader().load(ASSET_URLS.city.shop,gltf=>{const building=normalizeAsset(gltf.scene,5.4);building.rotation.y=Math.PI/2;building.position.set(shopLayout.positionX,shopLayout.positionY,14.7);scene.add(building);if(buildingUsesRobinhoodLogo('shop')){const signY=2.77;const plate=box([.08,.72,2.34],new THREE.MeshStandardMaterial({color:0x06190e,roughness:.72}),[-6.43,signY,14.7]);const logo=new THREE.Mesh(new THREE.PlaneGeometry(.36,.52),new THREE.MeshBasicMaterial({map:shopMarkTexture,transparent:true,alphaTest:.01,side:THREE.DoubleSide,toneMapped:false}));logo.position.set(-6.385,signY,14.7);logo.rotation.y=Math.PI/2;scene.add(logo);}console.info('Robinweed · complete one-piece cute Meshy V5 Robinhood shop loaded');},undefined,error=>console.warn('Robinweed · V5 shop omitted',error));
new GLTFLoader().load(ASSET_URLS.city.house,gltf=>{const building=normalizeAsset(gltf.scene,5.8);building.rotation.y=-Math.PI/2;building.position.set(houseLayout.positionX,houseLayout.positionY,houseLayout.positionZ);scene.add(building);console.info('Robinweed · complete one-piece cute Meshy V5 house loaded');},undefined,error=>console.warn('Robinweed · V5 house omitted',error));

// Meshy V9 street-life layer. Repeated objects share one downloaded template.
const streetActors={};
const streetMixers=[];
const streetLights=[];
function tuneNightMaterials(root,intensity=.12){root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(material=>{const tuned=material.clone();if(tuned.map&&tuned.emissive){tuned.emissiveMap=tuned.map;tuned.emissive.set(0xffffff);tuned.emissiveIntensity=intensity;}tuned.roughness=Math.max(.48,tuned.roughness??.75);return tuned;});if(object.material.length===1)object.material=object.material[0];});}
const streetAssetLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function loadStreetSet(url,height,placements,label,onPlace){streetAssetLoader.load(url,gltf=>{const template=normalizeAsset(gltf.scene,height);tuneNightMaterials(template);placements.forEach((placement,index)=>{const instance=index===0?template:template.clone(true);instance.position.set(placement.x,placement.y??.08,placement.z);instance.rotation.y=placement.rotationY??0;scene.add(instance);onPlace?.(instance,placement,index,gltf.animations);});console.info(`Robinweed · Meshy street asset ${label} loaded`);},undefined,error=>console.warn(`Robinweed · street asset ${label} omitted`,error));}
loadStreetSet(ASSET_URLS.street.lamp,3.65,STREET_LAYOUT.lamps,'streetlamps',(lamp,placement,index)=>{if(index<4){const light=new THREE.PointLight(0xffc66d,7.5,8.5,2);light.position.set(placement.x,3.05,placement.z);scene.add(light);streetLights.push(light);}});
loadStreetSet(ASSET_URLS.street.tree,3.85,STREET_LAYOUT.trees.map((tree,index)=>({...tree,rotationY:index*1.17})),'street trees');
loadStreetSet(ASSET_URLS.street.shrub,1.02,STREET_LAYOUT.shrubs,'shrub planters');
loadStreetSet(ASSET_URLS.street.van,STREET_LAYOUT.van.height,[STREET_LAYOUT.van],'delivery van',(actor)=>{streetActors.van=actor;});
loadStreetSet(ASSET_URLS.street.loadingZone,STREET_LAYOUT.loadingZone.height,[STREET_LAYOUT.loadingZone],'loading-zone cluster');
loadStreetSet(ASSET_URLS.street.furniture,STREET_LAYOUT.furniture.height,[STREET_LAYOUT.furniture],'street-furniture island');
loadStreetSet(ASSET_URLS.street.neighborOlder,STREET_LAYOUT.neighborOlder.height,[STREET_LAYOUT.neighborOlder],'older neighbor',(actor,placement,index,animations)=>{streetActors.older=actor;if(animations?.[0]){const mixer=new THREE.AnimationMixer(actor);mixer.clipAction(animations[0]).play();streetMixers.push(mixer);}});
loadStreetSet(ASSET_URLS.street.cat,STREET_LAYOUT.cat.height,[STREET_LAYOUT.cat],'street cat',(actor)=>{streetActors.cat=actor;});
loadStreetSet(ASSET_URLS.street.simpleHouseA,STREET_LAYOUT.houses[0].height,[STREET_LAYOUT.houses[0]],'simple house A');
loadStreetSet(ASSET_URLS.street.simpleHouseB,STREET_LAYOUT.houses[1].height,[STREET_LAYOUT.houses[1]],'simple house B');
for(const [x,y,z,color,intensity] of [[-6,2.2,14.7,0xffd39a,2.6],[6,2.35,houseLayout.positionZ,0xffc77d,2.4],[0,3.2,42,0xa7c6ff,1.4]]){const glow=new THREE.PointLight(color,intensity,7.5,2);glow.position.set(x,y,z);scene.add(glow);streetLights.push(glow);}
let streetAmbienceContext=null;
let vehicleRouteState={segment:0,distance:0};
function startStreetAmbience(){if(streetAmbienceContext){streetAmbienceContext.resume();return;}const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return;streetAmbienceContext=new AudioContext();const length=streetAmbienceContext.sampleRate*3;const buffer=streetAmbienceContext.createBuffer(1,length,streetAmbienceContext.sampleRate);const data=buffer.getChannelData(0);let value=0;for(let i=0;i<length;i++){value=value*.985+(Math.random()*2-1)*.015;data[i]=value;}const wind=streetAmbienceContext.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=streetAmbienceContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;const gain=streetAmbienceContext.createGain();gain.gain.value=.026;wind.connect(filter).connect(gain).connect(streetAmbienceContext.destination);wind.start();}

const interiorObstacles={
  'shop-interior':[],
  'house-interior':[],
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
  const table=box([2.7,.15,1.15],mats.wood,[0,.82,centerZ-.55]);
  for(const x of [-1.2,1.2])for(const z of [centerZ-1,centerZ-.1])box([.12,.82,.12],mats.metal,[x,.4,z]);
  interiorObstacles[location].push({minX:-1.55,maxX:1.55,minZ:centerZ-1.25,maxZ:centerZ+.15});
  const lamp=new THREE.PointLight(location==='shop-interior'?0xb9ff83:0xffd6a0,7,9,2);lamp.position.set(0,3.45,centerZ);scene.add(lamp);
  box([1.35,.1,.5],dark,[0,3.65,centerZ],false);
  return table;
}
makeInterior('shop-interior',-30,0x273a29);
makeInterior('house-interior',-48,0x493d31);

// Plants and pots
const pots=[];
const growTableTopY=.84;
const supportInset=.008;
const plantTemplates=new Map();
const leafMat = new THREE.MeshStandardMaterial({color:0x357c34,roughness:.85,side:THREE.DoubleSide});
const lightLeafMat = new THREE.MeshStandardMaterial({color:0x62a94c,roughness:.8,side:THREE.DoubleSide});
const budMat = new THREE.MeshStandardMaterial({color:0x8bad62,roughness:.9,emissive:0x192a10,emissiveIntensity:.25});
function createLeaf(scale, y, angle, material=leafMat){
  const geo=new THREE.ConeGeometry(.11*scale,.55*scale,5);geo.rotateZ(Math.PI/2);
  const leaf=new THREE.Mesh(geo,material);leaf.position.y=y;leaf.rotation.y=angle;leaf.rotation.z=-.12;leaf.castShadow=true;return leaf;
}
function rebuildPlant(pot){
  if(pot.plant) pot.group.remove(pot.plant);
  const stage=stageFor(pot.growth); const plant=new THREE.Group(); pot.plant=plant;pot.group.add(plant);
  if(pot.potMesh)pot.potMesh.visible=true;if(pot.soil)pot.soil.visible=true;
  if(plantTemplates.has(stage)){pot.potMesh.visible=false;pot.soil.visible=false;plant.userData.meshy=true;plant.add(plantTemplates.get(stage).clone(true));return;}
  if(stage===0)return;
  const heights=[.03,.16,.42,.74,1.0,1.12]; const height=heights[stage];
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,height,7),new THREE.MeshStandardMaterial({color:0x4d8138,roughness:.9}));stem.position.y=.17+height/2;stem.castShadow=true;plant.add(stem);
  const count=[0,2,5,9,12,14][stage];
  for(let i=0;i<count;i++){const y=.25+(i/Math.max(1,count-1))*height*.82;const leaf=createLeaf(.48+stage*.09,y,i*2.35,i%2?leafMat:lightLeafMat);plant.add(leaf);}
  if(stage>=4){const buds=stage===4?4:8;for(let i=0;i<buds;i++){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(stage===5?.105:.07,1),budMat);b.scale.set(.75,1.5,.75);b.position.set(Math.cos(i*2.4)*(.12+(i%3)*.025),.55+(i/buds)*height*.63,Math.sin(i*2.4)*(.12+(i%3)*.025));b.castShadow=true;plant.add(b);}}
  plant.scale.setScalar(.92+stage*.025);
}
[-2.4,-.8,.8,2.4].forEach((x,index)=>{
  const group=new THREE.Group();group.position.set(x,supportedOriginY({surfaceY:growTableTopY,inset:supportInset}),-2.2);scene.add(group);
  const potMesh=new THREE.Mesh(new THREE.CylinderGeometry(.34,.27,.46,9),mats.pot);potMesh.position.y=.23;potMesh.castShadow=true;group.add(potMesh);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.025,16),mats.soil);soil.position.y=.47;group.add(soil);
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,1.65,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.y=.85;group.add(hit);
  const pot={group,hit,potMesh,soil,growth:index===0?10:0,water:index===0?82:0,plant:null,index};hit.userData.interactive={type:'pot',pot};pots.push(pot);rebuildPlant(pot);
});

function loadPlantStage(stage,url,targetHeight,label){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetHeight/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});plantTemplates.set(stage,model);pots.filter(p=>stageFor(p.growth)===stage).forEach(rebuildPlant);console.info(`Robinweed · Meshy ${label} loaded`);},undefined,error=>console.warn(`Robinweed · ${label} fallback`,error));}
loadPlantStage(0,'/models/plants/pot-empty.glb',.5,'empty pot');
loadPlantStage(1,'/models/plants/planted-seed.glb',.5,'planted seed');
loadPlantStage(2,'/models/plants/sprout.glb',.72,'sprout');
loadPlantStage(3,'/models/plants/vegetative.glb',1.36,'vegetative plant');
loadPlantStage(4,'/models/plants/flowering.glb',1.52,'flowering plant');
loadPlantStage(5,'/models/plants/mature-buds.glb',1.55,'mature plant');

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
new GLTFLoader().load(ASSET_URLS.warehouse.vendorCounter,gltf=>{const model=normalizeAsset(gltf.scene,1.05);model.position.set(4.7,0,-5.7);scene.add(model);counter.visible=false;console.info('Robinweed · Meshy V3 vendor counter loaded');},undefined,error=>console.warn('Robinweed · vendor counter fallback',error));
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
  const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=1.92/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});vendor.add(model);vendorFallback.visible=false;
  vendorMixer=new THREE.AnimationMixer(model);
  if(gltf.animations[0])vendorActions.idle=vendorMixer.clipAction(gltf.animations[0]);
  setVendorAnimation(vendorRequestedClip);
  new GLTFLoader().load(ASSET_URLS.vendor.talk,talkGltf=>{if(talkGltf.animations[0])vendorActions.talk=vendorMixer.clipAction(talkGltf.animations[0]);setVendorAnimation(vendorRequestedClip);console.info('Robinweed · Meshy V3 Vlad Tenev talk animation loaded');},undefined,error=>console.warn('Robinweed · Vlad Tenev talk animation omitted',error));
  console.info('Robinweed · Meshy V3 animated Vlad Tenev loaded');
},undefined,error=>console.warn('Robinweed · animated Vlad Tenev fallback',error));

// Tool viewmodel
const weaponRoot=new THREE.Group();weaponRoot.position.set(.58,-.47,-.95);camera.add(weaponRoot);
const tools=[new THREE.Group(),new THREE.Group(),new THREE.Group()];tools.forEach(t=>weaponRoot.add(t));
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
  console.info('Robinweed · Meshy low-poly watering can loaded');
});}).catch(()=>{});
function loadViewModel(index,url,targetSize,rotation,position,fallback,label,screenRotation=0,depthTilt=0){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());model.position.set(-center.x,-center.y,-center.z);const wrapper=new THREE.Group();wrapper.add(model);wrapper.scale.setScalar(targetSize/Math.max(size.x,size.y,size.z));wrapper.rotation.set(...rotation);if(screenRotation)wrapper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),screenRotation));if(depthTilt)wrapper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(.66,.75,0).normalize(),depthTilt));wrapper.position.set(...position);model.traverse(o=>{if(o.isMesh)o.castShadow=true;});tools[index].add(wrapper);fallback.visible=false;console.info(`Robinweed · Meshy ${label} loaded`);},undefined,error=>console.warn(`Robinweed · ${label} fallback`,error));}
const trimmerScreenRotation=2.18;
const trimmerDepthTilt=-.85;
loadViewModel(1,'/models/tools/trimmers.glb',.43,[.12,.95,2.36],[-.12,-.02,-.12],scissorsFallback,'trimmers',trimmerScreenRotation,trimmerDepthTilt);
loadViewModel(2,ASSET_URLS.items.seedPack,.55,[.08,-.35,-.08],[-.03,.08,0],bagFallback,'V7 Robinhood seed pack');
let budInventoryModel=null;
new GLTFLoader().load('/models/plants/harvested-bud.glb',gltf=>{budInventoryModel=normalizeAsset(gltf.scene,.3);budInventoryModel.position.set(4.05,1.06,-5.62);budInventoryModel.visible=false;scene.add(budInventoryModel);console.info('Robinweed · Meshy harvested bud loaded');},undefined,error=>console.warn('Robinweed · harvested bud omitted',error));

// State and interaction
const state={cash:120,seeds:4,buds:0,slot:0,locked:false,near:null,location:'warehouse',pendingPortal:null};
const input=new InputController();let yaw=0,pitch=0,last=performance.now(),toolKick=0,bob=0;
const playerRadius=.28;
const collisionObstaclesByLocation={
  warehouse:[
    {minX:-3.55,maxX:3.55,minZ:-2.85,maxZ:-1.55},
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
};
const raycaster=new THREE.Raycaster();raycaster.far=3.2;
const interactives=[...pots.map(p=>p.hit),vendorHit,...portalHitboxes];
const ui={gate:document.querySelector('#gate'),hud:document.querySelector('#hud'),prompt:document.querySelector('#prompt'),toast:document.querySelector('#toast'),cash:document.querySelector('#cash'),seeds:document.querySelector('#seeds'),buds:document.querySelector('#buds'),objective:document.querySelector('#objective'),chapter:document.querySelector('.chapter'),vendor:document.querySelector('#vendorPanel'),wallet:document.querySelector('#walletPanel'),portal:document.querySelector('#portalPanel'),portalTitle:document.querySelector('#portalTitle'),portalMessage:document.querySelector('#portalMessage'),portalYes:document.querySelector('#portalYes'),portalNo:document.querySelector('#portalNo')};
function refresh(){ui.cash.textContent=`$${state.cash}`;ui.seeds.textContent=state.seeds;ui.buds.textContent=state.buds;if(budInventoryModel)budInventoryModel.visible=state.buds>0;document.querySelectorAll('.hotbar button').forEach((b,i)=>b.classList.toggle('active',i===state.slot));tools.forEach((t,i)=>t.visible=i===state.slot);if(state.location==='warehouse'){ui.chapter.innerHTML='GROW ROOM 01 <b>•</b> NIGHT SHIFT';ui.objective.textContent=state.buds?`Sell your harvest to ${VENDOR_NAME}`:pots.some(p=>stageFor(p.growth)===5)?'Harvest the mature plant with trimmers':pots.some(p=>p.growth>0)?'Raise a plant to full bloom':'Plant a seed in an empty pot';}else if(state.location==='street'){ui.chapter.innerHTML='ROBINWEED CITY <b>•</b> NIGHT';ui.objective.textContent='Approach a door and press E to enter';}else{ui.chapter.innerHTML=`${state.location==='shop-interior'?'SHOP':'HOUSE'} INSTANCE <b>•</b> PRIVATE`;ui.objective.textContent='Explore the instance or use the door to leave';}}
if(new URLSearchParams(location.search).has('qa'))globalThis.__robinweedQA={camera,input,state,setView(value){yaw=value;pitch=0;},position(){return camera.position.toArray();},setPosition(x,z){camera.position.x=x;camera.position.z=z;},setLocation(value){state.location=value;refresh();},loadingDoor(){return{openAmount:loadingDoorOpen,leafY:loadingDoorLeaf?.position.y??null,target:loadingDoorTarget(state.location,camera.position,loadingDoorPosition)};},pickTool(ndcX,ndcY){const probe=new THREE.Raycaster();probe.setFromCamera(new THREE.Vector2(ndcX,ndcY),camera);const isVisible=object=>{for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;};const hit=probe.intersectObject(tools[state.slot],true).find(result=>isVisible(result.object));if(!hit)return null;return{point:hit.point.toArray(),local:hit.object.worldToLocal(hit.point.clone()).toArray(),uv:hit.uv?.toArray()||null,faceIndex:hit.faceIndex};},openPortal(id){openPortalConfirm(id);},confirmPortal(){applyPendingPortal();},setVendorPanel(open){if(open)openPanel(ui.vendor);else closePanels();},setPot(index,growth){const pot=pots[index];pot.growth=growth;pot.water=growth?60:0;rebuildPlant(pot);refresh();},setBuds(value){state.buds=value;refresh();}};
let toastTimer;function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1800);}
function selectSlot(slot){state.slot=slot;toolKick=.4;refresh();}
function activePot(){return state.near?.type==='pot'?state.near.pot:null;}
function useTool(){
  const pot=activePot();if(!pot)return;
  toolKick=1;
  if(state.slot===2){const result=plantSeed(pot,state.seeds);if(!result.changed)return showToast(state.seeds?'POT IS ALREADY OCCUPIED':'NO SEEDS');pot.growth=result.pot.growth;pot.water=result.pot.water;state.seeds=result.seeds;rebuildPlant(pot);showToast('SEED PLANTED');}
  if(state.slot===0){if(pot.growth===0)return showToast('PLANT A SEED FIRST');const next=waterPlant(pot);if(next.growth===pot.growth)return showToast(pot.growth>=10?'READY FOR TRIMMERS':'SOIL IS SATURATED');pot.growth=next.growth;pot.water=next.water;rebuildPlant(pot);spray();showToast(`${STAGES[stageFor(pot.growth)].name.toUpperCase()} · WATER ${Math.round(pot.water)}%`);}
  if(state.slot===1){const result=harvestPlant(pot);if(!result.changed)return showToast('NOT READY TO HARVEST');pot.growth=0;pot.water=0;state.buds+=result.buds;rebuildPlant(pot);showToast(`HARVESTED ×${result.buds}`);}
  refresh();
}
function spray(){for(let i=0;i<14;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.008,4,3),new THREE.MeshBasicMaterial({color:0x8ad8dc,transparent:true,opacity:.8}));drop.position.copy(camera.position);const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);drop.position.add(dir.multiplyScalar(.7));drop.position.x+=(Math.random()-.5)*.15;scene.add(drop);drop.userData.velocity=new THREE.Vector3((Math.random()-.5)*.02,-.025-Math.random()*.02,(Math.random()-.5)*.02);drop.userData.life=1;particles.push(drop);}}
const particles=[];
function openPanel(panel){document.exitPointerLock();panel.classList.remove('hidden');if(panel===ui.vendor)setVendorAnimation(vendorClipForPanel(true));}
function closePanels(){ui.vendor.classList.add('hidden');ui.wallet.classList.add('hidden');ui.portal.classList.add('hidden');state.pendingPortal=null;setVendorAnimation(vendorClipForPanel(false));}
function openPortalConfirm(id){const config=portalFor(id);if(!config)return;state.pendingPortal=id;document.exitPointerLock();ui.portalTitle.textContent=config.title;ui.portalMessage.textContent=config.message;ui.portalYes.textContent=config.confirm;ui.portal.classList.remove('hidden');}
function cancelPortal(){state.pendingPortal=null;ui.portal.classList.add('hidden');canvas.requestPointerLock();}
function applyPendingPortal(){const config=portalFor(state.pendingPortal);if(!config)return cancelPortal();state.location=config.target;camera.position.set(config.spawn.x,1.68,config.spawn.z);yaw=config.spawn.yaw;pitch=0;state.pendingPortal=null;ui.portal.classList.add('hidden');refresh();showToast(`${config.target.replace('-', ' ').toUpperCase()} LOADED`);canvas.requestPointerLock();}

document.querySelector('#play').addEventListener('click',()=>{startStreetAmbience();canvas.requestPointerLock();});
canvas.addEventListener('pointerdown',()=>{startStreetAmbience();const actions=input.primaryDown();if(actions.some(a=>a.type==='use-tool'))useTool();else if(!state.locked&&ui.vendor.classList.contains('hidden')&&ui.wallet.classList.contains('hidden')&&ui.portal.classList.contains('hidden'))canvas.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;input.setGameplayEnabled(state.locked);ui.gate.classList.toggle('hidden',state.locked||!ui.hud.classList.contains('hidden'));if(state.locked){ui.hud.classList.remove('hidden');closePanels();}});
document.addEventListener('mousemove',e=>{if(!state.locked)return;yaw-=e.movementX*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch-e.movementY*.0022));});
document.addEventListener('keydown',e=>{for(const action of input.keyDown(e.code,e.repeat)){if(action.type==='select-slot')selectSlot(action.slot);if(action.type==='interact'&&state.near?.type==='vendor')openPanel(ui.vendor);if(action.type==='interact'&&state.near?.type==='portal')openPortalConfirm(state.near.id);}});
document.addEventListener('keyup',e=>input.keyUp(e.code));
window.addEventListener('blur',()=>input.releaseAll());
document.querySelectorAll('.hotbar button').forEach(b=>b.addEventListener('click',()=>selectSlot(Number(b.dataset.slot))));
document.querySelector('#wallet').addEventListener('click',()=>openPanel(ui.wallet));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{closePanels();canvas.requestPointerLock();}));
ui.portalYes.addEventListener('click',applyPendingPortal);
ui.portalNo.addEventListener('click',cancelPortal);
document.querySelector('#buySeeds').addEventListener('click',()=>{if(state.cash<24)return showToast('NOT ENOUGH CASH');state.cash-=24;state.seeds+=3;refresh();showToast('BOUGHT SEED PACK ×3');});
document.querySelector('#sellBuds').addEventListener('click',()=>{if(!state.buds)return showToast('NO HARVEST TO SELL');const earned=state.buds*18;state.cash+=earned;state.buds=0;refresh();showToast(`SOLD FOR $${earned}`);});

function updateNear(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObjects(interactives,false);state.near=hits[0]?.object.userData.interactive||null;if(!state.near){ui.prompt.classList.remove('show');return;}let text='';if(state.near.type==='vendor')text=`[ E ] TALK TO ${VENDOR_NAME.toUpperCase()}`;else if(state.near.type==='portal')text=`[ E ] ${portalFor(state.near.id)?.title||'USE DOOR'}`;else{const p=state.near.pot;const s=stageFor(p.growth);text=p.growth===0?'EMPTY POT · EQUIP SEED BAG':`${STAGES[s].name.toUpperCase()} · WATER ${Math.round(p.water)}%`;}ui.prompt.textContent=text;ui.prompt.classList.add('show');}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,(now-last)/1000);last=now;
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
  if(state.locked){const direction=movementVector(yaw,code=>input.isHeld(code));const moving=direction.x!==0||direction.z!==0;if(moving){const speed=input.isHeld('ShiftLeft')?5.1:3.25;const next=moveCircle(camera.position,{x:direction.x*dt*speed,z:direction.z*dt*speed},collisionObstaclesByLocation[state.location]||[],boundsForLocation(state.location),playerRadius);camera.position.x=next.x;camera.position.z=next.z;bob+=dt*11;}camera.position.y=1.68+Math.sin(bob)*.025*(moving?1:0);}
  pots.forEach(p=>{if(p.growth>0&&p.water>0)p.water=Math.max(0,p.water-dt*4.8);if(p.plant&&!p.plant.userData.meshy)p.plant.rotation.y=Math.sin(now*.00065+p.index)*.035;});
  toolKick=Math.max(0,toolKick-dt*3.4);weaponRoot.rotation.x=-Math.sin(toolKick*Math.PI)*.55;weaponRoot.rotation.z=Math.sin(bob)*.018;
  loadingDoorOpen=advanceLoadingDoor(loadingDoorOpen,loadingDoorTarget(state.location,camera.position,loadingDoorPosition),dt);if(loadingDoorLeaf)loadingDoorLeaf.position.y=loadingDoorOpen*loadingDoorTravel;
  particles.forEach((p,i)=>{p.position.add(p.userData.velocity);p.userData.velocity.y-=.0015;p.userData.life-=dt*1.7;p.material.opacity=p.userData.life;if(p.userData.life<=0){scene.remove(p);particles.splice(i,1);}});
  growLights.forEach((l,i)=>l.intensity=7.2+Math.sin(now*.0017+i)*.35);
  streetLights.forEach((light,i)=>light.intensity=(i<4?7.25:2.35)+Math.sin(now*.0011+i*1.7)*.18);
  nightClouds.forEach((cloud,i)=>{cloud.position.x+=dt*(.08+i*.025);if(cloud.position.x>18)cloud.position.x=-18;});
  vehicleRouteState=advanceVehicleRoute(vehicleRouteState,dt,STREET_LAYOUT.vehicleRoute,STREET_LAYOUT.van.speed);
  if(streetActors.van){streetActors.van.position.x=vehicleRouteState.x;streetActors.van.position.z=vehicleRouteState.z;const turn=Math.atan2(Math.sin(vehicleRouteState.rotationY-streetActors.van.rotation.y),Math.cos(vehicleRouteState.rotationY-streetActors.van.rotation.y));streetActors.van.rotation.y+=turn*Math.min(1,dt*4.2);}
  if(streetActors.cat){streetActors.cat.position.y=.08+Math.sin(now*.0017)*.006;streetActors.cat.rotation.z=Math.sin(now*.0012)*.008;}
  if(streetActors.older){streetActors.older.rotation.z=Math.sin(now*.0012)*.012;streetActors.older.rotation.y=STREET_LAYOUT.neighborOlder.rotationY+Math.sin(now*.00055)*.08;}
  streetMixers.forEach(mixer=>mixer.update(dt));
  if(vendorMixer)vendorMixer.update(dt);
  updateNear();renderer.render(scene,camera);
}
refresh();animate(performance.now());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
console.info('Robinweed ready · frontend-only mode');
