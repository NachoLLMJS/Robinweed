import test from 'node:test';
import assert from 'node:assert/strict';
import { corroboratedFinalizedHead } from '../server/indexerCore.js';

const block = { number: 1234, hash: `0x${'a'.repeat(64)}` };
const provider = ({ chainId = 4663n, finalized = block } = {}) => ({
  getNetwork: async () => ({ chainId }),
  getBlock: async tag => tag === 'finalized' ? finalized : null,
});

test('indexer promotes only a corroborated finalized Robinhood mainnet head', async () => {
  assert.deepEqual(await corroboratedFinalizedHead(provider(), provider()), block);
});

test('indexer halts on wrong chain, missing finalized tag, or provider disagreement', async () => {
  await assert.rejects(corroboratedFinalizedHead(provider({ chainId: 1n }), provider()));
  await assert.rejects(corroboratedFinalizedHead(provider({ finalized: null }), provider()));
  await assert.rejects(corroboratedFinalizedHead(provider(), provider({ finalized: { ...block, hash: `0x${'b'.repeat(64)}` } })));
});
