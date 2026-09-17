import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinnedAsset } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries as mergeCityGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stageFor, STAGES, plantSeed, waterPlant, advancePlant, harvestPlant } from './plantState.js';
import { InputController } from './inputController.js';
import { movementVector } from './movementMath.js';
import { moveCircle } from './collisionMath.js';
import { ASSET_URLS, vendorClipForPanel } from './assetManifest.js';
import { INITIAL_PLAYER_SPAWN, portalFor, boundsForLocation, cityBuildingFor } from './navigationState.js';
import { VENDOR_NAME } from './branding.js';
import { isRestaurantSignColor, neonFlicker } from './signState.js';
import { supportedOriginY } from './placementMath.js';
import { loadingDoorTarget, advanceLoadingDoor } from './loadingDoorState.js';
import { STREET_LAYOUT, advanceVehicleRoute, advancePatrol, advanceStrollPatrol, advanceVanStop, advanceVanThrottle, vanStopIdle, vanTravelDir, STREET_WALKERS } from './streetLifeState.js';
import { CITY_PERIMETER, CITY_BLOCK } from './cityBoundsState.js';
import { FENCE_STYLES, lotFencePieces, fenceInstanceMatrices, postInstanceMatrices, fenceUvRepeats, postUvRepeats, paintPlank, paintHedge, paintChain } from './lotFenceState.js';
import { GROUND_REPEAT, GROUND_TEXTURE_SIZE, GROUND_PAINTERS } from './groundTextureState.js';
import { MANZANA_PRESETS, DEFAULT_MANZANA_PRESET, manzanaPresetById, lots as cityLots, lotGaps as cityLotGaps, cornerGaps as cityCornerGaps } from './lotState.js';
import { GROUND_STYLES, yardBoxes, yardBoxMatrices, yardGround, paintGround } from './yardDressingState.js';
import { backDecals, backDecalMatrices } from './backFacadeState.js';
import { DEFAULT_LATERALES_PRESET, LATERALES_PRESETS, lateralesPresetById, sideDecalGroups, sideDecalMatrices, sideDecals } from './sideFacadeState.js';
import { BRAND_SWAPS, DEFAULT_MARCAS_PRESET, MARCAS_PRESETS, hiddenDecalLots, marcasPresetById, swappedLotIds } from './brandFreeState.js';
import { DEFAULT_SUELO_PRESET, SUELO_PRESETS, apronEdges, apronGeometrySpecs, edgeGeometrySpecs, frontAprons, sueloPresetById } from './frontApronState.js';
import { KERB_LIFT, kerbGeometrySpecs, kerbRuns } from './kerbEdgeState.js';
import { dashHidden, kerbRunsNotched, rampGeometrySpecs, returnGeometrySpecs, returnKerbGeometrySpecs, zebraGeometrySpecs } from './crossingState.js';
import { VAN_TRAFFIC_STOPS } from './vanStopState.js';
import { BASES_PRESETS, DEFAULT_BASES_PRESET, SHOPFRONT_CANVAS, basesPresetById, paintShopfront, podiumGeometrySpecs, podiums, shopfronts } from './slabPodiumState.js';
import { doorStoops, stoopGeometrySpecs } from './doorStoopState.js';
import { CASAS_PRESETS, DEFAULT_CASAS_PRESET, casasPresetById, houseTints, lotIdForPlacement } from './houseTintState.js';
import { DEFAULT_SOLIDOS_PRESET, SOLIDOS_PRESETS, propColliders, solidosPresetById, tightenedStreetBase } from './propColliderState.js';
import { DEFAULT_VEREDA_PRESET, DRESSING_KIT, VEREDA_PRESETS, dressingColliders, dressingPlacements, readVeredaPreset, veredaPresetById } from './streetDressingState.js';
import { DEFAULT_ISLA_PRESET, ISLA_PRESETS, ISLAND, cornerColliders, cornerPadSpecs, cornerPieceY, cornerPieces, islaPresetById } from './spawnCornerState.js';
import { wallPanels, skylineBlocks as citySkylineBlocks, WALL_STYLE, DEFAULT_WALL_PRESET, wallPresetById, WALL_SKINS, WALL_LIFT_SKINS, wallSkinRepeat as cityWallSkinRepeat, paintPartyWall, paintSiteWall, paintHoarding, SKYLINE_KIT, skylineWindows } from './cityWallState.js';
import { POINT_BUDGET, assignBudgetSlots, budgetPlacement, buildFixtureTable, tuneFixtures, SPOT_BUDGET, assignGrowSlots, growPlacement } from './lightBudget.js';
import { EXTRA_LIGHT_FIXTURES, RESTAURANT_SIGN_FIXTURE, VENDOR_COUNTER_FIXTURE } from './g60LightFixtures.js';
import { GROW_EMITTER, GROW_SHAFT, LEGACY_GROW_LIGHT, buildShaftAlpha, growLightPulse, growLightRig, growShaftGeometry, legacyGrowPulse } from './lightZoneState.js';
import { MOON_RIG, moonRigForCamera } from './moonShadowState.js';
import { CONTACT_SHADOW, buildRadialAlphaPixels, contactShadowRadius } from './contactShadow.js';
import { STREET_LIGHT_POOL } from './streetLightPool.js';
import { HORIZON, buildSkyGradientPixels, buildSkylineBlocks } from './horizonState.js';
import { NIGHT_SKY, driftCloudX, moonDiscPosition } from './nightSkyState.js';
import { skyVisibleForLocation } from './skyVisibilityState.js';
import { DEFAULT_LIGHTING_PRESET, LIGHTING_KNOBS, applyLightingOverrides, lightingPresetById, recompileKeysBetween } from './lightingPresets.js';
import { fitScaleForWorldBox } from './assetFit.js';
import { lawVariants } from './materialLaw.js';
import { DEFAULT_LEY_PRESET, leyPresetById } from './leyPresets.js';
import { RESTAURANT_EXTERIOR_INTERACTION, RESTAURANT_INTERIOR_LAYOUT } from './restaurantExperience.js';
import { warehouseVisibilityForLocation } from './warehouseVisibilityState.js';
import { FLOOR_SLAB, DOCK_APRON, INDUSTRIAL_FLOOR, GALPON_PRESETS, DEFAULT_GALPON_PRESET, galponPresetById, rampTransform, paintIndustrialFloor, WALL_SKIN, CEILING_KIT, CAMPANA, wallSkinRepeat, paintWallSkin, MIST, mistPhase, mistPoint, campanaPoolMatrices, ledPulse } from './warehouseShellState.js';
import { INFRA_PROPS, INFRA_COLLIDERS, CONTROLLER_SCREEN, paintControllerScreen, paintSignage, irrigationRails, nearestFreeSpot } from './warehouseInfraState.js';
import { trailerButtonsVisible, spectatorFlightDelta } from './loaderState.js';
import { isHouseheadNearby, nextHouseheadPanel } from './househeadSwapState.js';
import { isNeighborGuideNearby } from './neighborGuideState.js';
import { buildSkyStarPositions } from './skyStarsState.js';
import { SEED_VARIETIES, tickerForSlot } from './seedVarietyState.js';
import { VENDOR_SEED_PRODUCTS } from './vendorSeedShopState.js';
import { HOUSE_PROPERTIES, propertyNear, purchasePreview, propertyAccess, streetSpawnForProperty } from './housePropertyState.js';
import { matureBudVariant } from './matureBudState.js';
import { assignSessionPlayerSkin, PLAYER_SKINS } from './playerSkinState.js';
import { WAREHOUSE_GROW_STATIONS, WAREHOUSE_DECOR, WAREHOUSE_JARS, WAREHOUSE_JAR_BUD_PLACEMENTS, stationCollider } from './warehouseExpansionState.js';
import { DISPLAY_SHELF_BANKS, displayShelfPieces, displayPlantPlacements } from './warehouseDisplayShelves.js';
import { vendorYawTowardPlayer } from './vendorOrientationState.js';
import { createSerializedAuthenticator, isSameWalletAddress, MultiplayerClient } from './multiplayerClient.js';
import { advanceCadence, beginRemoteMotion, reconcilePredictedPosition, sampleRemoteMotion } from './multiplayerSmoothing.js';
import { executeCultivationAction, executeHousePurchase, executeSeedPurchase, loadEconomyConfigWithRetry, reconcileEconomyJournal } from './economyRuntime.js';
import { onchainPropertyId, propertyIdFromOnchain } from './onchainPropertyCatalog.js';
import { validateOnchainSnapshot } from './onchainSnapshot.js';
import { wateringIsVisual } from './cultivationMode.js';
import { beginVisualWatering, advanceVisualWatering, visualWaterDrops } from './visualWatering.js';
import * as GROW from './growthAnimation.js';
import './style.css';

const canvas = document.querySelector('#world');
const qaEnabled=import.meta.env.DEV&&new URLSearchParams(location.search).has('qa');
const devLog=console;
let LIGHTING=lightingPresetById(DEFAULT_LIGHTING_PRESET);
// ?galpon=0|1|2 (alias ?almacen=). 0 es el galpon de hoy: piso hundido bajo el pasto y la calzada.
let GALPON=galponPresetById(DEFAULT_GALPON_PRESET);
// ?muro=0|1|2 (alias ?medianera=). 0 es el limite de hoy: la medianera y las siluetas sin textura
// ni rebote, o sea negro puro en las seis caras que no miran a la luna.
let MURO=wallPresetById(DEFAULT_WALL_PRESET);
// ?manzana=0|1|2 (alias ?lote=). 0 es la cuadra de hoy: casas sueltas y pasto entre fachada y fachada.
let MANZANA=manzanaPresetById(DEFAULT_MANZANA_PRESET);
// ?suelo=0|1|2|3|4 (alias ?vereda=). 0 es el suelo de hoy: la vereda muere a 1,8 m del cordon y de ahi
// a la pared quedan 0,91 m de pasto pelado -- la puerta de cada casa abre directo al cesped.
// 1 estira la vereda hasta la pared en los 32 lotes que tienen hueco; 2 le pone el borde.
let SUELO=sueloPresetById(DEFAULT_SUELO_PRESET);
// ?solidos=0|1|2 (alias ?duros=). 0 es la calle de hoy: 33 de los 35 props de calle NO tienen caja
// de colision y el jugador los cruza caminando -- los 37 `obstacles` son AABB de EDIFICIOS.
// 1 los pone solidos por el POSTE del farol (0,352 m) para que la vereda de 1,8 m siga siendo
// caminable; 2 usa la JARDINERA entera (0,823) y suma los dos vecinos parados.
let SOLIDOS=solidosPresetById(DEFAULT_SOLIDOS_PRESET);
// ?vestida=0|1|2 (alias ?dressing=). 0 es la calle de hoy: 37 obstaculos en 10.773 m2, de los
// cuales 18 son faroles, y cero basura, cero autos estacionados, cero bicicletas, cero canteros.
// 1 llena las veredas; 2 suma los autos contra el cordon de la transversal, que es el tramo largo
// y vacio. En la avenida no van autos: la camioneta la recorre entera por x = +-2,72.
let VESTIDA=veredaPresetById(readVeredaPreset(location.search));
// ?laterales=0|1|2 (alias ?lados=). 0 son las casas de hoy: frente del GLB, fondo vestido por L y los
// dos LATERALES en blanco -- las 76 se ven a 8 m o menos y siete a menos de 70 cm. 1 pone ventanas
// (alguna encendida) y bajada pluvial en las paredes ciegas; 2 suma aire acondicionado, medidor y
// farolito. Las casas cuyo GLB ya trae ventanas laterales solo reciben los accesorios.
let LATERALES=lateralesPresetById(DEFAULT_LATERALES_PRESET);
// ?marcas=0|1 (alias ?brands=). 0 es la calle de hoy, con el KFC (la cara del Coronel a la salida del
// galpon) y el diner NIKE de la transversal. 1 los esconde y pone en sus lotes dos edificios sin marca.
let MARCAS=marcasPresetById(DEFAULT_MARCAS_PRESET);
// ?isla=0|1|2 (alias ?rincon=). 0 es el rincon de hoy: el diorama de mobiliario sobre su disco de piedra
// en (-10,5 / 10,5), una sola malla, con el 46 % del disco dentro del bolsillo sellado. 1 lo esconde y pone
// las cuatro piezas sueltas del kit (banco, cesto, buzon, hidrante) en el nicho; 2 pavimenta el nicho a la
// cota del cordon y lo cierra con dos setos por donde hoy se ve el pasto sellado.
let ISLA=islaPresetById(DEFAULT_ISLA_PRESET);
// ?casas=0|1|2 (alias ?paint=). 0 son las casas de hoy: cinco C y cinco D identicas en fila. 1 les da un tinte de
// pintura por lote (sobre el albedo y sobre el emisivo de noche), distinto entre vecinas; 2 el mismo al doble.
let CASAS=casasPresetById(DEFAULT_CASAS_PRESET);
// ?bases=0|1|2 (alias ?zocalos=). 0 es hoy: el comercial violeta flota sobre su placa celeste con la planta baja negra.
let BASES=basesPresetById(DEFAULT_BASES_PRESET);
// ?g60=0|1|2 (T49b). 0 es el galpon y la calle de ANTES del paquete G: Vlad de frente en el spawn viejo, el vendedor delante del
// mostrador y sin luz, sin los cuatro caminantes de T48 y el cartel del restaurante apagado. 1 es lo que dejan T43-T49; 2 lo exagera.
// `let` y no `const`: applyG60 guarda el preset vivo para que el panel y __robinweedQA.g60() digan cual esta puesto.
const G60=Object.freeze({id:1,vendorCollider:{minZ:-7.35,maxZ:-6.15},spawn:{x:0,z:-5.15,yaw:Math.PI},vendorZ:-6.75,counterLight:4.2,walkers:4,walkerSpeed:1,neonBase:1.45,signGlow:3.2});
const vendorColliderFor=preset=>({minX:4.1,maxX:5.5,minZ:preset.vendorCollider.minZ,maxZ:preset.vendorCollider.maxZ});
// B2/T10: la ley de materiales (materialLaw.js) entra detras de ?ley=0|1 (leyPresets.js; 0 = HOY bit a bit, 1 = ley, defecto 1). Cada loader registra AL FINAL (despues de tuneNightMaterials y de sus callbacks: neon de G, wrappers de ?marcas, tinte de ?casas) las variantes por malla: off = el material que hoy queda en la malla, on = la ley sobre un clon; applyLey conmuta por puntero sin recompilar (y re-tinta con syncCasas por si ?casas cambio mientras la otra variante estaba puesta). Los on aplanados toman LIGHTING.streetEmissive y entran a nightTunedMaterials (A manda sobre la intensidad emisiva, la ley sobre color y mapas). Los loaders que instancian (loadStreetSet, loadWarehouseProp) registran DESPUES de clonar el template: clone(true) copia el puntero de material y clonar un template ya conmutado a `on` perderia el hoy. Fuera por diseno (M-4, m-2): plantas, cogollos, vendorCounter, growBench/shelf/growLight, city.house, skins, porton y Vlad.
let LEY=leyPresetById(DEFAULT_LEY_PRESET);const lawMeshes=[];function registerLaw(root,url){if(!root)return;const pooled=new Set();for(const v of lawVariants(root,url)){lawMeshes.push(v);for(const m of [].concat(v.on)){if(!m||pooled.has(m))continue;pooled.add(m);if(m.userData.materialLawFlat)m.emissiveIntensity=LIGHTING.streetEmissive;if(m.emissiveMap||m.userData.materialLawFlat)nightTunedMaterials.push(m);}v.mesh.material=LEY.law?v.on:v.off;}}function applyLey(preset){LEY=preset;for(const v of lawMeshes)v.mesh.material=LEY.law?v.on:v.off;syncCasas();}
const moonAngle={azimuthDeg:MOON_RIG.azimuthDeg,elevationDeg:MOON_RIG.elevationDeg};
const LEGACY_CLOUDS=[[-10,10,31,1.4],[8,12,38,1.8],[-4,15,48,2.1]];
const contactDecals=[],nightTunedMaterials=[];
function moonRigNow(){return moonRigForCamera(camera.position,{...MOON_RIG,...moonAngle});}
SEED_VARIETIES.forEach(({slot,color})=>document.querySelector(`.hotbar button[data-slot="${slot}"]`)?.style.setProperty('--seed-color',color));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
// El unico filtro que existe. three 0.185 dio de baja PCFSoftShadowMap: avisa por consola
// y lo pisa con PCFShadowMap en el primer render con una luz que proyecte sombra (medido:
// el aviso sale en los presets 1 y 2). Pedirlo era pedir esto mismo con un warning al lado;
// la perilla real de la penumbra es moon.shadow.radius, unas lineas mas abajo.
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
const claimHarvestButton=document.querySelector('#claimHarvest');
function updateVendorEconomyButton(){const hood=vendorSelectedProduct.ticker==='HOOD';const ready=economyConfig.economyActive&&!hood;vendorBuyButton.disabled=!ready;vendorBuyButton.textContent=hood?'HOOD STOCK TOKEN UNAVAILABLE':ready?`BUY ${vendorSelectedProduct.packSize} SEEDS ONCHAIN`:'ECONOMY NOT ACTIVE';}
function disposeVendorPreview(){if(!vendorPreviewModel)return;vendorPreviewModel.traverse(object=>{if(!object.isMesh)return;object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{for(const value of Object.values(material||{}))if(value?.isTexture)value.dispose();material?.dispose();});});vendorPreviewScene.remove(vendorPreviewModel);vendorPreviewModel=null;}
function loadVendorPackPreview(product){const request=++vendorPreviewLoad;new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(product.assetUrl,gltf=>{if(request!==vendorPreviewLoad)return;disposeVendorPreview();const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=2.45/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,-center.y*scale,-center.z*scale);model.rotation.set(-.12,-.48,.05);model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});vendorPreviewModel=model;vendorPreviewScene.add(model);},undefined,error=>console.warn(`Stockdealer · ${product.ticker} shop preview unavailable`,error));}
function selectVendorProduct(product){vendorSelectedProduct=product;document.querySelector('#vendorSelectedTicker').textContent=product.ticker;document.querySelector('#vendorSwapRoute').textContent=`60% $STOCKDEALER → ${product.ticker} REWARD RESERVE`;document.querySelectorAll('.vendor-seed-option').forEach(button=>button.classList.toggle('active',button.dataset.ticker===product.ticker));updateVendorEconomyButton();loadVendorPackPreview(product);}
VENDOR_SEED_PRODUCTS.forEach(product=>{const button=document.createElement('button');button.className='vendor-seed-option';button.dataset.ticker=product.ticker;button.style.setProperty('--product-color',product.color);button.innerHTML=`<span class="vendor-seed-swatch">${product.ticker}</span><strong>${product.ticker}</strong><small>${product.packSize} SEEDS · ${product.tokenPrice} $STOCKDEALER</small>`;button.addEventListener('click',()=>selectVendorProduct(product));document.querySelector('#vendorSeedGrid').append(button);});
selectVendorProduct(vendorSelectedProduct);
let economyConfigLoading=false;
async function refreshEconomyConfig(){
  if(economyConfigLoading)return;
  economyConfigLoading=true;
  try{economyConfig=await loadEconomyConfigWithRetry();}
  catch(error){console.warn('Stockdealer · economy config unavailable',error);}
  finally{economyConfigLoading=false;updateVendorEconomyButton();updateClaimButton();}
}
refreshEconomyConfig();
addEventListener('online',refreshEconomyConfig);
addEventListener('focus',()=>{if(!economyConfig.economyActive)refreshEconomyConfig();});

const scene = new THREE.Scene();
scene.background = new THREE.Color(LIGHTING.skyZenith);
scene.fog = new THREE.FogExp2(LIGHTING.fogColor, LIGHTING.fogDensity);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, LIGHTING.cameraFar);
camera.position.set(INITIAL_PLAYER_SPAWN.x, 1.68, INITIAL_PLAYER_SPAWN.z);
scene.add(camera);

const hemi = new THREE.HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity);
scene.add(hemi);
const ambient = new THREE.AmbientLight(LIGHTING.ambient, LIGHTING.ambientIntensity);
scene.add(ambient);
const moon = new THREE.DirectionalLight(LIGHTING.moonColor, LIGHTING.moonIntensity);
const moonStart = LIGHTING.moonShadow ? moonRigNow() : { light: { x: -4, y: 8, z: 3 }, target: { x: 0, y: 0, z: 0 } };
moon.position.set(moonStart.light.x, moonStart.light.y, moonStart.light.z);
moon.target.position.set(moonStart.target.x, moonStart.target.y, moonStart.target.z);
scene.add(moon.target);
// three compiles shadow support into every material's program, so switching these costs a
// recompile -- but it DOES apply live (measured: one 1.3 s frame), which is why applyLighting
// sets both on every preset change instead of pretending the switch is impossible.
moon.castShadow = LIGHTING.moonShadow;
moon.shadow.mapSize.set(LIGHTING.shadowMapSize, LIGHTING.shadowMapSize);
moon.shadow.camera.left = -MOON_RIG.extent;
moon.shadow.camera.right = MOON_RIG.extent;
moon.shadow.camera.top = MOON_RIG.extent;
moon.shadow.camera.bottom = -MOON_RIG.extent;
moon.shadow.camera.near = MOON_RIG.near;
moon.shadow.camera.far = MOON_RIG.far;
moon.shadow.bias = MOON_RIG.bias;
moon.shadow.normalBias = MOON_RIG.normalBias;
moon.shadow.radius = MOON_RIG.radius;
scene.add(moon);

// Layered night sky: moon, stars and slow cloud silhouettes replace the flat void.
const moonDisc=new THREE.Mesh(new THREE.SphereGeometry(NIGHT_SKY.moonRadius,20,14),new THREE.MeshBasicMaterial({color:NIGHT_SKY.moonColor,fog:false,toneMapped:false}));
const moonDiscStart=moonDiscPosition(camera.position);
moonDisc.position.set(moonDiscStart.x,moonDiscStart.y,moonDiscStart.z);scene.add(moonDisc);
// Sky dome. toneMapped:false means the authored hex IS the pixel: scene.background alone
// came out #020403 because ACES at exposure 1.22 flattens it. The 1x128 gradient runs
// horizon->zenith, so the texture is remapped to the upper hemisphere (v .5-1) and clamps
// to the horizon row below it; without that the equator would sample two thirds of the way
// to the zenith and the horizon would read as dark as the sky above it.
const skyTex=new THREE.DataTexture(buildSkyGradientPixels({...HORIZON,horizon:LIGHTING.skyHorizon,zenith:LIGHTING.skyZenith}),1,HORIZON.gradientHeight);skyTex.colorSpace=THREE.SRGBColorSpace;skyTex.minFilter=THREE.LinearFilter;skyTex.magFilter=THREE.LinearFilter;skyTex.wrapS=THREE.ClampToEdgeWrapping;skyTex.wrapT=THREE.ClampToEdgeWrapping;skyTex.repeat.set(1,2);skyTex.offset.set(0,-1);skyTex.needsUpdate=true;
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(HORIZON.domeRadius,32,16),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,toneMapped:false,depthWrite:false}));skyDome.renderOrder=-1;skyDome.frustumCulled=false;scene.add(skyDome);
// Silhouette ring: one InstancedMesh, one draw call. fog:true is the whole point --
// the fog tints it so it reads as distance instead of geometry.
const skylineBlocks=buildSkylineBlocks();
const skyline=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:HORIZON.skyline.color,fog:true,toneMapped:false}),skylineBlocks.length);
skyline.frustumCulled=false;{const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);skylineBlocks.forEach((b,i)=>{p.set(Math.cos(b.angle)*b.radius,b.height/2,Math.sin(b.angle)*b.radius);q.setFromAxisAngle(up,-b.angle);s.set(b.width,b.height,b.depth);skyline.setMatrixAt(i,m.compose(p,q,s));});skyline.instanceMatrix.needsUpdate=true;}scene.add(skyline);
const starPositions=buildSkyStarPositions();
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:NIGHT_SKY.starColor,size:NIGHT_SKY.starSize,sizeAttenuation:true,fog:false,transparent:true,opacity:NIGHT_SKY.starOpacity,toneMapped:false}));scene.add(stars);
const nightClouds=[];
const cloudMaterial=new THREE.MeshBasicMaterial({color:NIGHT_SKY.cloudColor,transparent:true,opacity:NIGHT_SKY.cloudOpacity,fog:false,toneMapped:false});
for(const [x,y,z,s] of NIGHT_SKY.clouds){const cloud=new THREE.Group();for(const [ox,oy,os] of [[-1,0,.75],[0,.25,1],[1,0,.68]]){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(os,1),cloudMaterial);puff.scale.set(1.8,.62,.55);puff.position.set(ox,oy,0);cloud.add(puff);}cloud.position.set(x,y,z);cloud.scale.setScalar(s);scene.add(cloud);nightClouds.push(cloud);}

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
const whFloor=legacyWarehouseBox([14, .25, 16], mats.floor, [0, -.13, 0], false);
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
for(const columnX of [-5.2,5.2])legacyWarehouseBox([.42,4.05,.42],mats.metal,[columnX,2.02,1.25],false);
const ceilingPanelMaterial=new THREE.MeshStandardMaterial({color:0xfff4d2,emissive:0xffdca0,emissiveIntensity:1.6,roughness:.35});
for(const x of [-4.2,0,4.2]){
  box([1.05,.045,.58],ceilingPanelMaterial,[x,3.98,2.3],false);
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

// Two presentation-only grow displays. They are deliberately absent from `pots` and
// `interactives`: no plot IDs, cultivation actions, persistence, rewards or ownership.
const displayShelfSteel=new THREE.MeshStandardMaterial({color:0x46504b,roughness:.42,metalness:.72});
const displayShelfDeck=new THREE.MeshStandardMaterial({color:0x707b74,roughness:.58,metalness:.48});
const displayShelfLed=new THREE.MeshBasicMaterial({color:0xd9ffcf,toneMapped:false});
const displayShelfPool=new THREE.MeshBasicMaterial({color:0x86ff63,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
const displayShelfMaterials={upright:displayShelfSteel,shelf:displayShelfDeck,topBar:displayShelfSteel,ledBar:displayShelfLed,lightPool:displayShelfPool};
const displayShelfRoots=[];
for(const piece of displayShelfPieces()){
  const part=legacyWarehouseBox(piece.size,displayShelfMaterials[piece.kind],piece.position,piece.kind!=='ledBar'&&piece.kind!=='lightPool');
  part.userData.decorativeDisplay=true;part.userData.displayBank=piece.bank;part.userData.displayKind=piece.kind;
  if(piece.kind==='lightPool')part.renderOrder=2;
  displayShelfRoots.push(part);
}
const displayPotGeometry=new THREE.CylinderGeometry(.16,.13,.18,10);
const displaySoilGeometry=new THREE.CylinderGeometry(.135,.135,.018,12);
const displayStemGeometry=new THREE.CylinderGeometry(.012,.018,.25,7);
const displayPotMaterial=new THREE.MeshStandardMaterial({color:0x343d37,roughness:.72,metalness:.18});
const displaySoilMaterial=new THREE.MeshStandardMaterial({color:0x24170f,roughness:1});
const displayLeafMaterial=new THREE.MeshStandardMaterial({color:0x4f9d45,roughness:.78,side:THREE.DoubleSide});
const displayPlantMounts=displayPlantPlacements().map(config=>{
  const mount=new THREE.Group();mount.position.set(...config.position);mount.userData={decorativeDisplay:true,displayBank:config.bank,displayStage:config.stage,onchainPlotId:null};
  const pot=new THREE.Mesh(displayPotGeometry,displayPotMaterial);pot.position.y=.09;pot.castShadow=true;mount.add(pot);
  const soil=new THREE.Mesh(displaySoilGeometry,displaySoilMaterial);soil.position.y=.185;mount.add(soil);
  const stem=new THREE.Mesh(displayStemGeometry,displayLeafMaterial);stem.position.y=.31;mount.add(stem);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.055,.24,5),displayLeafMaterial);leaf.position.set(Math.cos(angle)*.08,.36,Math.sin(angle)*.08);leaf.rotation.z=Math.PI/2;leaf.rotation.y=angle;mount.add(leaf);}
  scene.add(mount);legacyWarehouseShell.push(mount);displayShelfRoots.push(mount);return{mount,config};
});
function refreshDisplayPlantStage(stage){const template=plantTemplates.get(stage);if(!template)return;for(const entry of displayPlantMounts.filter(item=>item.config.stage===stage)){entry.mount.clear();const plant=template.clone(true);plant.scale.setScalar(entry.config.scale);plant.userData.decorativeDisplay=true;entry.mount.add(plant);}}

// Eight grow stations: the original rear row plus four side stations that preserve the central aisle.
const benchFallback=[];
for(const station of WAREHOUSE_GROW_STATIONS){
  benchFallback.push(box([1.18,.12,.92],mats.wood,[station.x,.78,station.z]));
  for(const x of [station.x-.48,station.x+.48])for(const z of [station.z-.34,station.z+.34])benchFallback.push(box([.09,.78,.09],mats.metal,[x,.39,z]));
}
// A PointLight hung from the ceiling lights the whole room evenly, which is exactly why
// the warehouse read flat. A SpotLight at angle 0.62 with penumbra 0.55 drops a 1.478 m
// pool onto a 1.18 m bench and leaves the aisle dark. Only 4 slots exist and the 8
// stations sit within 5 m of each other, so they cannot be culled by distance: the four
// without a slot are carried by the ceiling panel emissive plus the mesh cone, which is
// geometry rather than light and therefore free of the shader-recompile problem.
let growRig=growLightRig(LIGHTING.growPreset);
const GROW_SHAFT_GEO=growShaftGeometry(growRig);
// The beam is a card that turns with the player, not a cylinder. A cylinder with a flat
// alpha shows the same density at the silhouette as at the axis, so it reads as a
// translucent triangle with a hard edge; the card carries the real optical profile (soft at
// the sides, denser near the panel) in the ALPHA of `map`. Not alphaMap: three samples
// alphaMap from the GREEN channel, so a ramp written into alpha comes out solid there.
// DataTexture also defaults to NearestFilter, which is what made the old 32-step ramp band.
const growShaftTex=new THREE.DataTexture(buildShaftAlpha(),GROW_SHAFT.width,GROW_SHAFT.height);
growShaftTex.magFilter=THREE.LinearFilter;growShaftTex.minFilter=THREE.LinearFilter;growShaftTex.generateMipmaps=false;growShaftTex.needsUpdate=true;
const growConeMesh=new THREE.BufferGeometry();
{const halfTop=GROW_SHAFT_GEO.topWidth/2,halfBottom=GROW_SHAFT_GEO.bottomWidth/2,halfHeight=GROW_SHAFT_GEO.height/2;
 growConeMesh.setAttribute('position',new THREE.Float32BufferAttribute([-halfTop,halfHeight,0, halfTop,halfHeight,0, halfBottom,-halfHeight,0, -halfBottom,-halfHeight,0],3));
 growConeMesh.setAttribute('uv',new THREE.Float32BufferAttribute([0,1, 1,1, 1,0, 0,0],2));
 growConeMesh.setIndex([0,2,1,0,3,2]);}
const growConeMat=new THREE.MeshBasicMaterial({color:growRig.color,map:growShaftTex,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
// The lit face of the fixture. It used to be a child of the fallback box, which the Meshy
// GLB hides the moment it loads -- so in the build everyone actually sees, the artefact the
// beam comes out of was dark. This one is its own object and does not depend on the fallback.
const growPanelMat=new THREE.MeshBasicMaterial({color:growRig.glassEmissive,toneMapped:false});
const growCones=[],growPanels=[];
const growStationPositions=[];
const growPool=[];for(let i=0;i<SPOT_BUDGET.slots;i++){const s=new THREE.SpotLight(growRig.color,0,growRig.distance,growRig.angle,growRig.penumbra,growRig.decay);s.position.set(SPOT_BUDGET.parkAt.x,SPOT_BUDGET.parkAt.y,SPOT_BUDGET.parkAt.z);s.target.position.set(SPOT_BUDGET.parkAt.x,SPOT_BUDGET.parkAt.y-1,SPOT_BUDGET.parkAt.z);scene.add(s);scene.add(s.target);growPool.push(s);}
let growSlots=null;
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
  const cone=new THREE.Mesh(growConeMesh,growConeMat); cone.position.set(x,GROW_SHAFT_GEO.centerY,z); cone.renderOrder=GROW_SHAFT.renderOrder; scene.add(cone); growCones.push(cone);
  const emitter=box([GROW_EMITTER.halfWidth*2,GROW_EMITTER.thickness,GROW_EMITTER.halfDepth*2],growPanelMat,[x,GROW_EMITTER.y,z]); growPanels.push(emitter);
  growStationPositions.push({x,z});
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

// Transparent artwork sits directly on the right warehouse wall: no frame, plate or support geometry.
const warehouseWallLogoTexture=new THREE.TextureLoader().load(ASSET_URLS.textures.warehouseWallLogo);
warehouseWallLogoTexture.colorSpace=THREE.SRGBColorSpace;
warehouseWallLogoTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const warehouseWallLogo=new THREE.Mesh(
  new THREE.PlaneGeometry(WAREHOUSE_DECOR.wallLogo.size[0],WAREHOUSE_DECOR.wallLogo.size[1]),
  new THREE.MeshBasicMaterial({map:warehouseWallLogoTexture,transparent:true,alphaTest:.02,depthWrite:false,toneMapped:false}),
);
warehouseWallLogo.position.set(...WAREHOUSE_DECOR.wallLogo.position);
warehouseWallLogo.rotation.y=WAREHOUSE_DECOR.wallLogo.rotationY;
warehouseWallLogo.renderOrder=2;
scene.add(warehouseWallLogo);
legacyWarehouseShell.push(warehouseWallLogo);
// K: el recinto propio del galpon. Todo lo de aca vive en legacyWarehouseShell (oculto desde la calle) y
// es una propiedad de runtime, asi que setGalpon(0) devuelve el cuarto de hoy exacto: piso en -.13 con
// mats.floor, sin placa y sin linea. La linea amarilla de circulacion es geometria de MUNDO, no textura:
// la del piso se repite 7x8 y una linea repetida ocho veces no es una linea.
const industrialFloorCanvas=document.createElement('canvas');industrialFloorCanvas.width=industrialFloorCanvas.height=INDUSTRIAL_FLOOR.size;paintIndustrialFloor(industrialFloorCanvas.getContext('2d'));
const industrialFloorTex=new THREE.CanvasTexture(industrialFloorCanvas);industrialFloorTex.colorSpace=THREE.SRGBColorSpace;industrialFloorTex.wrapS=industrialFloorTex.wrapT=THREE.RepeatWrapping;industrialFloorTex.repeat.set(INDUSTRIAL_FLOOR.repeat[0],INDUSTRIAL_FLOOR.repeat[1]);industrialFloorTex.anisotropy=4;
const industrialFloorMaterial=new THREE.MeshStandardMaterial({map:industrialFloorTex,roughness:INDUSTRIAL_FLOOR.roughness,metalness:INDUSTRIAL_FLOOR.metalness});
const apronMaterial=new THREE.MeshStandardMaterial({color:0x5c625e,roughness:.72,metalness:.22});
const stripeCanvas=document.createElement('canvas');stripeCanvas.width=256;stripeCanvas.height=16;{const c=stripeCanvas.getContext('2d');for(let i=0;i<16;i++){c.fillStyle=i%2?DOCK_APRON.stripe.colorA:DOCK_APRON.stripe.colorB;c.fillRect(i*16,0,16,16);}}
const stripeTex=new THREE.CanvasTexture(stripeCanvas);stripeTex.colorSpace=THREE.SRGBColorSpace;stripeTex.wrapS=THREE.RepeatWrapping;stripeTex.repeat.set(6,1);
const galponRamp=rampTransform();
const dockApron={plate:legacyWarehouseBox(DOCK_APRON.plate.size,apronMaterial,DOCK_APRON.plate.position,false),ramp:legacyWarehouseBox([DOCK_APRON.plate.size[0],DOCK_APRON.ramp.thickness,DOCK_APRON.ramp.length],apronMaterial,galponRamp.position,false),stripe:legacyWarehouseBox([DOCK_APRON.stripe.width,.004,DOCK_APRON.stripe.depth],new THREE.MeshStandardMaterial({map:stripeTex,roughness:.8}),[0,DOCK_APRON.stripe.y,DOCK_APRON.stripe.z],false)};
dockApron.ramp.rotation.x=galponRamp.rotationX;[dockApron.plate,dockApron.ramp,dockApron.stripe].forEach(m=>{m.castShadow=false;m.receiveShadow=true;m.visible=false;});
const galponLane=legacyWarehouseBox([INDUSTRIAL_FLOOR.laneWidth,.004,INDUSTRIAL_FLOOR.laneToZ-INDUSTRIAL_FLOOR.laneFromZ],new THREE.MeshStandardMaterial({color:INDUSTRIAL_FLOOR.laneColor,roughness:.85}),[0,.043,(INDUSTRIAL_FLOOR.laneFromZ+INDUSTRIAL_FLOOR.laneToZ)/2],false);galponLane.castShadow=false;galponLane.visible=false;
// galponColliders y galponInfraColliders se declaran ACA y no junto a collisionObstaclesByLocation:
// el bloque K corre al evaluar el modulo y les hace push, 480 lineas antes de esa linea. Declararlos
// alla tiraba `Cannot access before initialization` y el juego no arrancaba.
const galponFloorMarks=[galponLane],galponSkins=[],galponCeiling=[],galponInfra=[],galponAlive=[],galponWallMarks=[],galponColliders=[],galponInfraColliders=[];
// K77: chapa de contenedor en las cinco paredes de 4,2 m y un techo con estructura. Se eligen por ALTURA
// en runtime porque assetManifest.test.js fija el literal de la pared este y no se puede tocar.
const whWalls=legacyWarehouseShell.filter(m=>m.isMesh&&m.material===mats.wall&&m.geometry?.parameters?.height===4.2);
function galponCeilingBox(size,mat,pos){const m=legacyWarehouseBox(size,mat,pos,false);galponCeiling.push(m);return m;}
function galponCeilingMesh(geo,mat,pos){const m=mesh(geo,mat,pos);legacyWarehouseShell.push(m);galponCeiling.push(m);return m;}
const wallSkinCanvas=document.createElement('canvas');wallSkinCanvas.width=WALL_SKIN.size[0];wallSkinCanvas.height=WALL_SKIN.size[1];paintWallSkin(wallSkinCanvas.getContext('2d'));
const wallSkinBaseTex=new THREE.CanvasTexture(wallSkinCanvas);wallSkinBaseTex.colorSpace=THREE.SRGBColorSpace;wallSkinBaseTex.wrapS=wallSkinBaseTex.wrapT=THREE.RepeatWrapping;
// Un clon de textura por pared: la corrugacion tiene que medir lo mismo en una pared de 16 m que en una de 5,85.
const wallSkinMaterials=whWalls.map(wall=>{const p=wall.geometry.parameters;const map=wallSkinBaseTex.clone();map.needsUpdate=true;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(...wallSkinRepeat(Math.max(p.width,p.depth)));map.anisotropy=4;return new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:WALL_SKIN.bumpScale,roughness:WALL_SKIN.roughness,metalness:WALL_SKIN.metalness});});
galponSkins.push({apply(on){whWalls.forEach((w,i)=>w.material=on?wallSkinMaterials[i]:mats.wall);}});
// La banda pintada y el estarcido van como GEOMETRIA de mundo: la textura se repite 2,1 veces en vertical,
// asi que una banda "a 1,2 m" dentro del canvas apareceria dos veces y en ninguna de las dos a 1,2 m.
const wallBandMaterial=new THREE.MeshStandardMaterial({color:WALL_SKIN.band.color,roughness:.82,metalness:.08});
const wallBandY=WALL_SKIN.band.y,wallBandH=WALL_SKIN.band.height;
galponWallMarks.push(legacyWarehouseBox([13.74,wallBandH,.02],wallBandMaterial,[0,wallBandY,-7.86],false));
galponWallMarks.push(legacyWarehouseBox([.02,wallBandH,15.74],wallBandMaterial,[-6.86,wallBandY,0],false));
galponWallMarks.push(legacyWarehouseBox([.02,wallBandH,15.74],wallBandMaterial,[6.86,wallBandY,0],false));
galponWallMarks.push(legacyWarehouseBox([5.85,wallBandH,.02],wallBandMaterial,[-4.08,wallBandY,7.86],false));
galponWallMarks.push(legacyWarehouseBox([5.85,wallBandH,.02],wallBandMaterial,[4.08,wallBandY,7.86],false));
const stencilCanvas=document.createElement('canvas');stencilCanvas.width=512;stencilCanvas.height=128;{const c=stencilCanvas.getContext('2d');c.clearRect(0,0,512,128);c.fillStyle=WALL_SKIN.stencil.color;c.font='700 92px Impact, Haettenschweiler, "Arial Narrow", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(WALL_SKIN.stencil.text,256,70);}
const stencilTex=new THREE.CanvasTexture(stencilCanvas);stencilTex.colorSpace=THREE.SRGBColorSpace;
const stencilHeight=WALL_SKIN.stencil.scale*4.2;
galponWallMarks.push(legacyWarehouseBox([.02,stencilHeight,stencilHeight*4],new THREE.MeshStandardMaterial({map:stencilTex,transparent:true,roughness:.86}),[-6.855,WALL_SKIN.stencil.y*4.2,-8+WALL_SKIN.stencil.x*16],false));
galponWallMarks.forEach(m=>{m.castShadow=false;m.receiveShadow=true;m.visible=false;});
// Techo: chapa oscura con ranuras cada 30 cm en vez del plano negro de hoy.
const ceilingLegacyMaterial=ceiling.material;
const ceilingDeckCanvas=document.createElement('canvas');ceilingDeckCanvas.width=ceilingDeckCanvas.height=256;{const c=ceilingDeckCanvas.getContext('2d');c.fillStyle=CEILING_KIT.deck.color;c.fillRect(0,0,256,256);c.fillStyle=CEILING_KIT.deck.ribColor;for(let i=0;i<8;i++)c.fillRect(i*32,0,6,256);}
const ceilingDeckTex=new THREE.CanvasTexture(ceilingDeckCanvas);ceilingDeckTex.colorSpace=THREE.SRGBColorSpace;ceilingDeckTex.wrapS=ceilingDeckTex.wrapT=THREE.RepeatWrapping;ceilingDeckTex.repeat.set(6,7);
const ceilingDeckMaterial=new THREE.MeshStandardMaterial({map:ceilingDeckTex,roughness:CEILING_KIT.deck.roughness,metalness:CEILING_KIT.deck.metalness,emissive:new THREE.Color(CEILING_KIT.deck.emissive),emissiveIntensity:CEILING_KIT.deck.emissiveIntensity});
galponSkins.push({apply(on){ceiling.material=on?ceilingDeckMaterial:ceilingLegacyMaterial;}});
const ceilingSteelMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(CEILING_KIT.steel.color),emissive:new THREE.Color(CEILING_KIT.steel.emissive),emissiveIntensity:CEILING_KIT.steel.emissiveIntensity,roughness:CEILING_KIT.steel.roughness,metalness:CEILING_KIT.steel.metalness});
const airRunMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(CEILING_KIT.airRuns[0].color),emissive:new THREE.Color(CEILING_KIT.airRuns[0].emissive),emissiveIntensity:CEILING_KIT.airRuns[0].emissiveIntensity,roughness:.66,metalness:.24});
const cableTrayMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(CEILING_KIT.cableTrays[0].color),emissive:new THREE.Color(CEILING_KIT.cableTrays[0].emissive),emissiveIntensity:CEILING_KIT.cableTrays[0].emissiveIntensity,roughness:.78,metalness:.2});
const growPanelMaterial=new THREE.MeshStandardMaterial({color:0x9aa7b8,emissive:0x5d6b7c,emissiveIntensity:.35,roughness:.42});
for(const beam of CEILING_KIT.beams){galponCeilingBox(beam.size,ceilingSteelMaterial,[0,beam.y,beam.z]);galponCeilingBox(beam.flange,ceilingSteelMaterial,[0,beam.y-beam.size[1]/2-beam.flange[1]/2,beam.z]);}
for(const run of CEILING_KIT.airRuns){const duct=galponCeilingMesh(new THREE.CylinderGeometry(run.radius,run.radius,run.length,10),airRunMaterial,[run.x,run.y,0]);duct.rotation.x=Math.PI/2;for(const z of run.diffusersAtZ)galponCeilingBox(CEILING_KIT.diffuser.size,ceilingSteelMaterial,[run.x,run.y-run.radius-CEILING_KIT.diffuser.drop/2,z]);}
for(const tray of CEILING_KIT.cableTrays)galponCeilingBox(tray.size,cableTrayMaterial,[tray.x,tray.y,tray.z]);
for(const panel of CEILING_KIT.panels.filter(p=>!p.existing))galponCeilingBox(CEILING_KIT.panelSize,panel.zone==='hall'?ceilingPanelMaterial:growPanelMaterial,[panel.x,CEILING_KIT.panelY,panel.z]);
// K78: la infraestructura que hace que el cuarto se lea como un lugar donde se trabaja. La tabla
// entera vive en warehouseInfraState.js -- posiciones, colores, sombras -- y aca solo se construye.
const controllerScreenCanvas=document.createElement('canvas');controllerScreenCanvas.width=CONTROLLER_SCREEN.size[0];controllerScreenCanvas.height=CONTROLLER_SCREEN.size[1];paintControllerScreen(controllerScreenCanvas.getContext('2d'));
const controllerScreenTex=new THREE.CanvasTexture(controllerScreenCanvas);controllerScreenTex.colorSpace=THREE.SRGBColorSpace;
const controllerScreenMaterial=new THREE.MeshStandardMaterial({map:controllerScreenTex,emissiveMap:controllerScreenTex,emissive:new THREE.Color(CONTROLLER_SCREEN.ink),emissiveIntensity:1.6,roughness:.6});
const signageCanvas=document.createElement('canvas');signageCanvas.width=1024;signageCanvas.height=128;paintSignage(signageCanvas.getContext('2d'));
const signageTex=new THREE.CanvasTexture(signageCanvas);signageTex.colorSpace=THREE.SRGBColorSpace;
INFRA_PROPS.forEach(prop=>{const material=new THREE.MeshStandardMaterial({color:new THREE.Color(prop.colors[0]),roughness:prop.roughness,metalness:prop.metalness});if(prop.emissives.length){material.emissive=new THREE.Color(prop.emissives[0]);material.emissiveIntensity=prop.emissiveIntensity??1;}if(prop.id==='signage'){material.map=signageTex;material.emissiveMap=signageTex;}prop.placements.forEach(placement=>{const geo=placement.geometry??prop.geometry;const item=geo.shape==='box'?galponInfraBox(geo.size,material,placement.position):galponMesh(galponGeo(geo),material,placement.position);if(placement.rotation)item.rotation.set(...placement.rotation);if(geo.anchor==='base')item.position.y+=geo.height/2;if(prop.castShadow)item.userData.galponCasts=true;});});
galponInfraBox([.42,.3,.02],controllerScreenMaterial,[-1,1.56,-7.72]);
galponInfraColliders.push(...INFRA_COLLIDERS);
// K79: el contraste termico del hall y el agua/aire visibles. Las campanas NO van en galponCeiling
// (que ya esta encendido en el preset 1): van en galponAlive con la misma llave que el charco, porque
// el hall calido contra el cultivo magenta es justo lo que estrena el preset 2.
const campanaBellMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(CAMPANA.bell.color),roughness:CAMPANA.bell.roughness,metalness:CAMPANA.bell.metalness});
const campanaDiscMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(CAMPANA.disc.color),toneMapped:false});
const campanaRodMaterial=new THREE.MeshStandardMaterial({color:0x3a423c,roughness:.7,metalness:.24});
CAMPANA.positions.forEach(([x,z])=>{
  const bell=galponMesh(new THREE.CylinderGeometry(CAMPANA.bell.radiusTop,CAMPANA.bell.radiusBottom,CAMPANA.bell.height,16),campanaBellMaterial,[x,CAMPANA.hangY-CAMPANA.bell.height/2,z]);
  const disc=galponMesh(new THREE.CircleGeometry(CAMPANA.disc.radius,20),campanaDiscMaterial,[x,CAMPANA.hangY-CAMPANA.bell.height-.004,z]);disc.rotation.x=Math.PI/2;
  const rod=galponMesh(new THREE.CylinderGeometry(.022,.022,.05,8),campanaRodMaterial,[x,CAMPANA.hangY+.02,z]);
  [bell,disc,rod].forEach(m=>{galponInfra.pop();m.userData.galponKey='pools';m.castShadow=false;m.visible=false;galponAlive.push(m);});
});
const campanaPoolTex=new THREE.DataTexture(buildRadialAlphaPixels({...CONTACT_SHADOW,rgb:CAMPANA.pool.rgb,peakAlpha:CAMPANA.pool.peakAlpha}),CONTACT_SHADOW.size,CONTACT_SHADOW.size);campanaPoolTex.colorSpace=THREE.SRGBColorSpace;campanaPoolTex.needsUpdate=true;
const campanaPools=new THREE.InstancedMesh(new THREE.CircleGeometry(CAMPANA.pool.radius,20),new THREE.MeshBasicMaterial({map:campanaPoolTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),CAMPANA.positions.length);
campanaPools.renderOrder=2;campanaPools.frustumCulled=false;campanaPools.userData.galponKey='pools';campanaPools.visible=false;
{const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),p=new THREE.Vector3(),s=new THREE.Vector3(1,1,1);campanaPoolMatrices().forEach((pool,i)=>{p.set(pool.x,pool.y,pool.z);campanaPools.setMatrixAt(i,m.compose(p,q,s));});campanaPools.instanceMatrix.needsUpdate=true;}
scene.add(campanaPools);legacyWarehouseShell.push(campanaPools);galponAlive.push(campanaPools);
const irrigationRailsCache=irrigationRails();
const mistGeometry=new THREE.BufferGeometry();mistGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MIST.count*3),3));
const mistTex=new THREE.DataTexture(buildRadialAlphaPixels({...CONTACT_SHADOW,rgb:[255,255,255],peakAlpha:255}),CONTACT_SHADOW.size,CONTACT_SHADOW.size);mistTex.needsUpdate=true;
// sin mapa, PointsMaterial dibuja CUADRADOS duros: 96 cuadraditos blancos se leen como basura, no
// como agua. El alfa radial que A usa para los charcos los convierte en gotas.
const mistPoints=new THREE.Points(mistGeometry,new THREE.PointsMaterial({color:0xffffff,map:mistTex,size:MIST.size,transparent:true,opacity:MIST.opacity,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
mistPoints.frustumCulled=false;mistPoints.userData.galponKey='mist';mistPoints.visible=false;scene.add(mistPoints);legacyWarehouseShell.push(mistPoints);galponAlive.push(mistPoints);
galponInfra.forEach(m=>{if(!m.userData.galponCasts)m.castShadow=false;m.receiveShadow=true;});galponInfra.forEach(m=>m.visible=false);
galponCeiling.forEach(m=>{m.castShadow=false;m.receiveShadow=true;});galponCeiling.forEach(m=>m.visible=false);
function applyGalpon(preset){GALPON=preset;whFloor.position.y=preset.raisedFloor?FLOOR_SLAB.raisedY:FLOOR_SLAB.legacyY;whFloor.material=preset.raisedFloor?industrialFloorMaterial:mats.floor;vendorDecal.position.y=preset.raisedFloor?.052:.012;const shellOn=warehouseVisibilityForLocation(state?.location).legacyInterior;[dockApron.plate,dockApron.ramp,dockApron.stripe].forEach(m=>m.visible=preset.apron&&shellOn);galponFloorMarks.forEach(m=>m.visible=preset.raisedFloor&&shellOn);galponSkins.forEach(s=>s.apply(preset.skins));galponWallMarks.forEach(m=>m.visible=preset.skins&&shellOn);galponCeiling.forEach(m=>m.visible=preset.ceiling&&shellOn);galponInfra.forEach(m=>m.visible=preset.infra&&shellOn);galponAlive.forEach(m=>m.visible=(preset.pools||preset.mist||preset.led)&&shellOn&&(m.userData.galponKey?preset[m.userData.galponKey]:true));warehouseExpansionObjects.forEach(seatOnApron);positionCabins();galponColliders.length=0;if(preset.infra)galponColliders.push(...galponInfraColliders);rebuildWarehouseColliders();escapeGalponColliders();}
function seatOnApron(instance){if(instance.userData.qaLabel==='hydroponic tower')instance.position.y=GALPON.apron?DOCK_APRON.plate.position[1]+DOCK_APRON.plate.size[1]/2:0;}
function galponMesh(geo,mat,pos){const m=mesh(geo,mat,pos);legacyWarehouseShell.push(m);galponInfra.push(m);return m;}
// La perilla enciende colliders en caliente: si el jugador esta parado donde aparece una caja nueva,
// moveCircle rechaza todos los candidatos y el paso de un frame (8,5 cm) no lo saca. Queda atrapado.
function escapeGalponColliders(){if(state?.location!=='warehouse')return;const spot=nearestFreeSpot({x:camera.position.x,z:camera.position.z},collisionObstaclesByLocation.warehouse,boundsForLocation('warehouse'),portalFor('warehouse-entrance').spawn);if(spot.moved){camera.position.x=spot.x;camera.position.z=spot.z;}}
function galponInfraBox(size,mat,pos){const m=legacyWarehouseBox(size,mat,pos,false);galponInfra.push(m);return m;}
function stepMist(now){const phase=mistPhase(now);mistPoints.visible=GALPON.mist&&phase!==null&&warehouseVisibilityForLocation(state.location).legacyInterior;if(!mistPoints.visible)return;const rail=irrigationRailsCache[0];const a=mistPoints.geometry.attributes.position;for(let i=0;i<MIST.count;i++){const p=mistPoint(i,phase,rail);a.setXYZ(i,p.x,p.y,p.z);}a.needsUpdate=true;}
function galponGeo(g){return g.shape==='cylinder'?new THREE.CylinderGeometry(g.radius,g.radius,g.height,g.segments??10):g.shape==='torus'?new THREE.TorusGeometry(g.radius,g.tube,8,20):new THREE.BoxGeometry(...g.size);}

function normalizeAsset(model,targetHeight){const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetHeight/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>material.side=THREE.DoubleSide);}});const wrapper=new THREE.Group();wrapper.add(model);return wrapper;}
devLog.info('Stockdealer · rectilinear warehouse shell retained after V3 wall QA');
new GLTFLoader().load(ASSET_URLS.warehouse.growBench,gltf=>{const template=normalizeAsset(gltf.scene,.84);for(const station of WAREHOUSE_GROW_STATIONS){const bench=template.clone(true);bench.scale.x=.62;bench.position.set(station.x,0,station.z);scene.add(bench);}benchFallback.forEach(item=>item.visible=false);devLog.info('Stockdealer · eight Meshy V3 grow tables aligned with pots');},undefined,error=>console.warn('Stockdealer · grow bench fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.shelf,gltf=>{const shelf=normalizeAsset(gltf.scene,2.35);shelf.position.set(-4.9,0,-5.9);scene.add(shelf);shelfFallback.forEach(item=>item.visible=false);devLog.info('Stockdealer · Meshy V3 shelf loaded');},undefined,error=>console.warn('Stockdealer · shelf fallback',error));
new GLTFLoader().load(ASSET_URLS.warehouse.growLight,gltf=>{const template=normalizeAsset(gltf.scene,.9);for(const station of WAREHOUSE_GROW_STATIONS){const fixture=template.clone(true);fixture.position.set(station.x,3.08,station.z);scene.add(fixture);}lightFixtureFallback.forEach(item=>item.visible=false);devLog.info('Stockdealer · eight suspended Meshy V3 grow lights loaded');},undefined,error=>console.warn('Stockdealer · grow light fallback',error));
const loadingDoorPosition={x:0,z:7.82};
const loadingDoorTravel=2.7;
let loadingDoorLeaf=null;
let loadingDoorOpen=0;
function loadLoadingDoorPart(url,label,isLeaf=false){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const scale=3.25/1.0003;model.scale.setScalar(scale);model.position.set(-.00098*scale,.5*scale,0);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(material=>{if(material.map){material.emissiveMap=material.map;material.emissive?.setScalar(.42);material.emissiveIntensity=.42;}material.roughness=.62;});}});const part=new THREE.Group();part.add(model);part.position.set(loadingDoorPosition.x,0,loadingDoorPosition.z);scene.add(part);legacyWarehouseShell.push(part);part.visible=warehouseVisibilityForLocation(state?.location).legacyInterior;if(isLeaf)loadingDoorLeaf=part;devLog.info(`Stockdealer · Meshy V8 automatic loading door ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · loading door ${label} fallback`,error));}
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorFrame,'frame');
loadLoadingDoorPart(ASSET_URLS.warehouse.loadingDoorLeaf,'leaf',true);
function normalizeLargest(model,targetSize,alignTop=false){const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetSize/Math.max(size.x,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,(alignTop?-bounds.max.y:-bounds.min.y)*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const wrapper=new THREE.Group();wrapper.add(model);return wrapper;}
const warehouseExpansionObjects=[];
function loadWarehouseProp(url,placements,label,mode='height',after=null){
  const list=Array.isArray(placements)?placements:[placements];
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url,gltf=>{
    const first=list[0];
    const template=mode==='largest'?normalizeLargest(gltf.scene,first.targetSize,true):normalizeAsset(gltf.scene,first.targetHeight);
    const instances=list.map((placement,index)=>{
      const instance=index===0?template:template.clone(true);
      instance.position.set(...placement.position);instance.rotation.y=placement.rotationY??0;instance.userData.qaLabel=label;
      instance.visible=warehouseVisibilityForLocation(state?.location).legacyInterior;scene.add(instance);warehouseExpansionObjects.push(instance);seatOnApron(instance);return instance;
    });
    instances.forEach(instance=>registerLaw(instance,url));
    after?.(instances);
    devLog.info(`Stockdealer · Meshy warehouse ${label} loaded ×${list.length}`);
  },undefined,error=>console.warn(`Stockdealer · warehouse ${label} omitted`,error));
}
// Tarea 35a (paquete E): los dos extractores dejan de estar clavados, detras de la perilla fina `fanSpin`.
// El GLB no trae animacion (animations 0, skins 0) PERO si trae las aspas modeladas, y es UNA sola malla
// de 11.619 triangulos fusionada (union-find: 2 componentes, 11.579 + 40): no hay nodo que rotar ni forma
// limpia de recortarlas. Un rotor suelto delante de la rejilla se fotografio y se ven OCHO aspas. Por eso
// el rotor lleva tapa: un disco opaco que esconde las del modelo, y las moviles delante de esa tapa.
// El rotor se cuelga del WRAPPER del prop, asi hereda posicion, giro y la visibilidad que refresh() le da
// al galpon, y su +Z local ya mira a la sala en los dos ventiladores.
// Coste: 1 geometria y 1 material compartidos, 2 mallas = 2 draw calls y 96 triangulos, y solo con ?fx>0.
const fanRotors=[];
const fanRotorMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.46,metalness:.5,side:THREE.DoubleSide});
function buildFanRotor(){
  const position=[],color=[];
  const plate=new THREE.Color(GROW.FAN_PLATE_COLOR),blade=new THREE.Color(GROW.FAN_BLADE_COLOR),hub=new THREE.Color(GROW.FAN_HUB_COLOR);
  const push=(point,tone)=>{position.push(point[0],point[1],point[2]);color.push(tone.r,tone.g,tone.b);};
  const disc=(radius,depth,segments,tone)=>{for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;push([0,0,depth],tone);push([Math.cos(a)*radius,Math.sin(a)*radius,depth],tone);push([Math.cos(b)*radius,Math.sin(b)*radius,depth],tone);}};
  disc(GROW.FAN_PLATE_RADIUS,GROW.FAN_PLATE_DEPTH,28,plate);
  for(let i=0;i<GROW.FAN_BLADES;i++){const quad=GROW.fanBladeQuad(i);push(quad[0],blade);push(quad[1],blade);push(quad[2],blade);push(quad[0],blade);push(quad[2],blade);push(quad[3],blade);}
  disc(GROW.FAN_HUB_RADIUS*1.35,GROW.FAN_BLADE_DEPTH+.014,12,hub);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(position),3));
  geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(color),3));
  geometry.computeVertexNormals();
  return geometry;
}
// Corre DESPUES de registerLaw: el rotor es geometria de codigo y queda fuera de ?ley, como el banco,
// las plantas y los cogollos.
function attachFanRotors(instances){
  const fanRotorGeometry=buildFanRotor();
  for(const instance of instances){
    const rotor=new THREE.Mesh(fanRotorGeometry,fanRotorMaterial);
    rotor.position.set(0,GROW.FAN_ROTOR_LIFT,0);
    rotor.visible=false;rotor.userData.qaLabel='exhaust fan rotor';
    instance.add(rotor);fanRotors.push(rotor);
  }
}
// ?fx=0 deja el rotor sin dibujar y el ventilador es el GLB de hoy, intacto.
function stepFanRotors(dt){
  const spin=1;
  for(const rotor of fanRotors){rotor.visible=spin>0;if(spin>0)rotor.rotation.z=GROW.fanAngle(rotor.rotation.z,dt,spin);}
}
// ── T35b: motas de polvo en los conos de luz, SOLO en ?fx=2 ────────────────
// La otra mitad de la Tarea 35. 13 motas lima por estacion x 8 = 104 puntos en UN THREE.Points (una
// geometria, un material, un draw call), en espiral conica dentro del haz dibujado de cada lampara
// (GROW.dustMotePosition, con la doctrina en growthAnimation.js). Reusa mistTex, el sprite radial de la
// neblina: sin mapa, PointsMaterial dibuja cuadrados duros.
// APAGADO en el envio (?fx=1): el galpon ya tiene la neblina (MIST, 260 puntos cada 9 s) en el mismo
// volumen (VERIFICACION 2026-09-14 §3 fila 9, §5.2). Entra solo en ?fx=2 para que Jose lo compare jugando
// contra ?galpon=1 (polvo solo) / ?fx=1&galpon=2 (neblina sola) / ?fx=2&galpon=2 (las dos) y decida.
// No cuelga de galponAlive ni de legacyWarehouseShell: la visibilidad la decide stepDustMotes cada frame,
// como stepMist, y con la perilla en 0 la malla queda oculta = cero draw calls, hoy bit a bit.
const dustCount=GROW.DUST_PER_STATION*WAREHOUSE_GROW_STATIONS.length;
const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(dustCount*3),3));dustGeometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(dustCount*3),3));
const dustMaterial=new THREE.PointsMaterial({color:GROW.DUST_COLOR,map:mistTex,size:GROW.DUST_SIZE,transparent:true,opacity:GROW.DUST_OPACITY,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
const dustPoints=new THREE.Points(dustGeometry,dustMaterial);dustPoints.frustumCulled=false;dustPoints.visible=false;dustPoints.userData.qaLabel='grow-light dust';scene.add(dustPoints);
// ?fx=0 y ?fx=1 dejan la malla oculta y el paso se va en la primera linea. La perilla escala la opacidad
// (techo 1) y el bamboleo (dentro del modulo), nunca la subida ni el giro.
function stepDustMotes(now){
  const dust=0;dustPoints.visible=dust>0&&warehouseVisibilityForLocation(state.location).legacyInterior;if(!dustPoints.visible)return;
  const t=now*.001,position=dustGeometry.attributes.position,color=dustGeometry.attributes.color;dustMaterial.opacity=Math.min(1,GROW.DUST_OPACITY*dust);
  WAREHOUSE_GROW_STATIONS.forEach((station,s)=>{for(let i=0;i<GROW.DUST_PER_STATION;i++){const k=s*GROW.DUST_PER_STATION+i;const mote=GROW.dustMotePosition(k,t,station,dust);const glow=GROW.dustMoteGlow(k,t);position.setXYZ(k,mote.x,mote.y,mote.z);color.setXYZ(k,glow,glow,glow);}});
  position.needsUpdate=true;color.needsUpdate=true;
}
loadWarehouseProp(ASSET_URLS.warehouse.soilPallet,WAREHOUSE_DECOR.soilPallet,'soil pallet');
loadWarehouseProp(ASSET_URLS.warehouse.airConditioner,WAREHOUSE_DECOR.airConditioner,'wall air conditioner');
loadWarehouseProp(ASSET_URLS.warehouse.exhaustFan,WAREHOUSE_DECOR.fans,'exhaust fan','height',attachFanRotors);
loadWarehouseProp(ASSET_URLS.warehouse.recyclingBin,WAREHOUSE_DECOR.recyclingBin,'recycling bin');
loadWarehouseProp(ASSET_URLS.warehouse.hydroponicTower,WAREHOUSE_DECOR.hydroponicTower,'hydroponic tower');
// Road, curb and grass are built once, so a preset that only moves lights can never take
// them back: applyLighting re-colours these four materials on every switch.
// El suelo era COLOR PLANO y el pasto cubre 30.240 m2 en cuatro parches de ~100x75: sin textura, el
// juego se lee como una alfombra verde con casas encima. Las pinturas van en gris alrededor de 1,0 y
// cada material CONSERVA su `color`, que es el que `applyLighting` re-tine por preset: el grano entra
// sin mover un tono de la paleta del paquete A.
const groundTextures={};
for(const [key,painter] of Object.entries(GROUND_PAINTERS)){const canvas=document.createElement('canvas');canvas.width=GROUND_TEXTURE_SIZE;canvas.height=GROUND_TEXTURE_SIZE;painter(canvas.getContext('2d'),GROUND_TEXTURE_SIZE);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;groundTextures[key]=texture;}
// La repeticion va en METROS de mundo, no en veces: un parche de 100 m y uno de 5 m tienen que mostrar
// la misma mata. Como cada `box` trae su propia BufferGeometry, se escalan sus UV.
function groundUv(target,width,depth,metres){const uv=target.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/metres,uv.getY(i)*depth/metres);uv.needsUpdate=true;return target;}
const roadMaterial=new THREE.MeshStandardMaterial({color:LIGHTING.road,map:groundTextures.road,bumpMap:groundTextures.road,bumpScale:1.4,roughness:.98});
const curbMaterial=new THREE.MeshStandardMaterial({color:LIGHTING.curb,map:groundTextures.curb,bumpMap:groundTextures.curb,bumpScale:1.8,roughness:1});
// El cordon usa la MISMA textura que la vereda y un tono 18 % mas claro, sacado del propio color
// del preset en `applyLighting`. Asi no hace falta una clave nueva en las dos paletas ni en los
// tres presets de luz, y el cordon acompana cualquier preset futuro solo.
const kerbMaterial=new THREE.MeshStandardMaterial({color:LIGHTING.curb,map:groundTextures.curb,bumpMap:groundTextures.curb,bumpScale:2.2,roughness:1});
const grassMaterials=[
  new THREE.MeshStandardMaterial({color:LIGHTING.grassA,map:groundTextures.grass,bumpMap:groundTextures.grass,bumpScale:2.4,roughness:1}),
  new THREE.MeshStandardMaterial({color:LIGHTING.grassB,map:groundTextures.grass,bumpMap:groundTextures.grass,bumpScale:2.4,roughness:1}),
];
STREET_LAYOUT.grass.forEach((patch,index)=>groundUv(box([patch.width,.08,patch.depth],grassMaterials[index%grassMaterials.length],[patch.x,-.01,patch.z],false),patch.width,patch.depth,GROUND_REPEAT.grass));
groundUv(box([8.4,.08,104],roadMaterial,[0,-.02,58],false),8.4,104,GROUND_REPEAT.road);
for(const x of [-5.1,5.1]){
  groundUv(box([1.8,.16,24.4],curbMaterial,[x,.04,18.2],false),1.8,24.4,GROUND_REPEAT.curb);
  groundUv(box([1.8,.16,72.4],curbMaterial,[x,.04,73.8],false),1.8,72.4,GROUND_REPEAT.curb);
}
const streetIntersection=groundUv(box([STREET_LAYOUT.crossStreet.width,.08,STREET_LAYOUT.crossStreet.depth],roadMaterial,[STREET_LAYOUT.crossStreet.x,-.015,STREET_LAYOUT.crossStreet.z],false),STREET_LAYOUT.crossStreet.width,STREET_LAYOUT.crossStreet.depth,GROUND_REPEAT.road);
STREET_LAYOUT.crossCurbs.forEach(curb=>groundUv(box([curb.width,.16,curb.depth],curbMaterial,[curb.x,.04,curb.z],false),curb.width,curb.depth,GROUND_REPEAT.curb));
const laneMaterial=new THREE.MeshStandardMaterial({color:0xd7d3b2,roughness:.9});
const laneDashes=[];for(const z of [9,17,21,25,29,39,43,47,51,55,59,63,67,71,75,79,83,87,91,95,99,103,107])laneDashes.push(box([.1,.012,2.1],laneMaterial,[0,.03,z],false));
for(const x of [-49,-45,-41,-37,-33,-29,-25,-21,-17,-13,-9,-5,5,9,13,17,21,25,29,33,37,41,45,49])laneDashes.push(box([2.1,.012,.1],laneMaterial,[x,.03,STREET_LAYOUT.intersectionZ],false));
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
new GLTFLoader().load(ASSET_URLS.city.house,gltf=>{const building=normalizeAsset(gltf.scene,5.8);building.rotation.y=-Math.PI/2;building.position.set(houseLayout.positionX,houseLayout.positionY,houseLayout.positionZ);scene.add(building);devLog.info('Stockdealer · complete one-piece cute Meshy V5 house loaded');},undefined,error=>console.warn('Stockdealer · V5 house omitted',error));

// Meshy V9 street-life layer. Repeated objects share one downloaded template.
const streetActors={};
const streetMixers=[];
let househeadMixer=null;
let foxWalkerMixer=null;
let neonCatWalkerMixer=null;
function tuneNightMaterials(root,intensity=LIGHTING.streetEmissive){root.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(material=>{const tuned=material.clone();if(tuned.map&&tuned.emissive){tuned.emissiveMap=tuned.map;tuned.emissive.set(0xffffff);tuned.emissiveIntensity=intensity;nightTunedMaterials.push(tuned);}tuned.roughness=Math.max(.48,tuned.roughness??.75);return tuned;});if(object.material.length===1)object.material=object.material[0];});}
const streetAssetLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function loadStreetSet(url,height,placements,label,onPlace){streetAssetLoader.load(url,gltf=>{const fitted=placements[0]?.maxWidthX?fitScaleForWorldBox(new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()),{maxWidthX:placements[0].maxWidthX,maxDepthZ:placements[0].maxDepthZ,maxHeight:placements[0].height},placements[0].rotationY??0):null;const template=normalizeAsset(gltf.scene,fitted?new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y*fitted:height);tuneNightMaterials(template);const instances=placements.map((placement,index)=>{const instance=index===0?template:template.clone(true);instance.position.set(placement.x,placement.groundY??placement.y??.08,placement.z);instance.rotation.y=placement.rotationY??0;instance.userData.streetAsset=placement.asset??label;scene.add(instance);onPlace?.(instance,placement,index,gltf.animations);return instance;});instances.forEach(instance=>registerLaw(instance,url));devLog.info(`Stockdealer · Meshy street asset ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · street asset ${label} omitted`,error));}
function loadCenteredFittedAsset(url,placement,label,onLoad){const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);loader.load(url,gltf=>{const model=gltf.scene;tuneNightMaterials(model);const rawBounds=new THREE.Box3().setFromObject(model);const rawSize=rawBounds.getSize(new THREE.Vector3());const rawCenter=rawBounds.getCenter(new THREE.Vector3());const scale=fitScaleForWorldBox(rawSize,{maxWidthX:placement.maxWidthX,maxDepthZ:placement.maxDepthZ,maxHeight:placement.height},placement.rotationY??0);model.scale.setScalar(scale);model.position.set(-rawCenter.x*scale,-rawBounds.min.y*scale,-rawCenter.z*scale);const wrapper=new THREE.Group();wrapper.position.set(placement.x,placement.groundY??0,placement.z);wrapper.rotation.y=placement.rotationY??0;wrapper.scale.x*=placement.scaleX??1;wrapper.scale.y*=placement.scaleY??1;wrapper.scale.z*=placement.scaleZ??1;wrapper.add(model);wrapper.userData.streetAsset=placement.asset??label;scene.add(wrapper);onLoad?.(wrapper);registerLaw(wrapper,url);devLog.info(`Stockdealer · ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · ${label} omitted`,error));}
const lightFixturesBase=buildFixtureTable({lamps:STREET_LAYOUT.lamps,restaurant:STREET_LAYOUT.restaurant,houseZ:houseLayout.positionZ}).concat(EXTRA_LIGHT_FIXTURES);
let lightFixtures=tuneFixtures(lightFixturesBase,LIGHTING);const lightPool=[];for(let i=0;i<POINT_BUDGET.slots;i++){const l=new THREE.PointLight(0xffc66d,0,13,1.7);l.position.set(POINT_BUDGET.parkAt.x,POINT_BUDGET.parkAt.y,POINT_BUDGET.parkAt.z);scene.add(l);lightPool.push(l);}let lightSlots=null,lightSlotsAt=-1e9,lightPlacement=budgetPlacement(new Array(POINT_BUDGET.slots).fill(null),'street',lightFixtures);
// Six real slots against 18 lamp posts means twelve lamps are dark at any moment.
// Each post gets a painted pool so it still reads as lit; the pool dims when that post
// actually receives a slot, so the light is not counted twice. One InstancedMesh, one
// draw call. Additive + depthWrite:false, otherwise a translucent orange circle on dark
// asphalt reads as a paint stain rather than as light.
// J68: hacer VISIBLE el limite que la Tarea 67 puso como colision. Un muro invisible mejor puesto sigue
// siendo un muro invisible. 99 paneles en 3 draw calls (un InstancedMesh por estilo, no un clon por panel:
// loadStreetSet clona el template por placement y three no fusiona clones) y 46 siluetas en 1 mas.
// Ni una PointLight nueva: ya hay 40 en la escena y las farolas se llevan casi la mitad.
function instancedFromPlacements(geometry,material,placements,apply){const instanced=new THREE.InstancedMesh(geometry,material,placements.length);instanced.castShadow=true;instanced.receiveShadow=true;const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),euler=new THREE.Euler();placements.forEach((placement,index)=>{position.set(0,0,0);euler.set(0,0,0);scale.set(1,1,1);apply(placement,position,euler,scale);quaternion.setFromEuler(euler);matrix.compose(position,quaternion,scale);instanced.setMatrixAt(index,matrix);});instanced.instanceMatrix.needsUpdate=true;scene.add(instanced);return instanced;}
function wallPanelGeometry(style){if(!style.post){const solid=new THREE.BoxGeometry(style.length,style.height,style.thickness);solid.translate(0,style.height/2,0);return solid;}const slab=new THREE.BoxGeometry(style.length,style.height*.88,style.thickness);slab.translate(0,style.height*.56,0);const parts=[slab];for(const x of [-style.length/2+style.post/2,style.length/2-style.post/2]){const post=new THREE.BoxGeometry(style.post,style.height,style.post);post.translate(x,style.height/2,0);parts.push(post);}return mergeCityGeometries(parts);}
const cityWallPanels=wallPanels();
// Dos materiales por estilo: el de hoy (color plano) y el pintado, para que ?muro los conmute en
// caliente sin recargar. El emisivo viaja por `emissiveMap` -- la misma textura -- asi que el
// rebote sigue los tablones y las juntas en vez de aplanar el muro en una losa.
const cityWallPainters={plank:paintPartyWall,brick:paintSiteWall,hoarding:paintHoarding},cityWallSkins={};
// `emissiveIntensity` en WALL_SKINS es la radiancia MEDIA que se resolvio contra la luz del preset;
// el shader la multiplica ademas por el texel del emissiveMap, asi que se divide por la media real
// del canvas y el numero del modulo sigue significando lo que dice aunque se repinte la textura.
function cityWallTexture(canvas,style,skin){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(...cityWallSkinRepeat(style.length,skin));texture.anisotropy=4;return texture;}
function cityWallPaint(styleName,skin){const canvas=document.createElement('canvas');canvas.width=skin.size[0];canvas.height=skin.size[1];cityWallPainters[styleName](canvas.getContext('2d'),skin);return canvas;}
function cityWallMean(canvas){const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const toLinear=channel=>{const value=channel/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);};let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=.2126*toLinear(pixels[i])+.7152*toLinear(pixels[i+1])+.0722*toLinear(pixels[i+2]);return Math.max(.05,sum/(pixels.length/4));}
for(const styleName of ['plank','brick','hoarding']){const style=WALL_STYLE[styleName];const subset=cityWallPanels.filter(panel=>panel.style===styleName);if(!subset.length)continue;const skin=WALL_SKINS[styleName];const skinMap=cityWallTexture(cityWallPaint(styleName,skin),style,skin);const liftCanvas=cityWallPaint(styleName,WALL_LIFT_SKINS[styleName]);const liftMap=cityWallTexture(liftCanvas,style,skin);const lift=skin.emissiveIntensity/cityWallMean(liftCanvas);const legacy=new THREE.MeshStandardMaterial({color:style.color,roughness:style.roughness});const skinned=new THREE.MeshStandardMaterial({map:skinMap,emissiveMap:liftMap,emissive:new THREE.Color(skin.emissive),emissiveIntensity:lift,bumpMap:skinMap,bumpScale:skin.bumpScale,roughness:skin.roughness,metalness:skin.metalness});const instanced=instancedFromPlacements(wallPanelGeometry(style),legacy,subset,(panel,position,euler,scale)=>{position.set(panel.x,0,panel.z);euler.set(0,panel.rotationY,0);scale.set(panel.lengthScale,1,1);});instanced.name='city-wall-'+styleName;cityWallSkins[styleName]={instanced,legacy,skinned,lift};}
const citySkylineLegacy=new THREE.MeshStandardMaterial({color:0x14181a,roughness:1}),citySkylineHaze=new THREE.MeshStandardMaterial({color:SKYLINE_KIT.color,roughness:SKYLINE_KIT.roughness,metalness:SKYLINE_KIT.metalness,emissive:new THREE.Color(SKYLINE_KIT.emissive),emissiveIntensity:SKYLINE_KIT.emissiveIntensity});
const citySkylineMesh=instancedFromPlacements(new THREE.BoxGeometry(1,1,1),citySkylineLegacy,citySkylineBlocks(),(block,position,euler,scale)=>{position.set(block.x,block.height/2,block.z);euler.set(0,block.rotationY,0);scale.set(block.width,block.height,block.depth);});
// Una torre de 30 m dentro del extent 45 del shadow map de la luna tira una banda negra sobre media
// cuadra; el muro de 1,9 m si tiene que proyectar. Por eso la sombra se apaga aca y no en el helper.
citySkylineMesh.castShadow=false;citySkylineMesh.name='city-skyline';
// Las ventanas son planos con MeshBasicMaterial: su color ES su radiancia y `instanceColor` la varia
// por ventana sin un draw call mas. Un `emissive` no podria variar: es del material, no de la instancia.
const cityWindowPlacements=skylineWindows(),cityWindowMesh=instancedFromPlacements(new THREE.PlaneGeometry(SKYLINE_KIT.windows.size[0],SKYLINE_KIT.windows.size[1]),new THREE.MeshBasicMaterial({color:0xffffff}),cityWindowPlacements,(win,position,euler)=>{position.set(win.x,win.y,win.z);euler.set(0,win.rotationY,0);});
cityWindowMesh.castShadow=cityWindowMesh.receiveShadow=false;cityWindowMesh.name='city-windows';
{const tint=new THREE.Color();cityWindowPlacements.forEach((win,index)=>{tint.setRGB(win.color[0],win.color[1],win.color[2]);cityWindowMesh.setColorAt(index,tint);});cityWindowMesh.instanceColor.needsUpdate=true;}
function applyMuro(preset){MURO=preset;for(const styleName of Object.keys(cityWallSkins)){const entry=cityWallSkins[styleName];entry.skinned.emissiveIntensity=preset.lift?entry.lift:0;entry.instanced.material=preset.skin?entry.skinned:entry.legacy;}citySkylineMesh.material=preset.haze?citySkylineHaze:citySkylineLegacy;cityWindowMesh.visible=preset.windows;}
applyMuro(MURO);
// L: los cierres de lote. Una geometria de 1x1x1 para los tres estilos -- la matriz de cada instancia
// lleva el largo en X, el alto en Y y el ESPESOR en Z -- asi son tres draw calls y no setenta y cinco.
const fencePanelGeometry=new THREE.BoxGeometry(1,1,1);const fenceGeometries={plank:new THREE.BoxGeometry(1,1,1),hedge:new THREE.BoxGeometry(1,1,1),chain:new THREE.BoxGeometry(1,1,1),post:new THREE.BoxGeometry(1,1,1)};
const fencePainters={plank:paintPlank,hedge:paintHedge,chain:paintChain},fenceMaterials={};
for(const [styleName,spec] of Object.entries(FENCE_STYLES)){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;fencePainters[styleName](canvas.getContext('2d'),spec);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;fenceMaterials[styleName]=new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:new THREE.Color(spec.emissive),emissiveIntensity:spec.emissiveIntensity,roughness:spec.roughness,metalness:spec.metalness,...(spec.seeThrough?{transparent:true,alphaTest:.5,side:THREE.DoubleSide}:{})});fenceMaterials[styleName].onBeforeCompile=shader=>{shader.vertexShader='attribute float aRepeat;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x*=aRepeat;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv.x*=aRepeat;\n#endif');};}
const fenceMatrices={plank:fenceInstanceMatrices('plank'),hedge:fenceInstanceMatrices('hedge'),chain:fenceInstanceMatrices('chain')};
const lotFenceMeshes={plank:new THREE.InstancedMesh(fenceGeometries.plank,fenceMaterials.plank,fenceMatrices.plank.length/16),hedge:new THREE.InstancedMesh(fenceGeometries.hedge,fenceMaterials.hedge,fenceMatrices.hedge.length/16),chain:new THREE.InstancedMesh(fenceGeometries.chain,fenceMaterials.chain,fenceMatrices.chain.length/16)};
const lotPostMatrices=postInstanceMatrices();
lotFenceMeshes.post=new THREE.InstancedMesh(fenceGeometries.post,fenceMaterials.plank,lotPostMatrices.length/16);
fenceMatrices.post=lotPostMatrices;
for(const [styleName,instanced] of Object.entries(lotFenceMeshes)){const matrix=new THREE.Matrix4(),buffer=fenceMatrices[styleName];for(let i=0;i<buffer.length/16;i++){matrix.fromArray(buffer,i*16);instanced.setMatrixAt(i,matrix);}instanced.instanceMatrix.needsUpdate=true;instanced.geometry.setAttribute('aRepeat',new THREE.InstancedBufferAttribute(styleName==='post'?postUvRepeats():fenceUvRepeats(styleName),1));instanced.castShadow=(FENCE_STYLES[styleName]??FENCE_STYLES.plank).castShadow;instanced.receiveShadow=true;instanced.frustumCulled=false;instanced.name='lot-fence-'+styleName;instanced.visible=false;scene.add(instanced);}
// Los patios del preset 2. Todo el kit es UNA caja instanciada con `instanceColor`: de noche y a esta
// escala un cobertizo, un tanque y una pila de lena son cajas de distinto tamano y color. El piso va en
// una malla por estilo, cada una con su textura pintada. Cuatro draw calls para los 38 patios.
const yardBoxList=yardBoxes(),yardBoxMatrixBuffer=yardBoxMatrices(yardBoxList);
const yardBoxMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:.05,emissive:new THREE.Color('#3f443f'),emissiveIntensity:.34});
const yardMeshes={boxes:new THREE.InstancedMesh(fencePanelGeometry,yardBoxMaterial,Math.max(1,yardBoxList.length))};
{const matrix=new THREE.Matrix4(),tint=new THREE.Color();yardBoxList.forEach((box,index)=>{matrix.fromArray(yardBoxMatrixBuffer,index*16);yardMeshes.boxes.setMatrixAt(index,matrix);tint.set(box.color);yardMeshes.boxes.setColorAt(index,tint);});yardMeshes.boxes.instanceMatrix.needsUpdate=true;yardMeshes.boxes.instanceColor.needsUpdate=true;}
const yardGroundPatches=yardGround(),yardGroundGeometry=new THREE.PlaneGeometry(1,1);
for(const style of GROUND_STYLES){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;paintGround(canvas.getContext('2d'),style);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;const patches=yardGroundPatches.filter(patch=>patch.style===style);const material=new THREE.MeshStandardMaterial({map,roughness:.95,metalness:0,emissive:new THREE.Color('#3d423f'),emissiveIntensity:.3});const instanced=new THREE.InstancedMesh(yardGroundGeometry,material,Math.max(1,patches.length));const matrix=new THREE.Matrix4(),euler=new THREE.Euler(-Math.PI/2,0,0),quaternion=new THREE.Quaternion().setFromEuler(euler),position=new THREE.Vector3(),scale=new THREE.Vector3();patches.forEach((patch,index)=>{position.set(patch.x,.035,patch.z);scale.set(patch.width,patch.depth,1);matrix.compose(position,quaternion,scale);instanced.setMatrixAt(index,matrix);});instanced.instanceMatrix.needsUpdate=true;yardMeshes['ground-'+style]=instanced;}
for(const instanced of Object.values(yardMeshes)){instanced.castShadow=false;instanced.receiveShadow=true;instanced.frustumCulled=false;instanced.visible=false;scene.add(instanced);}
// Los fondos de casa: puerta, dos ventanas y bajada pluvial, apoyados en la CINTURA medida y no en el
// AABB, que lo fija el alero. Los apagados van con instanceColor sobre el material del patio; los
// encendidos con MeshBasicMaterial, igual que las ventanas de las siluetas: su color ES su radiancia.
const backDecalList=backDecals(),backDecalBuffer=backDecalMatrices(backDecalList);
const backDark=backDecalList.filter(d=>!d.lit),backLit=backDecalList.filter(d=>d.lit);
const backMaterials={dark:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:.04,emissive:new THREE.Color('#3f443f'),emissiveIntensity:.32}),lit:new THREE.MeshBasicMaterial({color:0xffffff})};
const backMeshes={dark:new THREE.InstancedMesh(fencePanelGeometry,backMaterials.dark,Math.max(1,backDark.length)),lit:new THREE.InstancedMesh(fencePanelGeometry,backMaterials.lit,Math.max(1,backLit.length))};
{const matrix=new THREE.Matrix4(),tint=new THREE.Color();for(const [key,list] of [['dark',backDark],['lit',backLit]]){const mesh=backMeshes[key];const buffer=backDecalMatrices(list);list.forEach((decal,index)=>{matrix.fromArray(buffer,index*16);mesh.setMatrixAt(index,matrix);tint.set(decal.color);mesh.setColorAt(index,tint);});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=key==='dark';mesh.frustumCulled=false;mesh.visible=false;mesh.name='house-back-'+key;scene.add(mesh);}}
// Los laterales, con el mismo kit y los mismos materiales que el fondo. Se construye el preset 2 entero
// y la perilla solo conmuta visibilidad: `windows` (ventanas y bajadas) y `gear` (aire, medidor, farolito).
// Una lista vacia deja `count=0`: con `Math.max(1,n)` y sin eso queda un cubo de 1x1x1 en el origen.
const sideDecalList=sideDecals(cityLots(),lateralesPresetById(2)),sideGroups=sideDecalGroups(sideDecalList);
const sideMeshes={};
{const matrix=new THREE.Matrix4(),tint=new THREE.Color();for(const [key,list] of Object.entries(sideGroups)){const lit=key==='lit'||key==='gearLit';const mesh=new THREE.InstancedMesh(fencePanelGeometry,backMaterials[lit?'lit':'dark'],Math.max(1,list.length));const buffer=sideDecalMatrices(list);list.forEach((decal,index)=>{matrix.fromArray(buffer,index*16);mesh.setMatrixAt(index,matrix);tint.set(decal.color);mesh.setColorAt(index,tint);});if(!list.length)mesh.count=0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=!lit;mesh.frustumCulled=false;mesh.visible=false;mesh.name='house-side-'+key;sideMeshes[key]=mesh;scene.add(mesh);}}
// El delantal de cada casa. Las 32 losas se FUSIONAN en una geometria y salen con `curbMaterial`
// tal cual: un draw call, la baldosa mide 1,6 m en los dos ejes en todas, y el pavimento cambia de
// color con el preset de luz sin cablear nada. Instanciarlas sobre una caja unitaria habria
// estirado la textura hasta 7:1 y un material clonado se habria quedado con el color de carga.
const apronList=frontAprons(),apronEdgeList=apronEdges(apronList);
function mergedGround(specs){const partes=specs.map(spec=>{const g=new THREE.BoxGeometry(...spec.size);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*spec.uv[0]+(spec.uvOffset?.[0]??0),uv.getY(i)*spec.uv[1]+(spec.uvOffset?.[1]??0));uv.needsUpdate=true;if(spec.rotation){g.rotateX(spec.rotation[0]);g.rotateY(spec.rotation[1]);g.rotateZ(spec.rotation[2]);}g.translate(...spec.position);return g;});const merged=mergeCityGeometries(partes);partes.forEach(g=>g.dispose());return merged;}
const apronMerged=mergedGround(apronGeometrySpecs(apronList));
const apronMesh=new THREE.Mesh(apronMerged,curbMaterial);
apronMesh.castShadow=false;apronMesh.receiveShadow=true;apronMesh.frustumCulled=false;apronMesh.name='front-apron';apronMesh.visible=false;scene.add(apronMesh);
const kerbMerged=mergedGround(kerbGeometrySpecs());
const kerbMesh=new THREE.Mesh(kerbMerged,kerbMaterial);
kerbMesh.castShadow=false;kerbMesh.receiveShadow=true;kerbMesh.frustumCulled=false;kerbMesh.name='kerb-edge';kerbMesh.visible=false;scene.add(kerbMesh);
const apronEdgeMerged=mergedGround(edgeGeometrySpecs(apronEdgeList));
const apronEdgeMesh=new THREE.Mesh(apronEdgeMerged,curbMaterial);
apronEdgeMesh.castShadow=false;apronEdgeMesh.receiveShadow=true;apronEdgeMesh.frustumCulled=false;apronEdgeMesh.name='front-apron-edge';apronEdgeMesh.visible=false;scene.add(apronEdgeMesh);
// El umbral de cada puerta medida (?suelo=3): de PIEDRA como el cordon, no de pavimento -- a la misma cota y con
// el mismo material un escalon de 4 cm no se ve. Una losa fusionada, un draw call.
const stoopList=doorStoops(),stoopMerged=mergedGround(stoopGeometrySpecs(stoopList));
const stoopMesh=new THREE.Mesh(stoopMerged,kerbMaterial);
stoopMesh.castShadow=false;stoopMesh.receiveShadow=true;stoopMesh.frustumCulled=false;stoopMesh.name='door-stoop';stoopMesh.visible=false;scene.add(stoopMesh);
// El cruce y los fondos (?suelo=4, crossingState.js): el cordon RECORTADO en las ocho muescas reemplaza al entero, las
// cebras van con el material de la del galpon, las rampas y los remates con el pavimento y el cordon del remate en
// piedra. Cinco draw calls, cero colliders. Las cinco rayas de carril que quedan debajo se esconden en applySuelo.
const kerbCutMerged=mergedGround(kerbGeometrySpecs(kerbRunsNotched()));
const kerbCutMesh=new THREE.Mesh(kerbCutMerged,kerbMaterial);
kerbCutMesh.castShadow=false;kerbCutMesh.receiveShadow=true;kerbCutMesh.frustumCulled=false;kerbCutMesh.name='kerb-edge-cut';kerbCutMesh.visible=false;scene.add(kerbCutMesh);
const zebraMerged=mergedGround(zebraGeometrySpecs());
const zebraMesh=new THREE.Mesh(zebraMerged,crossingMaterial);
zebraMesh.castShadow=false;zebraMesh.receiveShadow=true;zebraMesh.frustumCulled=false;zebraMesh.name='zebra-crossing';zebraMesh.visible=false;scene.add(zebraMesh);
const rampMerged=mergedGround(rampGeometrySpecs());
const rampMesh=new THREE.Mesh(rampMerged,curbMaterial);
rampMesh.castShadow=false;rampMesh.receiveShadow=true;rampMesh.frustumCulled=false;rampMesh.name='kerb-ramp';rampMesh.visible=false;scene.add(rampMesh);
const returnMerged=mergedGround(returnGeometrySpecs());
const returnMesh=new THREE.Mesh(returnMerged,curbMaterial);
returnMesh.castShadow=false;returnMesh.receiveShadow=true;returnMesh.frustumCulled=false;returnMesh.name='dead-end-return';returnMesh.visible=false;scene.add(returnMesh);
const returnKerbMerged=mergedGround(returnKerbGeometrySpecs());
const returnKerbMesh=new THREE.Mesh(returnKerbMerged,kerbMaterial);
returnKerbMesh.castShadow=false;returnKerbMesh.receiveShadow=true;returnKerbMesh.frustumCulled=false;returnKerbMesh.name='dead-end-return-kerb';returnKerbMesh.visible=false;scene.add(returnKerbMesh);
// Las bases que no apoyan (?bases, slabPodiumState.js): un zocalo de piedra que envuelve la placa que flota, y una
// vidriera pintada en canvas con MeshBasicMaterial sobre la planta baja negra (radiancia directa, como las ventanas
// del skyline). Hoy es un lote (BLOCK-005); si el mapa medido encuentra otro, entra solo.
const podiumList=podiums(),podiumMerged=podiumList.length?mergedGround(podiumGeometrySpecs(podiumList)):new THREE.BufferGeometry();
const podiumMesh=new THREE.Mesh(podiumMerged,kerbMaterial);
podiumMesh.castShadow=false;podiumMesh.receiveShadow=true;podiumMesh.frustumCulled=false;podiumMesh.name='slab-podium';podiumMesh.visible=false;scene.add(podiumMesh);
const shopfrontList=shopfronts(),shopfrontMeshes=shopfrontList.map(s=>{const canvas=document.createElement('canvas');canvas.width=SHOPFRONT_CANVAS[0];canvas.height=SHOPFRONT_CANVAS[1];paintShopfront(canvas.getContext('2d'),s);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(s.width,s.height),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(s.x,s.y,s.z);mesh.rotation.y=s.rotationY;mesh.castShadow=false;mesh.receiveShadow=false;mesh.name='shopfront';mesh.visible=false;scene.add(mesh);return mesh;});
const lotFenceCollidersAll=lotFencePieces().map(piece=>piece.collider).filter(Boolean);
const lampPoolFixtures=lightFixtures.filter(f=>f.kind==='lamp');
const lampPoolTex=new THREE.DataTexture(buildRadialAlphaPixels({...CONTACT_SHADOW,rgb:STREET_LIGHT_POOL.poolTint,peakAlpha:255}),CONTACT_SHADOW.size,CONTACT_SHADOW.size);lampPoolTex.colorSpace=THREE.SRGBColorSpace;lampPoolTex.needsUpdate=true;
const lampPools=new THREE.InstancedMesh(new THREE.CircleGeometry(STREET_LIGHT_POOL.poolRadius,20),new THREE.MeshBasicMaterial({map:lampPoolTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),Math.max(1,lampPoolFixtures.length));
lampPools.renderOrder=2;lampPools.frustumCulled=false;
{const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),p=new THREE.Vector3(),s=new THREE.Vector3(1,1,1);lampPoolFixtures.forEach((f,i)=>{p.set(f.x,.014,f.z);lampPools.setMatrixAt(i,m.compose(p,q,s));lampPools.setColorAt(i,new THREE.Color(STREET_LIGHT_POOL.poolOpacityIdle,STREET_LIGHT_POOL.poolOpacityIdle,STREET_LIGHT_POOL.poolOpacityIdle));});lampPools.instanceMatrix.needsUpdate=true;if(lampPools.instanceColor)lampPools.instanceColor.needsUpdate=true;}
scene.add(lampPools);
function refreshLampPools(placement){if(!lampPools.instanceColor)return;const lit=new Set(placement.map(p=>p.fixtureId).filter(Boolean));lampPoolFixtures.forEach((f,i)=>{const level=lit.has(f.id)?STREET_LIGHT_POOL.poolOpacityLit:STREET_LIGHT_POOL.poolOpacityIdle;lampPools.setColorAt(i,new THREE.Color(level,level,level));});lampPools.instanceColor.needsUpdate=true;}
loadStreetSet(ASSET_URLS.street.lamp,3.65,STREET_LAYOUT.lamps,'streetlamps',()=>{});
// La vereda vestida. Cada pieza se carga UNA vez y se instancia: 13 assets para las 46 piezas del
// preset 2, o sea 13 draw calls y no 46. La geometria se hornea ya escalada al tamano que declara
// DRESSING_KIT (`fitScaleForWorldBox`, igual que los faroles) y con la base en y=0 y el centro en
// XZ, para que la matriz de instancia sea solo posicion y giro.
// Hornea un GLB del kit en UNA geometria a la escala que declara `spec.size`, con la base en y=0 y el centro
// en XZ, para que la matriz de colocacion sea solo posicion, giro y el estiramiento en x. La usan el vestido
// (instancias) y el rincon del spawn (Meshes propios).
function bakeKitGeometry(gltf,spec){gltf.scene.updateWorldMatrix(true,true);const partes=[];let material=null;gltf.scene.traverse(o=>{if(!o.isMesh||!o.geometry)return;material??=Array.isArray(o.material)?o.material[0]:o.material;partes.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});if(!partes.length||!material)return null;const geo=partes.length===1?partes[0]:mergeCityGeometries(partes);if(partes.length>1)partes.forEach(g=>g.dispose());if(spec.rawYaw)geo.rotateY(spec.rawYaw);const caja=new THREE.Box3().setFromBufferAttribute(geo.attributes.position);const bruto=caja.getSize(new THREE.Vector3());const k=fitScaleForWorldBox(bruto,{maxWidthX:spec.size[0],maxDepthZ:spec.size[2],maxHeight:spec.size[1]});geo.scale(k,k,k);geo.computeBoundingBox();const b=geo.boundingBox;geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);return{geo,material};}
// Cada GLB del kit se pide y se hornea UNA vez, lo usen el vestido, el rincon o los dos: la promesa se comparte.
const kitBakes={};
function loadKitBake(asset){return kitBakes[asset]??=new Promise((ok,no)=>streetAssetLoader.load(DRESSING_KIT[asset].url,gltf=>{const baked=bakeKitGeometry(gltf,DRESSING_KIT[asset]);if(baked)ok(baked);else no(new Error('sin malla'));},undefined,no));}
const dressingMeshes={},dressingPlacementsByPreset={1:dressingPlacements(veredaPresetById(1)),2:dressingPlacements(veredaPresetById(2))};
for(const [asset,spec] of Object.entries(DRESSING_KIT)){
  const placements=dressingPlacementsByPreset[2].filter(p=>p.asset===asset);
  if(!placements.length)continue;
  loadKitBake(asset).then(({geo,material})=>{
    const inst=new THREE.InstancedMesh(geo,material.clone(),placements.length);
    const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),esc=new THREE.Vector3(1,1,1),euler=new THREE.Euler();    // `escalaX` solo lo traen las piezas de fondo: se estiran a lo ancho del hueco que tapan.
    placements.forEach((p,i)=>{pos.set(p.x,.12,p.z);euler.set(0,p.rotationY,0);quat.setFromEuler(euler);esc.set(p.escalaX??1,p.escalaY??1,1);matrix.compose(pos,quat,esc);inst.setMatrixAt(i,matrix);});
    inst.instanceMatrix.needsUpdate=true;
    inst.castShadow=true;inst.receiveShadow=true;inst.frustumCulled=false;inst.name='dressing-'+asset;
    tuneNightMaterials(inst);
    inst.userData.dressingAsset=asset;inst.userData.placements=placements;
    dressingMeshes[asset]=inst;inst.visible=false;scene.add(inst);
    applyVestida(VESTIDA);
  },error=>console.warn('Stockdealer / dressing '+asset+' omitido',error));
}
// El rincon del spawn (?isla). Las piezas son Meshes propios y no instancias del vestido: asi `?vestida=0` no
// se las lleva y las dos perillas quedan sueltas. Cada asset se hornea una vez y las piezas del mismo asset
// comparten geometria. El solado se fusiona en una losa con el material del cordon, como el delantal.
const cornerMeshes={},cornerPieceList=cornerPieces(islaPresetById(2)),cornerCollidersLive=[];
for(const asset of new Set(cornerPieceList.map(p=>p.asset))){
  loadKitBake(asset).then(baked=>{
    // el material no se clona aca: tuneNightMaterials ya clona uno por mesh (el primer corte dejaba un clon huerfano por pieza)
    for(const p of cornerPieceList.filter(p=>p.asset===asset)){const mesh=new THREE.Mesh(baked.geo,baked.material);mesh.position.set(p.x,cornerPieceY(ISLA),p.z);mesh.rotation.y=p.rotationY;mesh.scale.set(p.escalaX??1,p.escalaY??1,1);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='corner-'+p.id;tuneNightMaterials(mesh);mesh.userData.cornerPiece=p;mesh.visible=false;cornerMeshes[p.id]=mesh;scene.add(mesh);}
    applyIsla(ISLA);
  },error=>console.warn('Stockdealer / corner '+asset+' omitido',error));
}
const cornerPadMesh=new THREE.Mesh(mergedGround(cornerPadSpecs()),curbMaterial);
cornerPadMesh.castShadow=false;cornerPadMesh.receiveShadow=true;cornerPadMesh.frustumCulled=false;cornerPadMesh.name='corner-pad';cornerPadMesh.visible=false;scene.add(cornerPadMesh);
loadStreetSet(ASSET_URLS.street.tree,3.85,STREET_LAYOUT.trees.map((tree,index)=>({...tree,rotationY:index*1.17})),'street trees');
loadStreetSet(ASSET_URLS.street.shrub,1.02,STREET_LAYOUT.shrubs,'shrub planters');
loadStreetSet(ASSET_URLS.street.van,STREET_LAYOUT.van.height,[STREET_LAYOUT.van],'delivery van',(actor)=>{streetActors.van=actor;});
loadStreetSet(ASSET_URLS.street.loadingZone,STREET_LAYOUT.loadingZone.height,[STREET_LAYOUT.loadingZone],'loading-zone cluster');
loadStreetSet(ASSET_URLS.street.furniture,STREET_LAYOUT.furniture.height,[STREET_LAYOUT.furniture],'street-furniture island',(actor)=>{streetActors.furnitureIsland=actor;syncIsla();});
loadStreetSet(ASSET_URLS.street.neighborOlder,STREET_LAYOUT.neighborOlder.height,[STREET_LAYOUT.neighborOlder],'older neighbor',(actor,placement,index,animations)=>{streetActors.older=actor;if(animations?.[0]){const mixer=new THREE.AnimationMixer(actor);mixer.clipAction(animations[0]).play();streetMixers.push(mixer);}});
loadStreetSet(ASSET_URLS.street.househeadIdle,STREET_LAYOUT.househead.height,[STREET_LAYOUT.househead],'househead character',(actor,placement,index,animations)=>{streetActors.househead=actor;const idleClip=THREE.AnimationClip.findByName(animations,'Househead_Idle');if(idleClip){househeadMixer=new THREE.AnimationMixer(actor);househeadMixer.clipAction(idleClip).play();streetMixers.push(househeadMixer);}});
loadStreetSet(ASSET_URLS.street.foxWalker,STREET_LAYOUT.foxWalker.height,[{...STREET_LAYOUT.foxWalker,z:STREET_LAYOUT.foxWalker.minZ}],'animated fox walker',(actor,placement,index,animations)=>{streetActors.foxWalker=actor;const walkClip=animations?.[0];if(walkClip){foxWalkerMixer=new THREE.AnimationMixer(actor);foxWalkerMixer.clipAction(walkClip).play();streetMixers.push(foxWalkerMixer);}});
loadStreetSet(ASSET_URLS.street.neonCatWalker,STREET_LAYOUT.neonCatWalker.height,[{...STREET_LAYOUT.neonCatWalker,z:STREET_LAYOUT.neonCatWalker.maxZ}],'animated neon cat walker',(actor,placement,index,animations)=>{streetActors.neonCatWalker=actor;const walkClip=animations?.[0];if(walkClip){neonCatWalkerMixer=new THREE.AnimationMixer(actor);neonCatWalkerMixer.clipAction(walkClip).play();streetMixers.push(neonCatWalkerMixer);}});
const streetWalkerActors=[];
// T48 (paquete G): cuatro caminantes mas sobre el zorro y el gato originales. SkeletonUtils.clone porque Object3D.clone comparte el esqueleto; multiplyScalar sobre la escala que dejo normalizeAsset; el pie en STREET_LAYOUT[asset].groundY (.12, el tope de la vereda). tuneNightMaterials por instancia: clona los materiales (el tinte no se comparte) y los mete en nightTunedMaterials para que ?lighting los siga.
function loadWalkerSet(url,height,walkers,label){if(!walkers.length)return;streetAssetLoader.load(url,gltf=>{const template=normalizeAsset(gltf.scene,height);const walkClip=gltf.animations?.[0];walkers.forEach(walker=>{const instance=cloneSkinnedAsset(template);instance.scale.multiplyScalar(walker.scale);instance.position.set(walker.lane,STREET_LAYOUT[walker.asset].groundY,walker.minZ);instance.userData.streetAsset=walker.key;tuneNightMaterials(instance);const tint=new THREE.Color(walker.tint);instance.traverse(object=>{if(!object.isMesh)return;(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>{if(material.color)material.color.lerp(tint,walker.tintAmount);});});scene.add(instance);registerLaw(instance,url);const mixer=new THREE.AnimationMixer(instance);const action=walkClip?mixer.clipAction(walkClip):null;if(action){action.play();action.time=walker.phase;}streetMixers.push(mixer);streetWalkerActors.push({walker,actor:instance,patrol:{distance:walker.minZ,direction:1,dwell:0},action});});applyG60Walkers(G60);devLog.info(`Stockdealer · street walkers ${label} ×${walkers.length}`);},undefined,error=>console.warn(`Stockdealer · street walkers ${label} omitted`,error));}
loadWalkerSet(ASSET_URLS.street.foxWalker,STREET_LAYOUT.foxWalker.height,STREET_WALKERS.filter(walker=>walker.asset==='foxWalker'),'fox');
loadWalkerSet(ASSET_URLS.street.neonCatWalker,STREET_LAYOUT.neonCatWalker.height,STREET_WALKERS.filter(walker=>walker.asset==='neonCatWalker'),'neon cat');
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
  if(placements.length)loadStreetSet(url,placements[0].height,placements,`${label} row`,(actor,placement)=>registerHouse(actor,placement));
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
// Las casas repetidas, por lote, con materiales PROPIOS: las instancias de loadStreetSet comparten los de la plantilla y
// un tinte por casa necesita un material por casa. El color y el emisivo base se guardan para que el 0 sea hoy.
const houseActors=new Map();
function registerHouse(actor,placement){const id=lotIdForPlacement(placement);if(!id)return;actor.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];const clones=ms.map(m=>{const c=m.clone();c.userData.baseColor=(m.userData.baseColor??m.color).clone();c.userData.baseEmissive=(m.userData.baseEmissive??m.emissive).clone();if(c.emissiveMap)nightTunedMaterials.push(c);return c;});o.material=Array.isArray(o.material)?clones:clones[0];});houseActors.set(id,actor);syncCasas();}
const cityPackWrappers={},brandSwapWrappers={};
for(const placement of STREET_LAYOUT.cityPackBuildings){
  loadCenteredFittedAsset(ASSET_URLS.street[placement.asset],placement,`city pack ${placement.asset}`,wrapper=>{cityPackWrappers[placement.asset]=wrapper;syncMarcas();});
}
// Los dos edificios sin marca (?marcas=1). Se cargan siempre y la perilla decide cual de los dos de cada
// lote se ve; el que llega despues de conmutar se acomoda solo por `syncMarcas` en su callback.
for(const swap of BRAND_SWAPS)loadCenteredFittedAsset(ASSET_URLS.street[swap.asset],swap,`brand-free ${swap.asset}`,wrapper=>{brandSwapWrappers[swap.lot]=wrapper;syncMarcas();});
let warehouseExterior=null;
loadCenteredFittedAsset(ASSET_URLS.warehouse.exterior,{x:0,z:-1.3,height:8.2,maxWidthX:14,maxDepthZ:18.4,groundY:0,rotationY:0},'supplied warehouse exterior',wrapper=>{warehouseExterior=wrapper;warehouseExterior.visible=warehouseVisibilityForLocation(state?.location).suppliedExterior;});
// T49 (paquete G): el cartel del GLB viene roto de fabrica; se enciende como neon roto (signState.js). El material 13 no trae
// textura (A no le puso emissiveMap; el clon es un cinturon), y la luz es el fixture `restaurant-sign` del pool de A,
// colocado desde la caja medida del propio cartel: wrapper.updateMatrixWorld(true) primero, porque el wrapper recien creado
// todavia no tiene matrixWorld y Box3.expandByObject mediria en espacio RAW del GLB.
const restaurantSignMaterials=[];
loadCenteredFittedAsset(ASSET_URLS.street.restaurant,STREET_LAYOUT.restaurant,'right-branch restaurant',wrapper=>{wrapper.updateMatrixWorld(true);const signBox=new THREE.Box3();wrapper.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(source=>{if(!isRestaurantSignColor(source.color))return source;const material=source.clone();material.emissive.setHex(0xff2a1e);material.emissiveMap=null;material.emissiveIntensity=1.45;material.roughness=.55;restaurantSignMaterials.push(material);signBox.expandByObject(object);return material;});if(object.material.length===1)object.material=object.material[0];});if(!signBox.isEmpty()){const center=signBox.getCenter(new THREE.Vector3());RESTAURANT_SIGN_FIXTURE.x=center.x;RESTAURANT_SIGN_FIXTURE.y=center.y;RESTAURANT_SIGN_FIXTURE.z=signBox.min.z-.7;}devLog.info(`Stockdealer · restaurant neon sign materials ×${restaurantSignMaterials.length} at ${RESTAURANT_SIGN_FIXTURE.x.toFixed(2)}/${RESTAURANT_SIGN_FIXTURE.y.toFixed(2)}/${RESTAURANT_SIGN_FIXTURE.z.toFixed(2)}`);});
portalHit(
  [RESTAURANT_EXTERIOR_INTERACTION.size.x, RESTAURANT_EXTERIOR_INTERACTION.size.y, RESTAURANT_EXTERIOR_INTERACTION.size.z],
  [RESTAURANT_EXTERIOR_INTERACTION.position.x, RESTAURANT_EXTERIOR_INTERACTION.position.y, RESTAURANT_EXTERIOR_INTERACTION.position.z],
  RESTAURANT_EXTERIOR_INTERACTION.id,
);
let streetAmbienceContext=null;
let streetWindGain=null;
// T48 + C2 (CF-01/CF-02): la van frena en una LINEA por (cruce, sentido) derivada de las cebras y de su largo medido (vanStopState.js: 25,87 al norte y 42,13 al sur en la bocacalle, 15,08 al sur en el galpon; hacia el norte arranca ENCIMA del galpon y ahi no frena), 3,6 s / 2,4 s; `served` se limpia al dar la vuelta. `z` inicial para que el primer advanceVanStop no compare undefined; la rampa LINEAL del acelerador (advanceVanThrottle: 0 exacto en 0,38 s, 1 en 0,63 s) vive en streetLifeState porque las lineas descuentan su distancia de frenado (0,46 m).
let vehicleRouteState={segment:0,distance:0,z:STREET_LAYOUT.vehicleRoute[0].z};
let vanStopState=vanStopIdle();
let vanThrottle=1;
let foxPatrolState={distance:STREET_LAYOUT.foxWalker.minZ,direction:1};
let neonCatPatrolState={distance:STREET_LAYOUT.neonCatWalker.maxZ,direction:-1};
function startStreetAmbience(){if(streetAmbienceContext){streetAmbienceContext.resume();return;}const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return;streetAmbienceContext=new AudioContext();const length=streetAmbienceContext.sampleRate*3;const buffer=streetAmbienceContext.createBuffer(1,length,streetAmbienceContext.sampleRate);const data=buffer.getChannelData(0);let value=0;for(let i=0;i<length;i++){value=value*.985+(Math.random()*2-1)*.015;data[i]=value;}const wind=streetAmbienceContext.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=streetAmbienceContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;const gain=streetAmbienceContext.createGain();gain.gain.value=.026;streetWindGain=gain;wind.connect(filter).connect(gain).connect(streetAmbienceContext.destination);wind.start();}
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
  box([1.35,.1,.5],dark,[0,3.65,centerZ],false);
  return table;
}
makeInterior('shop-interior',-30,0x273a29);
makeInterior('house-interior',-48,0x493d31);
loadCenteredFittedAsset(ASSET_URLS.street.restaurantInterior,{x:0,z:-80,height:5.6,maxWidthX:22.5,maxDepthZ:36,groundY:0,rotationY:0},'instanced evening restaurant interior');
// Hueco al fondo: el GLB del interior termina en z -62 y los muros de salida en -60.25 con tope y 4.3 (A ya apago las estrellas; el color de fondo se colaba igual, arriba y bajo la puerta). La alfombra del GLB es una plataforma a y .56 que termina en z -65.8, asi que el parche de piso llega hasta debajo de ese borde.
const restaurantCeilingMaterial=new THREE.MeshStandardMaterial({color:0x1a120c,roughness:.95});
box([23.4,.3,39],restaurantCeilingMaterial,[0,5.6,-79.6]);
box([23.4,1.3,.25],restaurantCeilingMaterial,[0,4.95,-60.25]);
const restaurantFloorPatchMaterial=new THREE.MeshStandardMaterial({color:0x70131a,roughness:.95});
box([23.4,.1,6.3],restaurantFloorPatchMaterial,[0,-.05,-63.25]);
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
portalHit(
  [restaurantExit.size.x,restaurantExit.size.y,restaurantExit.size.z],
  [restaurantExit.position.x,restaurantExit.position.y,restaurantExit.position.z],
  restaurantExit.id,
);

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

function loadPlantStage(stage,url,targetHeight,label){new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const scale=targetHeight/size.y;model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});plantTemplates.set(stage,model);pots.filter(p=>stageFor(p.growth)===stage).forEach(rebuildPlant);refreshDisplayPlantStage(stage);console.info(`Stockdealer · Meshy ${label} loaded`);},undefined,error=>console.warn(`Stockdealer · ${label} fallback`,error));}
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
let sessionEntryGeneration=0;
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
const state={tokenBalance:null,seeds:0,buds:0,claimableStocks:{},properties:new Map(HOUSE_PROPERTIES.map(property=>[property.id,property])),walletAddress:null,onchainSnapshot:null,activePropertyId:null,selectedPropertyId:null,slot:0,locked:false,near:null,location:INITIAL_PLAYER_SPAWN.location,pendingPortal:null,mode:'pending',playerSkin:null};
function activeProperty(){return state.activePropertyId?state.properties.get(state.activePropertyId):null;}
function applyWarehouseCrops(){if(!state.onchainSnapshot)return;const growthForStage=[0,1,2,4,7,10];for(let plotId=0;plotId<WAREHOUSE_GROW_STATIONS.length;plotId++){const pot=pots[plotId];const crop=state.onchainSnapshot.crops.find(candidate=>candidate.location==='warehouse'&&candidate.plotId===plotId);Object.assign(pot,crop?{growth:growthForStage[crop.stage]??0,water:crop.wateredAt?100:0,seedTicker:crop.ticker,plantedAt:crop.plantedAt*1000,wateredAt:crop.wateredAt?crop.wateredAt*1000:null}:{growth:0,water:0,seedTicker:null,plantedAt:null,wateredAt:null});rebuildPlant(pot);}}
function applyActivePropertyCrops(){if(!state.onchainSnapshot||!state.activePropertyId)return;const houseId=onchainPropertyId(state.activePropertyId),growthForStage=[0,1,2,4,7,10];for(let plotId=0;plotId<houseGrowStations.length;plotId++){const pot=pots[WAREHOUSE_GROW_STATIONS.length+plotId];const crop=state.onchainSnapshot.crops.find(candidate=>candidate.houseId===houseId&&candidate.plotId===plotId);Object.assign(pot,crop?{growth:growthForStage[crop.stage]??0,water:crop.wateredAt?100:0,seedTicker:crop.ticker,plantedAt:crop.plantedAt*1000,wateredAt:crop.wateredAt?crop.wateredAt*1000:null}:{growth:0,water:0,seedTicker:null,plantedAt:null,wateredAt:null});rebuildPlant(pot);}}
async function refreshOnchainState(){if(!state.walletAddress)return false;const response=await fetch('/api/state',{credentials:'include',cache:'no-store'});if(!response.ok)throw new Error('ONCHAIN_STATE_UNAVAILABLE');const snapshot=validateOnchainSnapshot(await response.json(),state.walletAddress);state.onchainSnapshot=snapshot;state.seeds=snapshot.totalSeeds;for(const record of snapshot.properties){let propertyId;try{propertyId=propertyIdFromOnchain(record.houseId);}catch{continue;}const property=state.properties.get(propertyId);if(property)state.properties.set(propertyId,Object.freeze({...property,owner:/^0x0{40}$/i.test(record.owner)?null:record.owner,purchasePrice:record.configured?record.price:null,capacity:record.capacity||property.capacity,mode:record.owner?.toLowerCase()===state.walletAddress.toLowerCase()?'ONCHAIN_OWNER':record.owner&&!/^0x0{40}$/i.test(record.owner)?'ONCHAIN_OCCUPIED':'UNOWNED'}));}applyWarehouseCrops();applyActivePropertyCrops();refresh();return true;}
function claimableOnchainCrop(){return state.onchainSnapshot?.crops?.find(crop=>crop.stage===5)??null;}
function updateClaimButton(){
  if(!economyConfig.economyActive){claimHarvestButton.disabled=true;claimHarvestButton.textContent='ECONOMY NOT ACTIVE';return;}
  if(!state.walletAddress){claimHarvestButton.disabled=false;claimHarvestButton.textContent='CONNECT WALLET TO CLAIM';return;}
  if(!state.onchainSnapshot){claimHarvestButton.disabled=true;claimHarvestButton.textContent='LOADING ONCHAIN HARVESTS…';return;}
  const crop=claimableOnchainCrop();claimHarvestButton.disabled=!crop;claimHarvestButton.textContent=crop?`CLAIM ${crop.ticker} STOCKS ONCHAIN`:'NO MATURE STOCKS TO CLAIM';
}
async function claimAvailableHarvest(){
  if(!state.walletAddress&&!await connectPlayerWallet())return;
  const crop=claimableOnchainCrop();if(!crop){updateClaimButton();showToast('NO MATURE STOCKS TO CLAIM');return;}
  claimHarvestButton.disabled=true;claimHarvestButton.textContent='CLAIMING ONCHAIN…';
  try{const warehouse=crop.location==='warehouse';const result=await executeCultivationAction({action:warehouse?'claimWarehouseHarvest':'claimHarvest',args:warehouse?[crop.plotId,state.walletAddress]:[crop.houseId,crop.plotId,state.walletAddress],account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum});await refreshOnchainState();showToast(`${crop.ticker} STOCK CLAIM CONFIRMED · ${result.hash.slice(0,10)}…`);}
  catch(error){showToast(error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':'STOCK CLAIM FAILED SAFELY');}
  finally{updateClaimButton();}
}
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
    WAREHOUSE_DECOR.hydroponicTower.collider,
    ...DISPLAY_SHELF_BANKS.map(bank=>bank.collider),
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
const ui={gate:document.querySelector('#gate'),loaderVideo:document.querySelector('#loaderVideo'),loaderActions:document.querySelector('#loaderActions'),hud:document.querySelector('#hud'),prompt:document.querySelector('#prompt'),toast:document.querySelector('#toast'),onlinePlayers:document.querySelector('#onlinePlayers'),stockdealerBalance:document.querySelector('#stockdealerBalance'),seeds:document.querySelector('#seeds'),buds:document.querySelector('#buds'),objective:document.querySelector('#objective'),chapter:document.querySelector('.chapter'),vendor:document.querySelector('#vendorPanel'),property:document.querySelector('#propertyPanel'),propertyTitle:document.querySelector('#propertyTitle'),propertyStatus:document.querySelector('#propertyStatus'),propertyCapacity:document.querySelector('#propertyCapacity'),propertyOwner:document.querySelector('#propertyOwner'),propertyMessage:document.querySelector('#propertyMessage'),propertyAction:document.querySelector('#propertyAction'),wallet:document.querySelector('#walletPanel'),walletAddress:document.querySelector('#walletAddress'),walletButton:document.querySelector('#wallet'),connectWallet:document.querySelector('#connectWallet'),portal:document.querySelector('#portalPanel'),neighborGuide:document.querySelector('#neighborGuide'),portalTitle:document.querySelector('#portalTitle'),portalMessage:document.querySelector('#portalMessage'),portalYes:document.querySelector('#portalYes'),portalNo:document.querySelector('#portalNo'),househeadQuestion:document.querySelector('#househeadQuestion'),househeadYes:document.querySelector('#househeadYes'),househeadNo:document.querySelector('#househeadNo'),stockdealerSwap:document.querySelector('#stockdealerSwap'),stockdealerSwapClose:document.querySelector('#stockdealerSwapClose'),onchainPurchaseConfirmation:document.querySelector('#onchainPurchaseConfirmation'),onchainPurchaseTicker:document.querySelector('#onchainPurchaseTicker'),onchainPurchaseSeeds:document.querySelector('#onchainPurchaseSeeds'),onchainPurchaseHash:document.querySelector('#onchainPurchaseHash'),onchainPurchaseBlock:document.querySelector('#onchainPurchaseBlock')};
const visualWateringUi={gauge:document.querySelector('#visualWateringGauge'),fill:document.querySelector('#visualWateringGauge b'),label:document.querySelector('#visualWateringGauge small')};
let visualWateringSession=null,visualWaterDropCarry=0,visualWateringLastAt=0,visualWateringCompleted=false;
function compactWallet(wallet){return wallet?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:'NOT CONNECTED';}
function purchaseProgressLabel(status){return({AWAITING_APPROVAL:'CONFIRM EXACT FLYCO APPROVAL',APPROVAL_BROADCAST:'VERIFYING APPROVAL ONCHAIN…',APPROVAL_CONFIRMED:'APPROVAL CONFIRMED',AWAITING_PURCHASE:'CONFIRM SEED PURCHASE',PURCHASE_BROADCAST:'VERIFYING PURCHASE ONCHAIN…',PURCHASE_CONFIRMED:'PURCHASE CONFIRMED'}[status]??'PREPARING SECURE QUOTE…');}
function receiptBlockLabel(receipt){const value=receipt?.blockNumber;if(Number.isSafeInteger(value)&&value>=0)return String(value);if(typeof value==='string'&&/^0x[0-9a-f]+$/i.test(value))return BigInt(value).toString();return 'CANONICAL';}
function showOnchainPurchaseConfirmation({symbol,seeds,hash,receipt}){ui.onchainPurchaseTicker.textContent=symbol;ui.onchainPurchaseSeeds.textContent=String(seeds);ui.onchainPurchaseHash.textContent=hash;ui.onchainPurchaseBlock.textContent=receiptBlockLabel(receipt);document.exitPointerLock();ui.onchainPurchaseConfirmation.classList.remove('hidden');}
function showReconciledPurchase(result){if(result?.status==='ACTION_CONFIRMED'&&result.symbol&&Number.isInteger(result.creditedSeeds)&&result.receipt)showOnchainPurchaseConfirmation({symbol:result.symbol,seeds:result.creditedSeeds,hash:result.hash,receipt:result.receipt});}
async function connectPlayerWallet(){
  if(!globalThis.ethereum?.request){showToast('NO INJECTED WALLET FOUND');return null;}
  const generation=++walletConnectionGeneration;
  try{const accounts=await globalThis.ethereum.request({method:'eth_requestAccounts'});const wallet=accounts?.[0];if(generation!==walletConnectionGeneration)return null;if(!/^0x[0-9a-f]{40}$/i.test(wallet??''))throw new Error('Invalid wallet');state.walletAddress=wallet;ui.walletAddress.textContent=wallet;ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;showToast('WALLET CONNECTED · SIGN TO LOAD PROGRESS');await ensureAuthenticatedSession(wallet);if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return null;const reconciliation=await reconcileEconomyJournal({ethereum:globalThis.ethereum,account:wallet}).catch(error=>{console.warn('Stockdealer · economy reconciliation required',error);showToast('ECONOMY RECONCILIATION REQUIRED');return null;});showReconciledPurchase(reconciliation);await refreshOnchainState();if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return null;await syncMultiplayerLocation();return wallet;}catch(error){if(generation===walletConnectionGeneration)clearWalletContext();showToast(error?.code===4001?'WALLET CONNECTION REJECTED':'WALLET CONNECTION OR STATE LOAD FAILED');return null;}
}
function clearWalletContext(){walletConnectionGeneration++;multiplayerGeneration++;multiplayerClient?.close();multiplayerClient=null;localServerReady=false;authenticatedWallet=null;ui.onlinePlayers.textContent='0';state.walletAddress=null;state.onchainSnapshot=null;state.properties=new Map(HOUSE_PROPERTIES.map(property=>[property.id,property]));state.activePropertyId=null;state.selectedPropertyId=null;if(state.location==='house-interior'){state.location='street';camera.position.set(0,1.68,9.55);yaw=Math.PI;}for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();ui.walletAddress.textContent='NOT CONNECTED';ui.walletButton.textContent='WALLET — NOT CONNECTED';refresh();}
async function handleAccountsChanged(accounts){if(state.mode==='spectator')return;const wallet=accounts?.[0];if(isSameWalletAddress(state.walletAddress,wallet))return;clearWalletContext();const generation=walletConnectionGeneration;if(!/^0x[0-9a-f]{40}$/i.test(wallet??''))return;state.walletAddress=wallet;ui.walletAddress.textContent=wallet;ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;try{await ensureAuthenticatedSession(wallet);if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return;const reconciliation=await reconcileEconomyJournal({ethereum:globalThis.ethereum,account:wallet}).catch(error=>{console.warn('Stockdealer · economy reconciliation required',error);showToast('ECONOMY RECONCILIATION REQUIRED');return null;});showReconciledPurchase(reconciliation);await refreshOnchainState();if(generation!==walletConnectionGeneration||state.walletAddress?.toLowerCase()!==wallet.toLowerCase())return;await syncMultiplayerLocation();}catch(error){if(generation===walletConnectionGeneration)clearWalletContext();console.warn('Stockdealer · wallet context refresh failed',error);}}
function handleChainChanged(chainId){if(state.mode==='spectator')return;if(chainId?.toLowerCase()!=='0x1237'){clearWalletContext();showToast('SWITCH TO ROBINHOOD CHAIN MAINNET');}else if(state.walletAddress)handleAccountsChanged([state.walletAddress]);}
function handleWalletDisconnect(){if(state.mode==='spectator')return;clearWalletContext();}
async function buySelectedSeeds(){
  if(!economyConfig.economyActive||vendorSelectedProduct.ticker==='HOOD')return;
  if(!state.walletAddress&&!await connectPlayerWallet())return;
  const purchaseProduct=vendorSelectedProduct;
  const original=vendorBuyButton.textContent;vendorBuyButton.disabled=true;vendorBuyButton.textContent='PREPARING SECURE QUOTE…';
  let result;try{
    try{result=await executeSeedPurchase({symbol:purchaseProduct.ticker,account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum,onProgress:status=>{vendorBuyButton.textContent=purchaseProgressLabel(status);}});}
    catch(error){vendorBuyButton.textContent=error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':'PURCHASE NOT SENT';showToast(error?.message==='ACTION_REJECTED'?'TRANSACTION REJECTED':'SEED PURCHASE FAILED SAFELY');return;}
    showOnchainPurchaseConfirmation({symbol:purchaseProduct.ticker,seeds:result.creditedSeeds,hash:result.hash,receipt:result.receipt});
    try{await refreshOnchainState();vendorBuyButton.textContent='PURCHASE CONFIRMED';showToast(`${purchaseProduct.ticker} SEED PACK CONFIRMED · ${result.hash.slice(0,10)}…`);}
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

function refresh(){refreshHouseGrowStations();ui.stockdealerBalance.textContent=state.tokenBalance??'—';ui.seeds.textContent=state.seeds;ui.buds.textContent=state.buds;if(budInventoryModel)budInventoryModel.visible=state.mode!=='spectator'&&state.buds>0;const warehouseVisibility=warehouseVisibilityForLocation(state.location);legacyWarehouseShell.forEach(item=>item.visible=warehouseVisibility.legacyInterior);warehouseExpansionObjects.forEach(item=>item.visible=warehouseVisibility.legacyInterior);if(warehouseExterior)warehouseExterior.visible=warehouseVisibility.suppliedExterior;document.querySelectorAll('.hotbar button').forEach((b,i)=>b.classList.toggle('active',i===state.slot));tools.forEach((t,i)=>t.visible=state.mode!=='spectator'&&i===state.slot);if(state.mode==='spectator'){ui.chapter.innerHTML='SPECTATOR MODE <b>•</b> FREE FLIGHT';ui.objective.textContent='WASD move · SPACE up · CTRL down · SHIFT boost';}else if(state.location==='warehouse'){ui.chapter.innerHTML='GROW ROOM 01 <b>•</b> NIGHT SHIFT';ui.objective.textContent=state.buds?`Review ${VENDOR_NAME} stock claims`:pots.some(p=>stageFor(p.growth)===5)?'Harvest the mature plant with trimmers':pots.some(p=>p.growth>0)?'Raise a plant to full bloom':'Plant a seed in an empty pot';}else if(state.location==='street'){ui.chapter.innerHTML='STOCKDEALER CITY <b>•</b> NIGHT';ui.objective.textContent='Approach a door and press E to enter';}else{ui.chapter.innerHTML=`${state.location==='shop-interior'?'SHOP':state.location==='restaurant-interior'?'RESTAURANT':'HOUSE'} INSTANCE <b>•</b> PRIVATE`;ui.objective.textContent='Explore the instance or use the door to leave';}updateClaimButton();}
if(qaEnabled)globalThis.__robinweedQA={camera,input,state,tools,selectSlot,setView(value,vertical=0){yaw=value;pitch=vertical;},position(){return camera.position.toArray();},setPosition(x,z){camera.position.x=x;camera.position.z=z;},setLocation(value){state.location=value;refresh();},foxWalker(){const actor=streetActors.foxWalker;if(!actor)return null;const bounds=new THREE.Box3().setFromObject(actor);return{position:actor.position.toArray(),rotationY:actor.rotation.y,boundsMin:bounds.min.toArray(),boundsMax:bounds.max.toArray(),mixerTime:foxWalkerMixer?.time??null};},neonCatWalker(){const actor=streetActors.neonCatWalker;if(!actor)return null;const bounds=new THREE.Box3().setFromObject(actor);return{position:actor.position.toArray(),rotationY:actor.rotation.y,boundsMin:bounds.min.toArray(),boundsMax:bounds.max.toArray(),mixerTime:neonCatWalkerMixer?.time??null};},loadingDoor(){return{openAmount:loadingDoorOpen,leafY:loadingDoorLeaf?.position.y??null,target:loadingDoorTarget(state.location,camera.position,loadingDoorPosition)};},pickTool(ndcX,ndcY){const probe=new THREE.Raycaster();probe.setFromCamera(new THREE.Vector2(ndcX,ndcY),camera);const isVisible=object=>{for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;};const hit=probe.intersectObject(tools[state.slot],true).find(result=>isVisible(result.object));if(!hit)return null;return{point:hit.point.toArray(),local:hit.object.worldToLocal(hit.point.clone()).toArray(),uv:hit.uv?.toArray()||null,faceIndex:hit.faceIndex};},openPortal(id){openPortalConfirm(id);},confirmPortal(){applyPendingPortal();},setVendorPanel(open){if(open)openPanel(ui.vendor);else closePanels();},setWallet(wallet){state.walletAddress=wallet;ui.walletAddress.textContent=wallet??'NOT CONNECTED';ui.walletButton.textContent=`WALLET — ${compactWallet(wallet)}`;},property(id){return state.properties.get(id)??null;},openProperty(id){openPropertyPanel(state.properties.get(id));},setPropertyOwner(id,wallet){const property=state.properties.get(id);state.properties.set(id,Object.freeze({...property,owner:wallet,mode:'FRONTEND_PREVIEW'}));},propertyPanel(){return{title:ui.propertyTitle.textContent,status:ui.propertyStatus.textContent,owner:ui.propertyOwner.textContent,action:ui.propertyAction.textContent,disabled:ui.propertyAction.disabled};},usePropertyAction,houseStations(){return houseGrowStations.map((station,index)=>({index,visible:station.visible,position:station.position.toArray()}));},warehouseStations(){return pots.filter(p=>p.location==='warehouse').map(p=>({index:p.index,position:p.group.position.toArray(),stage:stageFor(p.growth)}));},warehouseExpansion(){return warehouseExpansionObjects.map(object=>({label:object.userData.qaLabel??null,visible:object.visible,position:object.position.toArray(),bounds:new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray()}));},setPot(index,growth,seedTicker='HOOD'){const pot=pots[index];pot.growth=growth;pot.water=growth?60:0;pot.seedTicker=growth?seedTicker:null;rebuildPlant(pot);refresh();},plantVariant(index){const pot=pots[index];const overlay=pot.plant?.children.find(child=>child.userData.matureBudTicker);return{growth:pot.growth,seedTicker:pot.seedTicker,budTicker:overlay?.userData.matureBudTicker??null,budColor:overlay?.userData.matureBudColor??null};},setBuds(value){state.buds=value;refresh();}};
function foldDecals(hidden){const matrix=new THREE.Matrix4(),zero=new THREE.Matrix4().makeScale(0,0,0);for(const [mesh,list] of [[backMeshes.dark,backDark],[backMeshes.lit,backLit],...Object.entries(sideGroups).map(([key,list])=>[sideMeshes[key],list])]){if(!list.length)continue;const buffer=(mesh.name.startsWith('house-side-')?sideDecalMatrices:backDecalMatrices)(list);list.forEach((decal,index)=>{if(hidden.has(decal.lot))mesh.setMatrixAt(index,zero);else{matrix.fromArray(buffer,index*16);mesh.setMatrixAt(index,matrix);}});mesh.instanceMatrix.needsUpdate=true;}}
function syncMarcas(){const swapped=new Set(swappedLotIds(MARCAS));for(const swap of BRAND_SWAPS){const on=swapped.has(swap.lot)&&Boolean(brandSwapWrappers[swap.lot]);if(brandSwapWrappers[swap.lot])brandSwapWrappers[swap.lot].visible=on;if(cityPackWrappers[swap.swapsOut])cityPackWrappers[swap.swapsOut].visible=!on;}foldDecals(new Set(hiddenDecalLots(MARCAS).filter(lot=>brandSwapWrappers[lot])));}
function syncIsla(){const island=streetActors.furnitureIsland;if(island)island.visible=ISLA.island;const y=cornerPieceY(ISLA),shown=new Set(cornerPieces(ISLA).map(p=>p.id));for(const [id,mesh] of Object.entries(cornerMeshes)){mesh.visible=shown.has(id);mesh.position.y=y;}cornerPadMesh.visible=ISLA.pad;}
function syncCasas(){const tints=houseTints(CASAS);for(const [id,actor] of houseActors){const t=tints.get(id)??[1,1,1];actor.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){const b=m.userData.baseColor,e=m.userData.baseEmissive;if(!b||!e)continue;m.color.setRGB(b.r*t[0],b.g*t[1],b.b*t[2]);m.emissive.setRGB(e.r*t[0],e.g*t[1],e.b*t[2]);}});}}
function applyG60Walkers(preset=G60){streetWalkerActors.forEach((entry,index)=>{entry.actor.visible=index<preset.walkers;if(entry.action)entry.action.paused=index>=preset.walkers;});}
let toastTimer;function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1800);}
function selectSlot(slot){state.slot=slot;toolKick=.4;refresh();document.querySelector(`.hotbar button[data-slot="${slot}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});}
function activePot(){return state.near?.type==='pot'?state.near.pot:null;}
function resetVisualWatering(){visualWateringSession=null;visualWaterDropCarry=0;visualWateringLastAt=0;visualWateringCompleted=false;visualWateringUi.gauge.classList.remove('show');visualWateringUi.fill.style.width='0%';visualWateringUi.gauge.setAttribute('aria-valuenow','0');visualWateringUi.label.textContent='HOLD TO WATER';}
function startVisualWatering(pot){if(pot.growth===0){showToast('PLANT A SEED FIRST');return;}if(stageFor(pot.growth)>=5){showToast('READY FOR TRIMMERS');return;}const now=performance.now();visualWateringSession=beginVisualWatering(pot.index,now);visualWateringDropCarry=0;visualWateringLastAt=now;visualWateringCompleted=false;visualWateringUi.gauge.classList.add('show');sprayDrops(14);toolKick=1;}
async function useOnchainTool(pot){if(!state.walletAddress)return showToast('CONNECTED WALLET REQUIRED');const warehouse=pot.location==='warehouse';const property=activeProperty();if(!warehouse&&!property)return showToast('OWNED PROPERTY REQUIRED');const plotId=warehouse?pot.index:pot.index-WAREHOUSE_GROW_STATIONS.length;const houseId=warehouse?null:onchainPropertyId(property.id);if(state.slot===0&&wateringIsVisual(economyConfig)){startVisualWatering(pot);return;}let action,args;if(state.slot>=2){const ticker=tickerForSlot(state.slot);if(ticker==='HOOD')return showToast('HOOD STOCK TOKEN UNAVAILABLE');const tickerSeeds=BigInt(state.onchainSnapshot?.seeds?.[ticker]?.remaining??'0');if(tickerSeeds===0n){const ownedTickers=Object.entries(state.onchainSnapshot?.seeds??{}).filter(([,balance])=>BigInt(balance.remaining)>0n).map(([symbol])=>symbol);return showToast(ownedTickers.length?`NO ${ticker} SEEDS · SELECT ${ownedTickers.join(' / ')}`:`NO ${ticker} SEEDS`);}action=warehouse?'plantWarehouse':'plant';args=warehouse?[plotId,`0x${[...new TextEncoder().encode(ticker)].map(byte=>byte.toString(16).padStart(2,'0')).join('').padEnd(64,'0')}`]:[houseId,plotId,`0x${[...new TextEncoder().encode(ticker)].map(byte=>byte.toString(16).padStart(2,'0')).join('').padEnd(64,'0')}`];}else if(state.slot===0){action=warehouse?'waterWarehouse':'water';args=warehouse?[plotId]:[houseId,plotId];}else{action=warehouse?'claimWarehouseHarvest':'claimHarvest';args=warehouse?[plotId,state.walletAddress]:[houseId,plotId,state.walletAddress];}let result;try{result=await executeCultivationAction({action,args,account:state.walletAddress,config:economyConfig,ethereum:globalThis.ethereum});}catch(error){showToast(error?.message==='UNRESOLVED_ECONOMY_OPERATION'?'RECONCILIATION REQUIRED':`${action.toUpperCase()} FAILED SAFELY`);return;}try{await refreshOnchainState();showToast(`${action.toUpperCase()} CONFIRMED · ${result.hash.slice(0,10)}…`);}catch(error){console.warn('Stockdealer · confirmed cultivation awaiting authoritative state',error);showToast(`${action.toUpperCase()} CONFIRMED · STATE SYNC PENDING`);}}
async function useTool(){
  if(state.mode==='spectator')return;
  const pot=activePot();if(!pot)return;
  if(economyConfig.economyActive&&(pot.location==='warehouse'||pot.location==='house-interior'))return useOnchainTool(pot);
  toolKick=1;
  if(state.slot >= 2){const result=plantSeed(pot,state.seeds,tickerForSlot(state.slot));if(!result.changed)return showToast(state.seeds?'POT IS ALREADY OCCUPIED':'NO SEEDS');Object.assign(pot,result.pot);state.seeds=result.seeds;rebuildPlant(pot);showToast(`${pot.seedTicker} SEED PLANTED · WATER ONCE TO START`);}
  if(state.slot===0){if(pot.growth===0)return showToast('PLANT A SEED FIRST');const next=waterPlant(pot);if(next.wateredAt===pot.wateredAt)return showToast(pot.growth>=10?'READY FOR TRIMMERS':'ALREADY WATERED · GROWTH CLOCK ACTIVE');Object.assign(pot,next);rebuildPlant(pot);sprayDrops(14);showToast('WATERED ONCE · NEXT STAGE IN 2 HOURS');}
  if(state.slot===1){const result=harvestPlant(pot);if(!result.changed)return showToast('NOT READY TO HARVEST');Object.assign(pot,result.pot);state.buds+=result.buds;state.claimableStocks[result.ticker]=(state.claimableStocks[result.ticker]||0)+result.buds;rebuildPlant(pot);showToast(`${result.ticker} HARVEST ×${result.buds} · STOCK CLAIM RECORDED`);}
  refresh();
}
function sprayDrops(count){for(let i=0;i<count;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.008,4,3),new THREE.MeshBasicMaterial({color:0x8ad8dc,transparent:true,opacity:.8}));drop.position.copy(camera.position);const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);drop.position.add(dir.multiplyScalar(.7));drop.position.x+=(Math.random()-.5)*.15;scene.add(drop);drop.userData.velocity=new THREE.Vector3((Math.random()-.5)*.02,-.025-Math.random()*.02,(Math.random()-.5)*.02);drop.userData.life=1;particles.push(drop);}}
const particles=[];
function openPanel(panel){if(state.mode==='spectator')return;document.exitPointerLock();panel.classList.remove('hidden');if(panel===ui.vendor)setVendorAnimation(vendorClipForPanel(true));}
let househeadPanel='closed';
function renderHouseheadPanel(){ui.househeadQuestion.classList.toggle('hidden',househeadPanel!=='question');ui.stockdealerSwap.classList.toggle('hidden',househeadPanel!=='swap');}
function openHouseheadQuestion(){if(state.mode==='spectator')return;document.exitPointerLock();househeadPanel=nextHouseheadPanel(househeadPanel,'talk');renderHouseheadPanel();}
function openNeighborGuide(){if(state.mode==='spectator')return;document.exitPointerLock();closePanels();ui.neighborGuide.classList.remove('hidden');}
function closeHouseheadConversation(){househeadPanel=nextHouseheadPanel(househeadPanel,'close');renderHouseheadPanel();canvas.requestPointerLock();}
function closePanels(){ui.vendor.classList.add('hidden');ui.property.classList.add('hidden');ui.wallet.classList.add('hidden');ui.portal.classList.add('hidden');ui.neighborGuide.classList.add('hidden');ui.onchainPurchaseConfirmation.classList.add('hidden');househeadPanel='closed';renderHouseheadPanel();state.pendingPortal=null;setVendorAnimation(vendorClipForPanel(false));}
function openPortalConfirm(id){const config=portalFor(id);if(!config)return;state.pendingPortal=id;document.exitPointerLock();ui.portalTitle.textContent=config.title;ui.portalMessage.textContent=config.message;ui.portalYes.textContent=config.confirm;ui.portal.classList.remove('hidden');}
function cancelPortal(){state.pendingPortal=null;ui.portal.classList.add('hidden');canvas.requestPointerLock();}
function applyPendingPortal(){const config=portalFor(state.pendingPortal);if(!config)return cancelPortal();let spawn=config.spawn;if(state.pendingPortal==='house-exit'&&activeProperty()){spawn=streetSpawnForProperty(activeProperty());state.activePropertyId=null;}state.location=config.target;camera.position.set(spawn.x,1.68,spawn.z);yaw=spawn.yaw;pitch=0;state.pendingPortal=null;ui.portal.classList.add('hidden');refresh();syncMultiplayerLocation();showToast(`${config.target.replace('-', ' ').toUpperCase()} LOADED`);canvas.requestPointerLock();}

function revealLoaderActions(){ui.loaderActions.classList.remove('hidden');}
ui.loaderVideo.addEventListener('timeupdate',()=>{if(trailerButtonsVisible(ui.loaderVideo.currentTime,ui.loaderVideo.duration))revealLoaderActions();});
ui.loaderVideo.addEventListener('ended',()=>{ui.loaderVideo.pause();if(Number.isFinite(ui.loaderVideo.duration))ui.loaderVideo.currentTime=Math.max(0,ui.loaderVideo.duration-1/30);revealLoaderActions();});
ui.loaderVideo.play().catch(()=>{});
function beginSession(mode){if(multiplayerClient&&multiplayerClient.spectator!==(mode==='spectator')){multiplayerGeneration++;multiplayerClient.close();multiplayerClient=null;localServerReady=false;for(const group of remotePlayers.values())scene.remove(group);remotePlayers.clear();}state.mode=mode;ui.loaderVideo.pause();ui.gate.classList.add('hidden');ui.hud.classList.remove('hidden');document.body.classList.toggle('spectator-mode',mode==='spectator');if(mode==='player'){const assigned=assignSessionPlayerSkin(state);state.playerSkin=assigned.playerSkin;loadLocalPlayerSkin(state.playerSkin);}if(mode==='spectator'){state.tokenBalance=null;state.seeds=0;state.buds=0;state.location='street';camera.position.set(0,11,34);yaw=Math.PI;pitch=-.18;}refresh();syncMultiplayerLocation();startStreetAmbience();canvas.requestPointerLock();}
async function enterPlayerSession(){const entryGeneration=++sessionEntryGeneration;const play=document.querySelector('#play');play.disabled=true;play.textContent='CONNECT WALLET · SIGN IN · LOAD PROGRESS';const wallet=await connectPlayerWallet();if(entryGeneration!==sessionEntryGeneration||!wallet||state.walletAddress?.toLowerCase()!==wallet.toLowerCase()||authenticatedWallet?.toLowerCase()!==wallet.toLowerCase()){play.disabled=false;play.textContent='ENTER THE GAME';return;}beginSession('player');}
function enterSpectatorSession(){sessionEntryGeneration++;clearWalletContext();beginSession('spectator');}
document.querySelector('#play').addEventListener('click',enterPlayerSession);
document.querySelector('#spectate').addEventListener('click',enterSpectatorSession);
canvas.addEventListener('pointerdown',()=>{startStreetAmbience();if(state.mode==='spectator'){if(!state.locked)canvas.requestPointerLock();return;}const actions=input.primaryDown();if(actions.some(a=>a.type==='use-tool'))useTool();else if(!state.locked&&ui.vendor.classList.contains('hidden')&&ui.property.classList.contains('hidden')&&ui.wallet.classList.contains('hidden')&&ui.portal.classList.contains('hidden')&&ui.neighborGuide.classList.contains('hidden')&&ui.househeadQuestion.classList.contains('hidden')&&ui.stockdealerSwap.classList.contains('hidden'))canvas.requestPointerLock();});
canvas.addEventListener('pointerup',resetVisualWatering);
canvas.addEventListener('pointercancel',resetVisualWatering);
document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;input.setGameplayEnabled(state.locked);ui.gate.classList.toggle('hidden',state.locked||!ui.hud.classList.contains('hidden'));if(!state.locked)resetVisualWatering();if(state.locked){ui.hud.classList.remove('hidden');closePanels();}});
document.addEventListener('mousemove',e=>{if(!state.locked)return;yaw-=e.movementX*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch-e.movementY*.0022));});
document.addEventListener('keydown',e=>{for(const action of input.keyDown(e.code,e.repeat)){if(state.mode==='spectator')continue;if(action.type==='select-slot')selectSlot(action.slot);if(action.type==='interact'&&state.near?.type==='vendor')openPanel(ui.vendor);if(action.type==='interact'&&state.near?.type==='neighbor-guide')openNeighborGuide();if(action.type==='interact'&&state.near?.type==='househead')openHouseheadQuestion();if(action.type==='interact'&&state.near?.type==='property')openPropertyPanel(state.properties.get(state.near.id));if(action.type==='interact'&&state.near?.type==='portal')openPortalConfirm(state.near.id);}});
document.addEventListener('keyup',e=>input.keyUp(e.code));
window.addEventListener('blur',()=>{input.releaseAll();resetVisualWatering();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetVisualWatering();});
document.querySelectorAll('.hotbar button').forEach(b=>b.addEventListener('click',()=>selectSlot(Number(b.dataset.slot))));
document.querySelector('#wallet').addEventListener('click',()=>openPanel(ui.wallet));
ui.connectWallet.addEventListener('click',connectPlayerWallet);
globalThis.ethereum?.on?.('accountsChanged',handleAccountsChanged);
globalThis.ethereum?.on?.('chainChanged',handleChainChanged);
globalThis.ethereum?.on?.('disconnect',handleWalletDisconnect);
ui.propertyAction.addEventListener('click',usePropertyAction);
vendorBuyButton.addEventListener('click',buySelectedSeeds);
claimHarvestButton.addEventListener('click',claimAvailableHarvest);
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
  pots.forEach(p=>{if(!economyConfig.economyActive){const next=advancePlant(p);if(next.growth!==p.growth){p.growth=next.growth;rebuildPlant(p);refresh();}}if(p.plant&&!p.plant.userData.meshy)p.plant.rotation.y=Math.sin(now*.00065+p.index)*.035;});
  if(vendorPreviewModel)vendorPreviewModel.rotation.y+=dt*.42;if(!ui.vendor.classList.contains('hidden'))vendorPreviewRenderer.render(vendorPreviewScene,vendorPreviewCamera);
  toolKick=Math.max(0,toolKick-dt*3.4);weaponRoot.rotation.x=-Math.sin(toolKick*Math.PI)*.55;weaponRoot.rotation.z=Math.sin(bob)*.018;
  loadingDoorOpen=advanceLoadingDoor(loadingDoorOpen,loadingDoorTarget(state.location,camera.position,loadingDoorPosition),dt);if(loadingDoorLeaf)loadingDoorLeaf.position.y=loadingDoorOpen*loadingDoorTravel;
  if(visualWateringSession){const wallDelta=Math.max(0,now-visualWateringLastAt);visualWateringLastAt=now;visualWateringSession=advanceVisualWatering(visualWateringSession,wallDelta);const stream=visualWaterDrops(visualWaterDropCarry,wallDelta/1000,particles.length);visualWaterDropCarry=stream.carry;if(stream.emitted)sprayDrops(stream.emitted);const percent=Math.round(visualWateringSession.progress*100);visualWateringUi.fill.style.width=`${percent}%`;visualWateringUi.gauge.setAttribute('aria-valuenow',String(percent));visualWateringUi.label.textContent=`HOLD TO WATER · ${percent}%`;if(visualWateringSession.complete&&!visualWateringCompleted){visualWateringCompleted=true;showToast('WATERED VISUALLY · GROWTH REMAINS ONCHAIN');}}
  particles.forEach((p,i)=>{p.position.add(p.userData.velocity);p.userData.velocity.y-=.0015;p.userData.life-=dt*1.7;p.material.opacity=p.userData.life;if(p.userData.life<=0){scene.remove(p);p.geometry?.dispose();p.material?.dispose();particles.splice(i,1);}});
  nightClouds.forEach((cloud,i)=>{cloud.position.x+=dt*(.08+i*.025);if(cloud.position.x>18)cloud.position.x=-18;});
  stars.position.copy(camera.position);
  const moonSkyPosition=moonDiscPosition(camera.position);moonDisc.position.set(moonSkyPosition.x,moonSkyPosition.y,moonSkyPosition.z);
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
