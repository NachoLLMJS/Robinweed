import test from 'node:test';
import assert from 'node:assert/strict';
import { realtimeRoleForUrl, roleAllowsClientMessages, stateReceivesSnapshots } from '../server/realtimeAccess.js';

test('realtime role parsing permits only the player route or exact spectator query', () => {
  assert.equal(realtimeRoleForUrl('/realtime'), 'player');
  assert.equal(realtimeRoleForUrl('/realtime?role=spectator'), 'spectator');
  for (const url of ['/other', '/realtime?role=player', '/realtime?role=spectator&admin=1', '/realtime?role=spectator&role=player']) {
    assert.equal(realtimeRoleForUrl(url), null, url);
  }
});

test('spectators receive snapshots but cannot send protocol messages or become players', () => {
  assert.equal(roleAllowsClientMessages('spectator'), false);
  assert.equal(roleAllowsClientMessages('player'), true);
  assert.equal(stateReceivesSnapshots({ role: 'spectator', joined: false }), true);
  assert.equal(stateReceivesSnapshots({ role: 'player', joined: true }), true);
  assert.equal(stateReceivesSnapshots({ role: 'player', joined: false }), false);
});
