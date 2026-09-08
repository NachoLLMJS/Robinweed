import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('game authenticates multiplayer after wallet connection and renders outside snapshots', () => {
  assert.match(source, /createSerializedAuthenticator/);
  assert.match(source, /new MultiplayerClient/);
  assert.match(source, /remotePlayers/);
  assert.match(source, /onMultiplayerSnapshot/);
  assert.match(source, /camera\.position\.x=player\.x/);
  assert.match(source, /camera\.position\.z=player\.z/);
  assert.match(source, /PLAYER_SKINS/);
  assert.match(source, /group\.position\.set\(player\.x,\.02,player\.z\)/);
  assert.match(source, /ui\.onlinePlayers\.textContent=String\(snapshot\.players\.length\)/);
  assert.match(source, /setMultiplayerStatus\('PRIVATE'\)/);
  assert.match(source, /onStatus:/);
  assert.match(source, /setMultiplayerStatus\('CONNECTING'\)/);
});

test('entering player mode requires wallet authentication and state loading before the loader closes', () => {
  assert.match(source, /async function enterPlayerSession/);
  assert.match(source, /await connectPlayerWallet\(\)/);
  assert.match(source, /if\(!wallet\|\|state\.walletAddress/);
  assert.match(source, /authenticatedWallet\?\.toLowerCase\(\)!==wallet\.toLowerCase\(\)/);
  assert.match(source, /beginSession\('player'\)/);
  assert.doesNotMatch(source, /#play'\)\.addEventListener\('click',\(\)=>beginSession\('player'\)\)/);
});

test('wallet authentication and account changes are generation-bound and clear failed identity', () => {
  assert.match(source, /if\(isSameWalletAddress\(state\.walletAddress,wallet\)\)return/);
  assert.match(source, /walletConnectionGeneration/);
  assert.match(source, /generation!==walletConnectionGeneration/);
  assert.match(source, /if\(generation===walletConnectionGeneration\)clearWalletContext\(\)/);
  assert.match(source, /function clearWalletContext\(\)\{walletConnectionGeneration\+\+/);
});

test('game sends multiplayer input only from the shared street at a bounded cadence', () => {
  assert.match(source, /state\.location==='street'/);
  assert.match(source, /now-lastMultiplayerInputAt>=100/);
  assert.match(source, /multiplayerClient\.sendInput/);
  assert.ok(source.indexOf('multiplayerClient=client;client.connect()') > 0);
  assert.match(source, /catch\(error\)\{multiplayerClient=null/);
});
