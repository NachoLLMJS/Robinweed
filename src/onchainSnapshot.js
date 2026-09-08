const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^(?:0|[1-9]\d{0,77})$/;
const SYMBOLS = Object.freeze(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']);
const SYMBOL_SET = new Set(SYMBOLS);

export function validateOnchainSnapshot(snapshot, expectedAddress) {
  if (!snapshot || snapshot.chainId !== 4663 || !ADDRESS.test(snapshot.address ?? '') || snapshot.address.toLowerCase() !== expectedAddress?.toLowerCase() || !Number.isSafeInteger(snapshot.blockNumber) || snapshot.blockNumber < 0 || !/^0x[0-9a-fA-F]{64}$/.test(snapshot.blockHash ?? '')) throw new Error('INVALID_ONCHAIN_SNAPSHOT');
  if (!Array.isArray(snapshot.properties) || snapshot.properties.length > 35 || !Array.isArray(snapshot.crops) || snapshot.crops.length > 525 || !snapshot.seeds || typeof snapshot.seeds !== 'object' || Array.isArray(snapshot.seeds)) throw new Error('INVALID_SNAPSHOT_SHAPE');
  const houseIds = new Set();
  const propertiesByHouseId = new Map();
  for (const property of snapshot.properties) {
    if (!Number.isInteger(property?.houseId) || property.houseId < 1 || property.houseId > 35 || houseIds.has(property.houseId) || !DECIMAL.test(property.price ?? '') || ![4, 8, 15].includes(property.capacity) || typeof property.configured !== 'boolean' || !ADDRESS.test(property.owner ?? '')) throw new Error('INVALID_PROPERTY_STATE');
    houseIds.add(property.houseId);
    propertiesByHouseId.set(property.houseId, property);
  }
  const cropKeys = new Set();
  for (const crop of snapshot.crops) {
    const key = `${crop?.houseId}:${crop?.plotId}`;
    const property = propertiesByHouseId.get(crop?.houseId);
    if (!Number.isInteger(crop?.houseId) || crop.houseId < 1 || crop.houseId > 35 || !property || property.owner.toLowerCase() !== expectedAddress.toLowerCase() || !Number.isInteger(crop.plotId) || crop.plotId < 0 || crop.plotId >= property.capacity || cropKeys.has(key) || !SYMBOL_SET.has(crop.ticker) || !Number.isSafeInteger(crop.plantedAt) || crop.plantedAt < 0 || !Number.isSafeInteger(crop.wateredAt) || crop.wateredAt < 0 || !Number.isInteger(crop.stage) || crop.stage < 1 || crop.stage > 5) throw new Error('INVALID_CROP_STATE');
    cropKeys.add(key);
  }
  if (Object.keys(snapshot.seeds).sort().join(',') !== [...SYMBOLS].sort().join(',')) throw new Error('INVALID_SEED_CATALOG');
  let totalSeeds = 0n;
  for (const symbol of SYMBOLS) {
    const balance = snapshot.seeds[symbol];
    if (!DECIMAL.test(balance?.remaining ?? '') || !DECIMAL.test(balance?.unassignedRawCredit ?? '')) throw new Error('INVALID_SEED_BALANCE');
    totalSeeds += BigInt(balance.remaining);
  }
  return Object.freeze({ ...snapshot, totalSeeds: totalSeeds.toString() });
}
