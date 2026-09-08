import { getAddress } from 'ethers';

const SYMBOLS = Object.freeze(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']);
const TOKEN_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const PATH = /^0x(?:[0-9a-fA-F]{2}){43,}$/;

export function validateActivationConfig(config) {
  if (!config || config.chainId !== 4663 || config.expectedTokenSymbol !== 'STOCKDEALER' || config.activateAfterValidation !== true) throw new Error('ACTIVATION_NOT_AUTHORIZED');
  const tokenAddress = getAddress(config.tokenAddress);
  const burnProbeHolder = getAddress(config.burnProbeHolder);
  if (burnProbeHolder === tokenAddress) throw new Error('INVALID_BURN_PROBE_HOLDER');
  if (!/^0x[0-9a-fA-F]{64}$/.test(config.expectedTokenCodeHash ?? '')) throw new Error('INVALID_TOKEN_CODE_HASH');
  if (!TOKEN_AMOUNT.test(config.seedPackPriceTokens ?? '') || Number(config.seedPackPriceTokens) <= 0 || config.seedsPerPack !== 4) throw new Error('INVALID_SEED_PRICE');

  if (!Array.isArray(config.houseBasket) || config.houseBasket.length !== SYMBOLS.length) throw new Error('INVALID_HOUSE_BASKET');
  const basketSymbols = config.houseBasket.map(item => item.symbol).sort();
  if (JSON.stringify(basketSymbols) !== JSON.stringify([...SYMBOLS].sort())) throw new Error('INVALID_HOUSE_BASKET_SYMBOLS');
  let totalWeight = 0;
  for (const item of config.houseBasket) {
    if (!Number.isInteger(item.weightBps) || item.weightBps <= 0) throw new Error('INVALID_HOUSE_BASKET_WEIGHT');
    totalWeight += item.weightBps;
  }
  if (totalWeight !== 10_000) throw new Error('INVALID_HOUSE_BASKET_TOTAL');

  if (!config.paths || Object.keys(config.paths).sort().join(',') !== [...SYMBOLS].sort().join(',')) throw new Error('INVALID_PATH_SET');
  for (const symbol of SYMBOLS) if (!PATH.test(config.paths[symbol] ?? '') || (config.paths[symbol].length - 2 - 40) % 46 !== 0) throw new Error(`INVALID_PATH:${symbol}`);

  if (!Array.isArray(config.houses) || config.houses.length !== 35) throw new Error('INVALID_HOUSE_CATALOG');
  const ids = new Set();
  const names = new Set();
  for (const house of config.houses) {
    if (!Number.isInteger(house.onchainId) || house.onchainId < 1 || house.onchainId > 35 || ids.has(house.onchainId) || typeof house.id !== 'string' || names.has(house.id)) throw new Error('INVALID_HOUSE_ID');
    if (![4, 8, 15].includes(house.capacity) || !TOKEN_AMOUNT.test(house.priceTokens ?? '') || Number(house.priceTokens) <= 0) throw new Error('INVALID_HOUSE_CONFIGURATION');
    ids.add(house.onchainId); names.add(house.id);
  }
  for (let id = 1; id <= 35; id += 1) if (!ids.has(id)) throw new Error('INCOMPLETE_HOUSE_IDS');

  return Object.freeze({ ...config, tokenAddress, burnProbeHolder, symbols: SYMBOLS });
}
