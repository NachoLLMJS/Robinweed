import { STREET_LAYOUT } from './streetLifeState.js';
import { cityBuildingFor } from './navigationState.js';

const EXCLUDED_PROPERTY_ASSETS = new Set(['cityPackKfc', 'cityPackDiner', 'restaurant']);
const propertyKey = ({ x, z }) => `${x}:${z}`;
const replacements = new Map(STREET_LAYOUT.cityPackBuildings.map(building => [propertyKey(building), building]));

function capacityForBuilding(building) {
  if ((building.height ?? 5.4) > 12) return 15;
  if ((building.height ?? 5.4) > 6) return 8;
  return 4;
}

function propertyRecord(building, index, prefix = 'RW') {
  const width = building.maxWidthX ?? 6;
  const depth = building.maxDepthZ ?? 6;
  return Object.freeze({
    id: building.id ?? `${prefix}-${String(index + 1).padStart(3, '0')}`,
    asset: building.asset ?? 'residentialHouse',
    x: building.x,
    z: building.z,
    width,
    depth,
    capacity: capacityForBuilding(building),
    purchasePrice: null,
    owner: null,
    mode: 'UNOWNED',
    approachRadius: Math.max(width, depth) / 2 + 1.35,
  });
}

const baseBuildings = [
  ...STREET_LAYOUT.houses.filter((building, index) => index !== 0),
  ...STREET_LAYOUT.branchHouses,
  ...STREET_LAYOUT.infillHouses.filter(building => building.asset !== 'infillHouse5'),
].filter(building => !replacements.has(propertyKey(building)));

const replacementProperties = STREET_LAYOUT.cityPackBuildings
  .filter(building => !EXCLUDED_PROPERTY_ASSETS.has(building.asset));

const startWest = cityBuildingFor('shop');
const startEast = cityBuildingFor('house');

export const HOUSE_PROPERTIES = Object.freeze([
  propertyRecord({ id: 'START-WEST', asset: 'residential9004', x: startWest.positionX, z: startWest.positionZ, maxWidthX: 4.2, maxDepthZ: 6, height: 5.4 }, 0, 'START'),
  propertyRecord({ id: 'START-EAST', asset: 'cuteHouseV5', x: startEast.positionX, z: startEast.positionZ, maxWidthX: 5.975, maxDepthZ: 6.18, height: 5.8 }, 1, 'START'),
  ...baseBuildings.map((building, index) => propertyRecord(building, index, 'HOME')),
  ...replacementProperties.map((building, index) => propertyRecord(building, index, 'BLOCK')),
]);

export function propertyNear(position, properties = HOUSE_PROPERTIES) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const property of properties) {
    const distance = Math.hypot(position.x - property.x, position.z - property.z);
    if (distance <= property.approachRadius && distance < nearestDistance) {
      nearest = property;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function purchasePreview(property, wallet) {
  if (!property || property.owner || !/^0x[0-9a-f]{40}$/i.test(wallet ?? '')) return null;
  return Object.freeze({ ...property, owner: wallet, mode: 'FRONTEND_PREVIEW' });
}

export function propertyAccess(property, wallet) {
  if (!property?.owner) return 'AVAILABLE';
  if (wallet && property.owner.toLowerCase() === wallet.toLowerCase()) return 'OWNER';
  return 'OCCUPIED';
}

export function streetSpawnForProperty(property) {
  const mainStreet = { x: Math.sign(property.x || 1) * 5.4, z: property.z, yaw: property.x < 0 ? -Math.PI / 2 : Math.PI / 2 };
  const branchStreet = property.z < STREET_LAYOUT.intersectionZ
    ? { x: property.x, z: 29.5, yaw: 0 }
    : { x: property.x, z: 38.5, yaw: Math.PI };
  const mainDistance = Math.abs(property.x - mainStreet.x);
  const branchDistance = Math.abs(property.z - branchStreet.z);
  return branchDistance < mainDistance ? branchStreet : mainStreet;
}
