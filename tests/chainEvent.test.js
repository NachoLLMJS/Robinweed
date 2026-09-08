import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizedEventIdentity, serializeEventPayload, validateFinalizedEvent } from '../server/chainEvent.js';

const event = {
  chainId: 4663,
  blockNumber: 100,
  blockHash: `0x${'1'.repeat(64)}`,
  transactionHash: `0x${'2'.repeat(64)}`,
  logIndex: 3,
  contractAddress: `0x${'3'.repeat(40)}`,
  finality: 'FINALIZED',
};

test('indexer derives raw and semantic idempotency keys from finalized logs', () => {
  assert.deepEqual(finalizedEventIdentity(event, new Set([event.contractAddress.toLowerCase()])), {
    rawUid: `4663:${event.blockHash}:${event.transactionHash}:3`,
    semanticUid: `4663:${event.transactionHash}:3`,
  });
});

test('indexer rejects provisional, wrong-chain, malformed, or non-allowlisted events', () => {
  const allowlist = new Set([event.contractAddress.toLowerCase()]);
  for (const candidate of [
    { ...event, finality: 'PROVISIONAL' },
    { ...event, chainId: 46630 },
    { ...event, transactionHash: '0x1234' },
    { ...event, contractAddress: `0x${'4'.repeat(40)}` },
  ]) assert.throws(() => validateFinalizedEvent(candidate, allowlist));
});

test('indexer serializes uint256 event values as exact decimal strings', () => {
  assert.equal(serializeEventPayload({ amount: 12345678901234567890n }), '{"amount":"12345678901234567890"}');
});
