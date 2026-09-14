import { AbiCoder, getAddress } from 'ethers';

const SYMBOLS = Object.freeze(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']);
const STOCKS = Object.freeze({ AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74', MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09', NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d' });
const TOKEN_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const V3_PATH = /^0x(?:[0-9a-fA-F]{2}){43,}$/;
const coder = AbiCoder.defaultAbiCoder();
const FLYCO_TRIAL_TOKEN = '0x8998706EbF337575f05F294036eBfc3D1dE01290';
const ROBINHOOD_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';

export function validatePonsActivationConfig(config) {
  if (!config || config.chainId !== 4663) throw new Error('WRONG_CHAIN');
  const rehearsal = config.rehearsalOnly === true && config.productionReady === false && config.activateAfterValidation === false;
  const production = config.rehearsalOnly === false && config.productionReady === true && config.activateAfterValidation === true;
  const trialMainnet = config.trialMainnet === true && config.rehearsalOnly === false && config.productionReady === false && config.activateAfterValidation === true;
  if (!rehearsal && !production && !trialMainnet) throw new Error('INVALID_ACTIVATION_MODE');
  if (production && config.expectedTokenSymbol !== 'STOCKDEALER') throw new Error('PRODUCTION_TOKEN_SYMBOL_REQUIRED');
  if (typeof config.expectedTokenSymbol !== 'string' || !/^[A-Z0-9]{2,16}$/.test(config.expectedTokenSymbol)) throw new Error('INVALID_TOKEN_SYMBOL');

  const tokenAddress = getAddress(config.tokenAddress);
  if (trialMainnet && (tokenAddress !== FLYCO_TRIAL_TOKEN || config.expectedTokenSymbol !== 'FLYCO')) throw new Error('INVALID_TRIAL_TOKEN');
  const burnProbeHolder = getAddress(config.burnProbeHolder);
  if (burnProbeHolder === tokenAddress) throw new Error('INVALID_BURN_PROBE_HOLDER');
  if (!/^0x[0-9a-fA-F]{64}$/.test(config.expectedTokenCodeHash ?? '')) throw new Error('INVALID_TOKEN_CODE_HASH');
  if (!TOKEN_AMOUNT.test(config.seedPackPriceTokens ?? '') || Number(config.seedPackPriceTokens) <= 0 || config.seedsPerPack !== 4) throw new Error('INVALID_SEED_PRICE');

  if (!Array.isArray(config.houseBasket) || config.houseBasket.length !== SYMBOLS.length) throw new Error('INVALID_HOUSE_BASKET');
  if (JSON.stringify(config.houseBasket.map(item => item.ticker).sort()) !== JSON.stringify([...SYMBOLS].sort())) throw new Error('INVALID_HOUSE_BASKET_SYMBOLS');
  if (config.houseBasket.some(item => !Number.isInteger(item.weightBps) || item.weightBps <= 0) || config.houseBasket.reduce((sum,item) => sum + item.weightBps,0) !== 10_000) throw new Error('INVALID_HOUSE_BASKET_WEIGHT');

  if (!config.paths || Object.keys(config.paths).sort().join(',') !== [...SYMBOLS].sort().join(',')) throw new Error('INVALID_PATH_SET');
  const routes = {};
  for (const symbol of SYMBOLS) {
    try {
      const [curve, pairToken, downstreamPath] = coder.decode(['address','address','bytes'], config.paths[symbol]);
      const normalizedPath = downstreamPath.toLowerCase();
      const pair=getAddress(pairToken), target=getAddress(STOCKS[symbol]);
      if (normalizedPath === '0x') {
        if (pair !== target) throw new Error('BAD_DIRECT_PATH');
      } else {
        if (!V3_PATH.test(downstreamPath) || (downstreamPath.length - 2 - 40) % 46 !== 0) throw new Error('BAD_DOWNSTREAM_PATH');
        const first=getAddress(`0x${normalizedPath.slice(2,42)}`),last=getAddress(`0x${normalizedPath.slice(-40)}`);
        if(first!==(pair === '0x0000000000000000000000000000000000000000' ? ROBINHOOD_WETH : pair)||last!==target)throw new Error('PATH_ENDPOINT_MISMATCH');
      }
      routes[symbol] = Object.freeze({ curve: getAddress(curve), pairToken: getAddress(pairToken), downstreamPath });
    } catch { throw new Error(`INVALID_PONS_ROUTE:${symbol}`); }
  }
  const identities = new Set(Object.values(routes).map(route => `${route.curve}:${route.pairToken}`));
  if (identities.size !== 1) throw new Error('INCONSISTENT_PONS_CURVE');

  if (!Array.isArray(config.houses) || config.houses.length !== 35) throw new Error('INVALID_HOUSE_CATALOG');
  const ids = new Set(), names = new Set();
  for (const house of config.houses) {
    if (!Number.isInteger(house.onchainId) || house.onchainId < 1 || house.onchainId > 35 || ids.has(house.onchainId) || typeof house.id !== 'string' || names.has(house.id)) throw new Error('INVALID_HOUSE_ID');
    if (![4,8,15].includes(house.capacity) || !TOKEN_AMOUNT.test(house.priceTokens ?? '') || Number(house.priceTokens) <= 0) throw new Error('INVALID_HOUSE_CONFIGURATION');
    ids.add(house.onchainId); names.add(house.id);
  }
  for (let id=1;id<=35;id+=1) if (!ids.has(id)) throw new Error('INCOMPLETE_HOUSE_IDS');
  return Object.freeze({ ...config, tokenAddress, burnProbeHolder, routes: Object.freeze(routes), symbols: SYMBOLS });
}
