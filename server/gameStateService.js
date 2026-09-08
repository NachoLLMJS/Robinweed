import { decodeBytes32String, getAddress } from 'ethers';

const ZERO = '0x0000000000000000000000000000000000000000';

export async function readWalletGameState({ address, gameCore, propertyIds, vaults, blockTag = null, blockHash = null }) {
  const wallet = getAddress(address);
  if (!Array.isArray(propertyIds) || !gameCore || !(vaults instanceof Map)) throw new Error('INVALID_STATE_REQUEST');
  if (blockTag !== null && (!Number.isSafeInteger(blockTag) || blockTag < 0 || !/^0x[0-9a-fA-F]{64}$/.test(blockHash ?? ''))) throw new Error('INVALID_STATE_BLOCK');
  const overrides = blockTag === null ? [] : [{ blockTag }];
  const properties = await Promise.all(propertyIds.map(async houseId => {
    const [[price, capacity, configured], owner] = await Promise.all([gameCore.houses(houseId, ...overrides), gameCore.houseOwner(houseId, ...overrides)]);
    const normalizedCapacity = Number(capacity);
    const isConfigured = Boolean(configured);
    if ((isConfigured && ![4, 8, 15].includes(normalizedCapacity)) || (!isConfigured && normalizedCapacity !== 0)) throw new Error('INVALID_PROPERTY_CAPACITY');
    return { houseId, price: price.toString(), capacity: normalizedCapacity, configured: isConfigured, owner: getAddress(owner) };
  }));
  const crops = [];
  for (const property of properties) {
    if (property.owner !== wallet) continue;
    for (let plotId = 0; plotId < property.capacity; plotId += 1) {
      const [plant, stage] = await Promise.all([gameCore.plants(property.houseId, plotId, ...overrides), gameCore.plantStage(property.houseId, plotId, ...overrides)]);
      const [ticker, plantedAt, wateredAt] = plant;
      if (ticker === `0x${'0'.repeat(64)}`) continue;
      crops.push({ houseId: property.houseId, plotId, ticker: decodeBytes32String(ticker), plantedAt: Number(plantedAt), wateredAt: Number(wateredAt), stage: Number(stage) });
    }
  }
  const seeds = {};
  for (const [symbol, vault] of vaults) {
    const [remaining, unassigned] = await Promise.all([vault.remainingSeeds(wallet, ...overrides), vault.unassignedCredit(wallet, ...overrides)]);
    seeds[symbol] = { remaining: remaining.toString(), unassignedRawCredit: unassigned.toString() };
  }
  return Object.freeze({ chainId: 4663, address: wallet, blockNumber: blockTag, blockHash, properties, crops, seeds });
}

export { ZERO as ZERO_ADDRESS };
