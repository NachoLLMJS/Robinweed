import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientMessage, acceptClientSequence } from '../server/realtimeProtocol.js';

test('realtime protocol accepts bounded player intent', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'input', clientSeq: 7, buttons: ['forward', 'run'], lookDirection: 1.2 })), {
    type: 'input', clientSeq: 7, buttons: ['forward', 'run'], lookDirection: 1.2,
  });
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'join_world', worldId: 'outside' })), { type: 'join_world', worldId: 'outside' });
});

test('realtime protocol rejects authoritative position, unknown fields, oversized messages, and stale sequences', () => {
  for (const value of [
    { type: 'setPosition', x: 999, z: 999 },
    { type: 'action', clientSeq: 2, actionType: 'interact', targetId: 'house' },
    { type: 'input', clientSeq: 1, buttons: [], lookDirection: 0, inventory: 999 },
    { type: 'input', clientSeq: 1, buttons: ['teleport'], lookDirection: 0 },
  ]) assert.throws(() => parseClientMessage(JSON.stringify(value)));
  assert.throws(() => parseClientMessage('x'.repeat(16_385)));
  assert.equal(acceptClientSequence(10, 11), 11);
  assert.throws(() => acceptClientSequence(10, 10));
});
