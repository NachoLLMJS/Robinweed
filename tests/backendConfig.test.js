import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackendConfig } from '../server/config.js';

const valid = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@private-host:5432/stockdealer',
  DATABASE_SSL_MODE: 'private',
  SESSION_SECRET: 'x'.repeat(48),
  PUBLIC_APP_ORIGIN: 'https://stockdealer.example',
  ROBINHOOD_CHAIN_ID: '4663',
  ROBINHOOD_RPC_PRIMARY: 'https://primary.example/v2/key',
  ROBINHOOD_RPC_SECONDARY: 'https://secondary.example/key',
  CONTRACT_MANIFEST_JSON: '{"chainId":4663,"economyActive":false,"currency":null,"contracts":[]}',
  INDEXER_START_BLOCK: '0',
  FINALITY_MODE: 'corroborated-finalized-tag',
};

test('backend config accepts only complete Robinhood Chain Mainnet production settings', () => {
  const config = loadBackendConfig(valid);
  assert.equal(config.chainId, 4663);
  assert.equal(config.port, 3000);
  assert.equal(config.publicOrigin, 'https://stockdealer.example');
});

test('backend loads the versioned mainnet manifest from a repository path instead of a giant environment value', () => {
  const config = loadBackendConfig({
    ...valid,
    CONTRACT_MANIFEST_JSON: '',
    CONTRACT_MANIFEST_PATH: 'config/mainnet-contract-manifest.json',
    INDEXER_START_BLOCK: '57826741',
  });
  assert.equal(config.contractManifest.contracts.length, 10);
  assert.equal(config.contractManifest.economyActive, false);
  assert.equal(config.contractManifest.currency, null);
});

test('backend config fails closed for wrong chain, insecure origin, weak secret, or deployer keys', () => {
  for (const override of [
    { ROBINHOOD_CHAIN_ID: '46630' },
    { PUBLIC_APP_ORIGIN: 'http://stockdealer.example' },
    { PUBLIC_APP_ORIGIN: 'https://stockdealer.example/' },
    { ROBINHOOD_RPC_SECONDARY: valid.ROBINHOOD_RPC_PRIMARY },
    { ROBINHOOD_RPC_SECONDARY: 'https://primary.example/other-key' },
    { SESSION_SECRET: 'short' },
    { DATABASE_SSL_MODE: 'verify-full', DATABASE_CA_BASE64: '' },
    { DEPLOYER_PRIVATE_KEY: `0x${'1'.repeat(64)}` },
  ]) assert.throws(() => loadBackendConfig({ ...valid, ...override }));
});

test('active manifests reject empty or semantically incomplete ABIs', () => {
  const baseEntry = (name, index, abi) => ({ name, address: `0x${String(index + 10).padStart(40, '0')}`, deploymentBlock: 1, expectedCodeHash: `0x${'1'.repeat(64)}`, abiVersion: '1', abi });
  const names = ['EconomyRouter', 'GameCore', 'UniswapV3Adapter', 'Vault_AAPL', 'Vault_GOOGL', 'Vault_MSFT', 'Vault_MSTR', 'Vault_NVDA', 'Vault_QQQ', 'Vault_TSLA'];
  const manifest = { chainId: 4663, economyActive: true, currency: `0x${'2'.repeat(40)}`, houseBasketSymbols: ['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'], contracts: names.map((name, index) => baseEntry(name, index, [])) };
  assert.throws(() => loadBackendConfig({ ...valid, CONTRACT_MANIFEST_JSON: JSON.stringify(manifest) }));
  manifest.contracts = manifest.contracts.map(entry => ({ ...entry, abi: ['event Irrelevant()'] }));
  assert.throws(() => loadBackendConfig({ ...valid, CONTRACT_MANIFEST_JSON: JSON.stringify(manifest) }));
  const gameAbi = [
    'event HousePurchased(address indexed buyer,uint32 indexed houseId,uint256 paid,uint8 capacity)',
    'event SeedPacksPurchased(address indexed buyer,bytes32 indexed ticker,uint32 packs,uint32 seeds,uint256 paid,uint256 rawStockCredit)',
    'event SeedPlanted(address indexed owner,uint32 indexed houseId,uint8 indexed plotId,bytes32 ticker,bytes32 rewardPosition)',
    'event PlantWatered(address indexed owner,uint32 indexed houseId,uint8 indexed plotId,uint64 wateredAt)',
    'event HarvestClaimed(address indexed owner,uint32 indexed houseId,uint8 indexed plotId,bytes32 ticker,uint256 rawAssets)',
  ];
  const vaultAbi = ['event PackCredited(address indexed buyer,uint32 seeds,uint256 rawAssets)', 'event SeedConsumed(address indexed buyer,bytes32 indexed positionId,uint256 rawAssets)', 'function remainingSeeds(address) view returns(uint256)', 'function unassignedCredit(address) view returns(uint256)'];
  manifest.contracts = manifest.contracts.map(entry => ({ ...entry, abi: entry.name === 'GameCore' ? gameAbi : entry.name === 'EconomyRouter' ? ['function currency() view returns(address)', 'function routes(bytes32) view returns(address,address,address,bool)'] : entry.name === 'UniswapV3Adapter' ? ['function pathFor(address,address) view returns(bytes)'] : vaultAbi }));
  assert.equal(loadBackendConfig({ ...valid, CONTRACT_MANIFEST_JSON: JSON.stringify(manifest) }).contractManifest.economyActive, true);
  assert.throws(() => loadBackendConfig({ ...valid, INDEXER_START_BLOCK: '2', CONTRACT_MANIFEST_JSON: JSON.stringify(manifest) }));
});
