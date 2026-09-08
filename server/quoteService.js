import { encodeBytes32String, getAddress } from 'ethers';

const SUPPORTED_STOCKS = new Set(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']);
const BPS = 10_000n;
const REWARD_BPS = 6_000n;

function validatedQuoteContext(context) {
  if (!context || !Number.isSafeInteger(context.quoteBlock) || context.quoteBlock < 0 || !/^0x[0-9a-fA-F]{64}$/.test(context.quoteBlockHash ?? '') || !Number.isSafeInteger(context.quoteBlockTimestamp) || context.quoteBlockTimestamp < 0 || context.deadline !== context.quoteBlockTimestamp + 300 || !/^0x[0-9a-fA-F]{40}$/.test(context.gameCore ?? '') || !/^0x[0-9a-fA-F]{40}$/.test(context.economyRouter ?? '')) throw new Error('INVALID_QUOTE_CONTEXT');
  return context;
}

function abortable(signal, work) {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(new Error('QUOTE_ABORTED'));
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new Error('QUOTE_ABORTED'));
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

async function quoteSeedPurchaseWork({ symbol, packs, slippageBps, gameCore, router, adapterFor, quoter, quoteContext }) {
  if (!SUPPORTED_STOCKS.has(symbol) || !Number.isInteger(packs) || packs < 1 || packs > 100 || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 500) {
    throw new Error('INVALID_QUOTE_REQUEST');
  }
  const ticker = encodeBytes32String(symbol);
  const context = validatedQuoteContext(await quoteContext());
  const block = { blockTag: context.quoteBlock };
  const [packPrice,, skuVault, skuConfigured] = await gameCore.seedSkus(ticker, block);
  const [stockToken, routeVault, adapterAddress, routeEnabled] = await router.routes(ticker, block);
  if (!skuConfigured || !routeEnabled || packPrice <= 0n || packPrice % 5n !== 0n || getAddress(skuVault) !== getAddress(routeVault)) throw new Error('ROUTE_NOT_READY');
  const currency = await router.currency(block);
  const adapter = adapterFor(adapterAddress);
  const path = await adapter.pathFor(currency, stockToken, block);
  if (!/^0x[0-9a-fA-F]{6,}$/.test(path) || path.length % 2 !== 0) throw new Error('PATH_NOT_READY');
  const totalPrice = packPrice * BigInt(packs);
  const rewardInput = totalPrice * REWARD_BPS / BPS;
  const quoted = await quoter.quoteExactInput.staticCall(path, rewardInput, block);
  const quotedStockOut = Array.isArray(quoted) ? quoted[0] : quoted;
  if (quotedStockOut <= 0n) throw new Error('ZERO_QUOTE');
  const minimumStockOut = (quotedStockOut * (BPS - BigInt(slippageBps)) + BPS - 1n) / BPS;
  if (minimumStockOut <= 0n) throw new Error('ZERO_MINIMUM');
  return Object.freeze({
    symbol,
    ticker,
    chainId: 4663,
    gameCore: context.gameCore,
    economyRouter: context.economyRouter,
    currency: getAddress(currency),
    quoteBlock: context.quoteBlock,
    quoteBlockHash: context.quoteBlockHash,
    quoteBlockTimestamp: context.quoteBlockTimestamp,
    deadline: context.deadline,
    packs,
    totalPrice: totalPrice.toString(),
    rewardInput: rewardInput.toString(),
    quotedStockOut: quotedStockOut.toString(),
    minimumStockOut: minimumStockOut.toString(),
  });
}

export function quoteSeedPurchase(input) {
  return abortable(input?.signal, quoteSeedPurchaseWork(input));
}

async function quoteHousePurchaseWork({ houseId, slippageBps, gameCore, router, adapterFor, quoter, quoteContext }) {
  if (!Number.isInteger(houseId) || houseId < 1 || houseId > 0xffffffff || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 500) throw new Error('INVALID_HOUSE_QUOTE_REQUEST');
  const context = validatedQuoteContext(await quoteContext());
  const block = { blockTag: context.quoteBlock };
  const [[price, capacity, configured], owner, basket] = await Promise.all([gameCore.houses(houseId, block), gameCore.houseOwner(houseId, block), gameCore.houseBasket(block)]);
  if (!configured || price <= 0n || price % 5n !== 0n || getAddress(owner) !== '0x0000000000000000000000000000000000000000') throw new Error('HOUSE_NOT_AVAILABLE');
  const [tickersLike, weightsLike] = basket;
  const tickers = [...tickersLike];
  const weights = [...weightsLike];
  if (!tickers.length || tickers.length !== weights.length || weights.reduce((sum, value) => sum + value, 0n) !== BPS) throw new Error('HOUSE_BASKET_NOT_READY');
  const currency = await router.currency(block);
  const rewardInput = price * REWARD_BPS / BPS;
  let allocated = 0n;
  const quotedStockOuts = [];
  const minimumOuts = [];
  for (let index = 0; index < tickers.length; index += 1) {
    const [stockToken,, adapterAddress, enabled] = await router.routes(tickers[index], block);
    if (!enabled) throw new Error('ROUTE_NOT_READY');
    const routeInput = index + 1 === tickers.length ? rewardInput - allocated : rewardInput * weights[index] / BPS;
    allocated += routeInput;
    if (routeInput <= 0n) throw new Error('ZERO_ROUTE_INPUT');
    const path = await adapterFor(adapterAddress).pathFor(currency, stockToken, block);
    if (!/^0x[0-9a-fA-F]{6,}$/.test(path) || path.length % 2 !== 0) throw new Error('PATH_NOT_READY');
    const result = await quoter.quoteExactInput.staticCall(path, routeInput, block);
    const output = Array.isArray(result) ? result[0] : result;
    const minimum = (output * (BPS - BigInt(slippageBps)) + BPS - 1n) / BPS;
    if (output <= 0n || minimum <= 0n) throw new Error('ZERO_QUOTE');
    quotedStockOuts.push(output.toString());
    minimumOuts.push(minimum.toString());
  }
  return Object.freeze({ houseId, chainId: 4663, gameCore: context.gameCore, economyRouter: context.economyRouter, currency: getAddress(currency), quoteBlock: context.quoteBlock, quoteBlockHash: context.quoteBlockHash, quoteBlockTimestamp: context.quoteBlockTimestamp, deadline: context.deadline, capacity: Number(capacity), totalPrice: price.toString(), tickers, quotedStockOuts, minimumOuts });
}

export function quoteHousePurchase(input) {
  return abortable(input?.signal, quoteHousePurchaseWork(input));
}
