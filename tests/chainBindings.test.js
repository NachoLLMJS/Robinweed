import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQuoteSeedService, createReadGameStateService } from '../server/chainBindings.js';

test('quote bindings stay absent while economy is inactive or required contracts are missing', () => {
  assert.equal(createQuoteSeedService({ publicConfig: { economyActive: false, contracts: [] } }), null);
  assert.equal(createQuoteSeedService({ publicConfig: { economyActive: true, contracts: [] } }), null);
});

test('quote bindings pin Robinhood mainnet and the official QuoterV2', () => {
  const source = createQuoteSeedService.toString();
  assert.match(source, /4663/);
  assert.match(source, /0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7/i);
});

test('read-only wallet state bindings remain available while purchases are paused and bound RPC batches', () => {
  assert.match(readFileSync(new URL('../server/chainBindings.js', import.meta.url), 'utf8'), /batchMaxCount:\s*10/);
  const contracts = ['GameCore','Vault_AAPL','Vault_GOOGL','Vault_MSFT','Vault_MSTR','Vault_NVDA','Vault_QQQ','Vault_TSLA']
    .map((name, index) => ({ name, address: `0x${String(index + 1).padStart(40, '0')}` }));
  const service = createReadGameStateService({
    rpcPrimary: 'https://rpc.mainnet.chain.robinhood.com',
    publicConfig: { economyActive: false, contracts },
  });
  assert.equal(typeof service, 'function');
});
