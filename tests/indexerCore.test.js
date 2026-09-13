import test from 'node:test';
import assert from 'node:assert/strict';
import { corroboratedFinalizedHead } from '../server/indexerCore.js';

const block = { number: 1234, hash: `0x${'a'.repeat(64)}` };
const provider = ({ chainId = 4663n, finalized = block, blocks = {} } = {}) => ({
  getNetwork: async () => ({ chainId }),
  getBlock: async tag => tag === 'finalized' ? finalized : blocks[tag] ?? null,
});

test('indexer promotes only a corroborated finalized Robinhood mainnet head', async () => {
  assert.deepEqual(await corroboratedFinalizedHead(provider(), provider()), block);
});

test('indexer accepts the lower common finalized block when providers advance at different moments', async () => {
  const common = { number: 1200, hash: `0x${'c'.repeat(64)}` };
  const advanced = provider({ finalized: block, blocks: { 1200: common } });
  const lagging = provider({ finalized: common });
  assert.deepEqual(await corroboratedFinalizedHead(advanced, lagging), common);
});

test('indexer halts on wrong chain, missing finalized tag, or provider disagreement', async () => {
  await assert.rejects(corroboratedFinalizedHead(provider({ chainId: 1n }), provider()));
  await assert.rejects(corroboratedFinalizedHead(provider({ finalized: null }), provider()));
  await assert.rejects(corroboratedFinalizedHead(provider(), provider({ finalized: { ...block, hash: `0x${'b'.repeat(64)}` } })));
});
