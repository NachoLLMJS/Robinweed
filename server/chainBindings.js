import { AbiCoder, Contract, JsonRpcProvider, getAddress } from 'ethers';
import { quoteHousePurchase, quoteSeedPurchase } from './quoteService.js';
import { readWalletGameState } from './gameStateService.js';

const GAME_CORE_READ_ABI = [
  'function seedSkus(bytes32) view returns (uint256 packPrice,uint32 seedsPerPack,address rewardVault,bool configured)',
  'function houses(uint32) view returns (uint256 price,uint8 capacity,bool configured)',
  'function houseOwner(uint32) view returns (address)',
  'function houseBasket() view returns (bytes32[] tickers,uint16[] weightsBps)',
  'function plants(uint32,uint8) view returns (bytes32 ticker,uint64 plantedAt,uint64 wateredAt,bytes32 rewardPosition,address fundingVault)',
  'function plantStage(uint32,uint8) view returns (uint8)',
  'function warehousePlants(address,uint8) view returns (bytes32 ticker,uint64 plantedAt,uint64 wateredAt,bytes32 rewardPosition,address fundingVault)',
  'function warehousePlantStage(address,uint8) view returns (uint8)',
];
const ROUTER_READ_ABI = [
  'function currency() view returns (address)',
  'function routes(bytes32) view returns (address rewardToken,address rewardVault,address adapter,bool enabled)',
];
const ADAPTER_READ_ABI = ['function pathFor(address tokenIn,address tokenOut) view returns (bytes)','function swapExactInput(address,address,uint256,uint256,uint256,address) returns(uint256)'];
const VAULT_READ_ABI = ['function remainingSeeds(address) view returns (uint256)', 'function unassignedCredit(address) view returns (uint256)'];
const ERC20_SIM_ABI = ['function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)','function approve(address,uint256) returns(bool)'];
const QUOTER_ABI = ['function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)'];
const QUOTER = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';

const createProvider = config => new JsonRpcProvider(config.rpcPrimary, 4663, { staticNetwork: true, batchMaxCount: 1 });
const createQuoteProvider = config => new JsonRpcProvider(config.rpcQuote, 4663, { staticNetwork: true, batchMaxCount: 1 });

export function serializeRpcReads(operation) {
  let tail = Promise.resolve();
  return (...args) => {
    const result = tail.then(() => operation(...args));
    tail = result.catch(() => undefined);
    return result;
  };
}

function bindings(config) {
  if (config?.publicConfig?.economyActive !== true) return null;
  const byName = new Map((config.publicConfig.contracts ?? []).map(contract => [contract.name, contract.address]));
  if (!byName.get('GameCore') || !byName.get('EconomyRouter') || !config.rpcQuote) return null;
  try {
    const provider = createQuoteProvider(config);
    const adapters = new Map();
    const gameCoreAddress = getAddress(byName.get('GameCore'));
    const economyRouterAddress = getAddress(byName.get('EconomyRouter'));
    return {
      gameCore: new Contract(gameCoreAddress, GAME_CORE_READ_ABI, provider),
      router: new Contract(economyRouterAddress, ROUTER_READ_ABI, provider),
      quoter: new Contract(QUOTER, QUOTER_ABI, provider),
      quoteContext: async () => { const block=await provider.getBlock('latest');if(!block||!Number.isSafeInteger(block.number))throw new Error('QUOTE_BLOCK_UNAVAILABLE');return{gameCore:gameCoreAddress,economyRouter:economyRouterAddress,quoteBlock:block.number,quoteBlockHash:block.hash,quoteBlockTimestamp:block.timestamp,deadline:block.timestamp+300}; },
      async quoteRoute({currency,target,adapterAddress,amountIn,receiver,deadline,blockTag,path}) {
        let curve;
        try { [curve]=AbiCoder.defaultAbiCoder().decode(['address','address','bytes'],path);curve=getAddress(curve); }
        catch { const quoted=await this.quoter.quoteExactInput.staticCall(path,amountIn,{blockTag});return Array.isArray(quoted)?quoted[0]:quoted; }
        const currencyToken=new Contract(currency,ERC20_SIM_ABI,provider),targetToken=new Contract(target,ERC20_SIM_ABI,provider),adapter=new Contract(adapterAddress,ADAPTER_READ_ABI,provider);
        const calls=[
          {from:economyRouterAddress,to:getAddress(target),data:targetToken.interface.encodeFunctionData('balanceOf',[receiver]),value:'0x0'},
          {from:curve,to:getAddress(currency),data:currencyToken.interface.encodeFunctionData('transfer',[economyRouterAddress,amountIn]),value:'0x0'},
          {from:economyRouterAddress,to:getAddress(currency),data:currencyToken.interface.encodeFunctionData('approve',[getAddress(adapterAddress),amountIn]),value:'0x0'},
          {from:economyRouterAddress,to:getAddress(adapterAddress),data:adapter.interface.encodeFunctionData('swapExactInput',[getAddress(currency),getAddress(target),amountIn,1n,BigInt(deadline),getAddress(receiver)]),value:'0x0'},
          {from:economyRouterAddress,to:getAddress(target),data:targetToken.interface.encodeFunctionData('balanceOf',[receiver]),value:'0x0'},
        ];
        const simulated=await provider.send('eth_simulateV1',[{blockStateCalls:[{calls}],traceTransfers:false,validation:false},`0x${Number(blockTag).toString(16)}`]);const rows=simulated?.[0]?.calls;
        if(!Array.isArray(rows)||rows.length!==calls.length||rows.some(row=>row?.status!=='0x1'))throw new Error('PONS_ROUTE_QUOTE_FAILED');
        const before=targetToken.interface.decodeFunctionResult('balanceOf',rows[0].returnData)[0],after=targetToken.interface.decodeFunctionResult('balanceOf',rows[4].returnData)[0];if(after<=before)throw new Error('ZERO_QUOTE');return after-before;
      },
      adapterFor(address) {
        const normalized = getAddress(address);
        if (!adapters.has(normalized)) adapters.set(normalized, new Contract(normalized, ADAPTER_READ_ABI, provider));
        return adapters.get(normalized);
      },
    };
  } catch { return null; }
}

export function createQuoteSeedService(config) {
  if (config?.publicConfig?.economyActive !== true) return null;
  const probe = bindings(config);
  if (!probe) return null;
  probe.gameCore.runner.destroy();
  const mainnetChainId = 4663;
  const officialQuoterV2 = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';
  void mainnetChainId; void officialQuoterV2;
  return async input => {
    const chain = bindings(config);
    if (!chain) throw new Error('QUOTE_BINDINGS_UNAVAILABLE');
    const provider = chain.gameCore.runner;
    const abort = () => provider.destroy();
    input.signal?.addEventListener('abort', abort, { once: true });
    try { return await quoteSeedPurchase({ ...input, ...chain, quoteRoute:chain.quoteRoute.bind(chain) }); }
    finally { input.signal?.removeEventListener('abort', abort); provider.destroy(); }
  };
}

export function createQuoteHouseService(config) {
  if (config?.publicConfig?.economyActive !== true) return null;
  const probe = bindings(config);
  if (!probe) return null;
  probe.gameCore.runner.destroy();
  return async input => {
    const chain = bindings(config);
    if (!chain) throw new Error('QUOTE_BINDINGS_UNAVAILABLE');
    const provider = chain.gameCore.runner;
    const abort = () => provider.destroy();
    input.signal?.addEventListener('abort', abort, { once: true });
    try { return await quoteHousePurchase({ ...input, ...chain, quoteRoute:chain.quoteRoute.bind(chain) }); }
    finally { input.signal?.removeEventListener('abort', abort); provider.destroy(); }
  };
}

export function createReadGameStateService(config) {
  const byName = new Map((config.publicConfig.contracts ?? []).map(contract => [contract.name, contract.address]));
  if (!config.rpcPrimary || !byName.get('GameCore')) return null;
  for (const symbol of ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']) if (!byName.get(`Vault_${symbol}`)) return null;
  try { getAddress(byName.get('GameCore')); } catch { return null; }
  const propertyIds = Array.from({ length: 35 }, (_, index) => index + 1);
  return serializeRpcReads(async (address, { signal } = {}) => {
    if (signal?.aborted) {
      const error = new Error('STATE_ABORTED');
      error.code = 'ABORT_ERR';
      throw error;
    }
    const provider = createProvider(config);
    const gameCore = new Contract(getAddress(byName.get('GameCore')), GAME_CORE_READ_ABI, provider);
    const vaults = new Map();
    for (const symbol of ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']) vaults.set(symbol, new Contract(getAddress(byName.get(`Vault_${symbol}`)), VAULT_READ_ABI, provider));
    const abort = () => provider.destroy();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const block = await provider.getBlock('latest');
      if (!block || !Number.isSafeInteger(block.number) || !/^0x[0-9a-fA-F]{64}$/.test(block.hash ?? '')) throw new Error('STATE_BLOCK_UNAVAILABLE');
      return await readWalletGameState({ address, gameCore, propertyIds, vaults, blockTag: block.number, blockHash: block.hash });
    }
    finally { signal?.removeEventListener('abort', abort); provider.destroy(); }
  });
}
