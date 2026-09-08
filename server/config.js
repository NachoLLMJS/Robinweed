import { z } from 'zod';
import { Interface } from 'ethers';

const requiredAbiMembers = Object.freeze({
  GameCore: Object.freeze({ events: [
    ['HousePurchased(address,uint32,uint256,uint8)', 'buyer,houseId,paid,capacity', '1100'],
    ['SeedPacksPurchased(address,bytes32,uint32,uint32,uint256,uint256)', 'buyer,ticker,packs,seeds,paid,rawStockCredit', '110000'],
    ['SeedPlanted(address,uint32,uint8,bytes32,bytes32)', 'owner,houseId,plotId,ticker,rewardPosition', '11100'],
    ['PlantWatered(address,uint32,uint8,uint64)', 'owner,houseId,plotId,wateredAt', '1110'],
    ['HarvestClaimed(address,uint32,uint8,bytes32,uint256)', 'owner,houseId,plotId,ticker,rawAssets', '11100'],
  ], functions: [] }),
  EconomyRouter: Object.freeze({ events: [], functions: ['currency()', 'routes(bytes32)'] }),
  UniswapV3Adapter: Object.freeze({ events: [], functions: ['pathFor(address,address)'] }),
});

function validateActiveAbi(contract) {
  if (!Array.isArray(contract.abi) || contract.abi.length === 0) throw new Error('empty abi');
  const requirements = contract.name.startsWith('Vault_')
    ? { events: [['PackCredited(address,uint32,uint256)', 'buyer,seeds,rawAssets', '100'], ['SeedConsumed(address,bytes32,uint256)', 'buyer,positionId,rawAssets', '110']], functions: ['remainingSeeds(address)', 'unassignedCredit(address)'] }
    : requiredAbiMembers[contract.name];
  if (!requirements) return;
  const iface = new Interface(contract.abi);
  for (const [event, names, indexed] of requirements.events) {
    const fragment = iface.getEvent(event);
    if (!fragment || fragment.inputs.map(input => input.name).join(',') !== names || fragment.inputs.map(input => input.indexed ? '1' : '0').join('') !== indexed) throw new Error(`missing event ${event}`);
  }
  for (const fn of requirements.functions) if (!iface.getFunction(fn)) throw new Error(`missing function ${fn}`);
}

const httpsUrl = z.string().url().refine(value => new URL(value).protocol === 'https:', 'HTTPS required');
const productionOrigin = httpsUrl.refine(value => new URL(value).origin === value, 'Origin must not contain path, credentials, query, fragment, or trailing slash');
const schema = z.object({
  NODE_ENV: z.literal('production'),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().refine(value => /^postgres(?:ql)?:\/\//.test(value), 'PostgreSQL URL required'),
  DATABASE_SSL_MODE: z.enum(['private','verify-full']),
  DATABASE_CA_BASE64: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  PUBLIC_APP_ORIGIN: productionOrigin,
  ROBINHOOD_CHAIN_ID: z.literal('4663'),
  ROBINHOOD_RPC_PRIMARY: httpsUrl,
  ROBINHOOD_RPC_SECONDARY: httpsUrl,
  CONTRACT_MANIFEST_JSON: z.string().transform((value, context) => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.chainId !== 4663 || typeof parsed.economyActive !== 'boolean' || !Array.isArray(parsed.contracts) || parsed.contracts.length > 20) throw new Error('invalid manifest');
      const names = new Set();
      const addresses = new Set();
      for (const contract of parsed.contracts) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(contract?.name ?? '') || !/^0x[0-9a-fA-F]{40}$/.test(contract?.address ?? '') || !Number.isSafeInteger(contract.deploymentBlock) || contract.deploymentBlock < 0 || !/^0x[0-9a-fA-F]{64}$/.test(contract.expectedCodeHash ?? '') || !/^[A-Za-z0-9._-]{1,32}$/.test(contract.abiVersion ?? '') || !Array.isArray(contract.abi) || names.has(contract.name) || addresses.has(contract.address.toLowerCase())) throw new Error('invalid contract entry');
        names.add(contract.name); addresses.add(contract.address.toLowerCase());
      }
      if (parsed.economyActive) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(parsed.currency ?? '')) throw new Error('invalid currency');
        for (const name of ['EconomyRouter','GameCore','UniswapV3Adapter','Vault_AAPL','Vault_GOOGL','Vault_MSFT','Vault_MSTR','Vault_NVDA','Vault_QQQ','Vault_TSLA']) if (!names.has(name)) throw new Error('missing active contract');
        for (const contract of parsed.contracts) validateActiveAbi(contract);
        const supported=['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'];
        if(!Array.isArray(parsed.houseBasketSymbols)||parsed.houseBasketSymbols.length!==7||[...parsed.houseBasketSymbols].sort().join(',')!==supported.join(','))throw new Error('invalid public house basket');
      }
      return parsed;
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid mainnet contract manifest' });
      return z.NEVER;
    }
  }),
  INDEXER_START_BLOCK: z.coerce.number().int().nonnegative(),
  FINALITY_MODE: z.literal('corroborated-finalized-tag'),
  DEPLOYER_PRIVATE_KEY: z.string().max(0).optional(),
}).passthrough();

export function loadBackendConfig(environment = process.env) {
  const value = schema.parse(environment);
  if (new URL(value.ROBINHOOD_RPC_PRIMARY).hostname === new URL(value.ROBINHOOD_RPC_SECONDARY).hostname) throw new Error('INDEPENDENT_RPC_PROVIDERS_REQUIRED');
  if (value.DATABASE_SSL_MODE === 'verify-full' && !value.DATABASE_CA_BASE64) throw new Error('DATABASE_CA_REQUIRED');
  if (value.CONTRACT_MANIFEST_JSON.economyActive && value.INDEXER_START_BLOCK > Math.min(...value.CONTRACT_MANIFEST_JSON.contracts.map(contract => contract.deploymentBlock))) throw new Error('INDEXER_START_BLOCK_SKIPS_DEPLOYMENT');
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    databaseSsl: value.DATABASE_SSL_MODE === 'private' ? false : Object.freeze({ rejectUnauthorized: true, ca: Buffer.from(value.DATABASE_CA_BASE64, 'base64').toString('utf8') }),
    sessionSecret: value.SESSION_SECRET,
    publicOrigin: value.PUBLIC_APP_ORIGIN,
    chainId: 4663,
    rpcPrimary: value.ROBINHOOD_RPC_PRIMARY,
    rpcSecondary: value.ROBINHOOD_RPC_SECONDARY,
    contractManifest: value.CONTRACT_MANIFEST_JSON,
    publicConfig: Object.freeze({
      chainId: 4663,
      economyActive: value.CONTRACT_MANIFEST_JSON.economyActive === true,
      currency: value.CONTRACT_MANIFEST_JSON.currency ?? null,
      houseBasketSymbols: value.CONTRACT_MANIFEST_JSON.houseBasketSymbols ?? [],
      contracts: value.CONTRACT_MANIFEST_JSON.contracts.map(({ name, address }) => ({ name, address })),
    }),
    indexerStartBlock: value.INDEXER_START_BLOCK,
    finalityMode: value.FINALITY_MODE,
  });
}
