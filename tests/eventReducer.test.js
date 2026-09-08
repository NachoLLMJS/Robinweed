import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProjectionOperations, projectionOperations } from '../server/eventReducer.js';

const meta = { blockNumber: 100, blockTime: new Date('2026-09-07T17:00:00Z'), transactionHash: `0x${'1'.repeat(64)}`, logIndex: 2 };

test('house purchase creates ownership, payment receipt and outbox projections', () => {
  const operations = projectionOperations({ contractName: 'GameCore', eventName: 'HousePurchased', args: { buyer: '0x2222222222222222222222222222222222222222', houseId: 3n, paid: 100n, capacity: 8n }, meta });
  assert.deepEqual(operations.map(operation => operation.kind), ['property', 'payment', 'outbox']);
  assert.equal(operations[0].values.houseId, 3);
  assert.equal(operations[0].values.capacity, 8);
});

test('vault and crop events map only to their bounded projection operations', () => {
  assert.equal(projectionOperations({ contractName: 'Vault_MSFT', eventName: 'PackCredited', args: { buyer: '0x2222222222222222222222222222222222222222', seeds: 4n, rawAssets: 60n }, meta })[0].kind, 'seed-credit');
  assert.equal(projectionOperations({ contractName: 'GameCore', eventName: 'SeedPlanted', args: { owner: '0x2222222222222222222222222222222222222222', houseId: 3n, plotId: 0n, ticker: `0x${'4d534654'.padEnd(64, '0')}`, rewardPosition: `0x${'3'.repeat(64)}` }, meta })[0].kind, 'crop-plant');
  assert.deepEqual(projectionOperations({ contractName: 'Unknown', eventName: 'Transfer', args: {}, meta }), []);
});

test('state-transition reducers fail when prerequisites affect zero rows', async () => {
  const client = { query: async () => ({ rowCount: 0 }) };
  await assert.rejects(applyProjectionOperations(client, [{ kind: 'seed-consume', values: { rawAssets: '15', blockNumber: 2, wallet: Buffer.alloc(20), ticker: 'MSFT' } }]));
  await assert.rejects(applyProjectionOperations(client, [{ kind: 'crop-water', values: { wateredAt: new Date(), blockNumber: 2, houseId: 1, plotId: 0 } }]));
});
