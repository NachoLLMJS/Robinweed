import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProjectionOperations, projectionOperations } from '../server/eventReducer.js';

const foundationId = Buffer.from('4444444444444444444444444444444444444444', 'hex');
const meta = { blockNumber: 100, blockTime: new Date('2026-09-07T17:00:00Z'), transactionHash: `0x${'1'.repeat(64)}`, logIndex: 2, foundationId, wateringMode: 'onchain' };

test('house purchase creates ownership, payment receipt and outbox projections', () => {
  const operations = projectionOperations({ contractName: 'GameCore', eventName: 'HousePurchased', args: { buyer: '0x2222222222222222222222222222222222222222', houseId: 3n, paid: 100n, capacity: 8n }, meta });
  assert.deepEqual(operations.map(operation => operation.kind), ['property', 'payment', 'outbox']);
  assert.equal(operations[0].values.houseId, 3);
  assert.equal(operations[0].values.capacity, 8);
  assert.deepEqual(operations[0].values.foundationId, foundationId);
});

test('vault and crop events map only to their bounded projection operations', () => {
  assert.equal(projectionOperations({ contractName: 'Vault_MSFT', eventName: 'PackCredited', args: { buyer: '0x2222222222222222222222222222222222222222', seeds: 4n, rawAssets: 60n }, meta })[0].kind, 'seed-credit');
  assert.equal(projectionOperations({ contractName: 'GameCore', eventName: 'SeedPlanted', args: { owner: '0x2222222222222222222222222222222222222222', houseId: 3n, plotId: 0n, ticker: `0x${'4d534654'.padEnd(64, '0')}`, rewardPosition: `0x${'3'.repeat(64)}` }, meta })[0].kind, 'crop-plant');
  assert.deepEqual(projectionOperations({ contractName: 'Unknown', eventName: 'Transfer', args: {}, meta }), []);
});

test('warehouse cultivation events project by wallet and plot without a house', () => {
  const owner = '0x2222222222222222222222222222222222222222';
  const ticker = `0x${'4d534654'.padEnd(64, '0')}`;
  const rewardPosition = `0x${'3'.repeat(64)}`;
  const planted = projectionOperations({ contractName: 'GameCore', eventName: 'WarehouseSeedPlanted', args: { owner, plotId: 7n, ticker, rewardPosition }, meta });
  const watered = projectionOperations({ contractName: 'GameCore', eventName: 'WarehousePlantWatered', args: { owner, plotId: 7n, wateredAt: 100n }, meta });
  const claimed = projectionOperations({ contractName: 'GameCore', eventName: 'WarehouseHarvestClaimed', args: { owner, plotId: 7n, ticker, rawAssets: 60n }, meta });
  assert.deepEqual([planted[0]?.kind, watered[0]?.kind, claimed[0]?.kind], ['warehouse-crop-plant', 'warehouse-crop-water', 'warehouse-crop-claim']);
  assert.equal(planted[0].values.plotId, 7);
  assert.deepEqual(planted[0].values.owner, Buffer.from(owner.slice(2), 'hex'));
  assert.equal(planted[0].values.wateredAt, null);
  const autoGrowing = projectionOperations({ contractName: 'GameCore', eventName: 'WarehouseSeedPlanted', args: { owner, plotId: 7n, ticker, rewardPosition }, meta: { ...meta, wateringMode: 'visual' } });
  assert.equal(autoGrowing[0].values.wateredAt, meta.blockTime);
});

test('state-transition reducers fail when prerequisites affect zero rows', async () => {
  const client = { query: async () => ({ rowCount: 0 }) };
  await assert.rejects(applyProjectionOperations(client, [{ kind: 'seed-consume', values: { rawAssets: '15', blockNumber: 2, foundationId, wallet: Buffer.alloc(20), ticker: 'MSFT' } }]));
  await assert.rejects(applyProjectionOperations(client, [{ kind: 'crop-water', values: { wateredAt: new Date(), blockNumber: 2, foundationId, houseId: 1, plotId: 0 } }]));
  await assert.rejects(applyProjectionOperations(client, [{ kind: 'warehouse-crop-water', values: { wateredAt: new Date(), blockNumber: 2, foundationId, owner: Buffer.alloc(20), plotId: 0 } }]));
});

test('projection reducer rejects events without an explicit Foundation namespace', () => {
  assert.deepEqual(projectionOperations({ contractName: 'GameCore', eventName: 'HousePurchased', args: {}, meta: { ...meta, foundationId: undefined } }), []);
});
