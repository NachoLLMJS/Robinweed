import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPackedBatch, packBatch } from '../scripts/lib/safeMultisend.js';

const txs = [
  { to: '0x1111111111111111111111111111111111111111', value: '0', data: '0x1234' },
  { to: '0x2222222222222222222222222222222222222222', value: '7', data: '0xabcdef' },
];

function pack(transactions, operation = 0) {
  return `0x${transactions.map(tx => [
    operation.toString(16).padStart(2, '0'),
    tx.to.slice(2).toLowerCase(),
    BigInt(tx.value).toString(16).padStart(64, '0'),
    BigInt((tx.data.length - 2) / 2).toString(16).padStart(64, '0'),
    tx.data.slice(2).toLowerCase(),
  ].join('')).join('')}`;
}

test('Safe MultiSend parser accepts the exact ordered call sequence', () => {
  assert.doesNotThrow(() => assertPackedBatch(pack(txs), txs));
});

test('canonical Safe MultiSend encoder round-trips the exact intended sequence', () => {
  const packed = packBatch(txs);
  assert.doesNotThrow(() => assertPackedBatch(packed, txs));
});

test('Safe MultiSend parser rejects altered calldata, internal delegatecall, truncation, or extra calls', () => {
  const altered = structuredClone(txs);
  altered[1].data = '0xabcdee';
  assert.throws(() => assertPackedBatch(pack(altered), txs), /SAFE_MULTISEND_CALL_MISMATCH/);
  assert.throws(() => assertPackedBatch(pack(txs, 1), txs), /SAFE_MULTISEND_CALL_MISMATCH/);
  assert.throws(() => assertPackedBatch(pack(txs).slice(0, -2), txs), /SAFE_MULTISEND_PAYLOAD_INVALID/);
  assert.throws(() => assertPackedBatch(pack([...txs, txs[0]]), txs), /SAFE_MULTISEND_PAYLOAD_INVALID/);
});
