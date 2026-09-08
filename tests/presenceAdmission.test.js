import test from 'node:test';
import assert from 'node:assert/strict';
import { PresenceAdmission } from '../server/presenceAdmission.js';

test('presence admission enforces global, per-IP, session and user uniqueness', () => {
  const admission = new PresenceAdmission({ maxConnections: 3, maxPerIp: 2, maxPlayers: 2 });
  const a = admission.admit({ userId: 'u1', sessionId: 's1', ip: '1.1.1.1' });
  assert.ok(a);
  assert.equal(admission.admit({ userId: 'u1', sessionId: 's2', ip: '1.1.1.2' }), null);
  assert.equal(admission.admit({ userId: 'u2', sessionId: 's1', ip: '1.1.1.2' }), null);
  const b = admission.admit({ userId: 'u2', sessionId: 's2', ip: '1.1.1.1' });
  assert.ok(b);
  assert.equal(admission.admit({ userId: 'u3', sessionId: 's3', ip: '1.1.1.1' }), null);
  admission.release(a);
  assert.ok(admission.admit({ userId: 'u3', sessionId: 's3', ip: '1.1.1.2' }));
});

test('presence admission caps joined world players separately', () => {
  const admission = new PresenceAdmission({ maxConnections: 3, maxPerIp: 3, maxPlayers: 1 });
  const a = admission.admit({ userId: 'u1', sessionId: 's1', ip: '1' });
  const b = admission.admit({ userId: 'u2', sessionId: 's2', ip: '2' });
  assert.equal(admission.join(a), true);
  assert.equal(admission.join(b), false);
  admission.release(a);
  assert.equal(admission.join(b), true);
});
