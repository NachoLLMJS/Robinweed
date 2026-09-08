import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('game authenticates multiplayer after wallet connection and renders outside snapshots', () => {
  assert.match(source, /authenticateRealtime/);
  assert.match(source, /new MultiplayerClient/);
  assert.match(source, /remotePlayers/);
  assert.match(source, /onMultiplayerSnapshot/);
  assert.match(source, /camera\.position\.x=player\.x/);
  assert.match(source, /camera\.position\.z=player\.z/);
});

test('game sends multiplayer input only from the shared street at a bounded cadence', () => {
  assert.match(source, /state\.location==='street'/);
  assert.match(source, /now-lastMultiplayerInputAt>=100/);
  assert.match(source, /multiplayerClient\.sendInput/);
});
