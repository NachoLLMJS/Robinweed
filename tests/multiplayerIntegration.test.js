import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('game authenticates multiplayer after wallet connection and renders outside snapshots', () => {
  assert.match(source, /createSerializedAuthenticator/);
  assert.match(source, /new MultiplayerClient/);
  assert.match(source, /remotePlayers/);
  assert.match(source, /onMultiplayerSnapshot/);
  assert.match(source, /localServerTarget\.set\(player\.x,player\.z\)/);
  assert.match(source, /reconcilePredictedPosition/);
  assert.match(source, /beginRemoteMotion/);
  assert.match(source, /sampleRemoteMotion/);
  assert.match(source, /model\.rotation\.y=Math\.PI/);
  assert.doesNotMatch(source, /group\.position\.lerp\(group\.userData\.target,\.28\)/);
  assert.match(source, /PLAYER_SKINS/);
  assert.match(source, /group\.position\.set\(player\.x,\.02,player\.z\)/);
  assert.match(source, /ui\.onlinePlayers\.textContent=String\(snapshot\.players\.length\)/);
  assert.match(source, /setMultiplayerStatus\(state\.walletAddress\?'PRIVATE':'OFF'\)/);
  assert.match(source, /onStatus:/);
  assert.match(source, /setMultiplayerStatus\('CONNECTING'\)/);
});

test('spectator mode connects to read-only multiplayer and renders every outside player', () => {
  assert.match(source, /if\(state\.mode==='spectator'\)/);
  assert.match(source, /new MultiplayerClient\(\{spectator:true/);
  assert.match(source, /beginSession\(mode\).*syncMultiplayerLocation\(\)/s);
  assert.match(source, /state\.mode==='player'.*multiplayerClient\.sendInput/s);
  assert.doesNotMatch(source, /ensureAuthenticatedSession\([^)]*spectator/);
});

test('spectator wallet events are inert and cannot trigger SIWE or state loading', () => {
  assert.match(source, /async function handleAccountsChanged\(accounts\)\{if\(state\.mode==='spectator'\)return;/);
  assert.match(source, /function handleChainChanged\(chainId\)\{if\(state\.mode==='spectator'\)return;/);
  assert.match(source, /function handleWalletDisconnect\(\)\{if\(state\.mode==='spectator'\)return;clearWalletContext\(\);\}/);
  assert.match(source, /globalThis\.ethereum\?\.on\?\.\('disconnect',handleWalletDisconnect\)/);
});

test('spectator entry cancels pending player entry and incompatible realtime clients', () => {
  assert.match(source, /let sessionEntryGeneration=0/);
  assert.match(source, /const entryGeneration=\+\+sessionEntryGeneration/);
  assert.match(source, /entryGeneration!==sessionEntryGeneration/);
  assert.match(source, /function enterSpectatorSession\(\)\{sessionEntryGeneration\+\+;clearWalletContext\(\);beginSession\('spectator'\);\}/);
  assert.match(source, /multiplayerClient&&multiplayerClient\.spectator!==\(mode==='spectator'\)/);
  assert.match(source, /#spectate'\)\.addEventListener\('click',enterSpectatorSession\)/);
});

test('entering player mode requires wallet authentication and state loading before the loader closes', () => {
  assert.match(source, /async function enterPlayerSession/);
  assert.match(source, /await connectPlayerWallet\(\)/);
  assert.match(source, /if\(entryGeneration!==sessionEntryGeneration\|\|!wallet\|\|state\.walletAddress/);
  assert.match(source, /authenticatedWallet\?\.toLowerCase\(\)!==wallet\.toLowerCase\(\)/);
  assert.match(source, /beginSession\('player'\)/);
  assert.doesNotMatch(source, /#play'\)\.addEventListener\('click',\(\)=>beginSession\('player'\)\)/);
});

test('wallet authentication and account changes are generation-bound and clear failed identity', () => {
  assert.match(source, /if\(isSameWalletAddress\(state\.walletAddress,wallet\)\)return/);
  assert.match(source, /walletConnectionGeneration/);
  assert.match(source, /generation!==walletConnectionGeneration/);
  assert.match(source, /if\(generation===walletConnectionGeneration\)clearWalletContext\(\)/);
  assert.match(source, /function clearWalletContext\(\)\{walletConnectionGeneration\+\+;multiplayerGeneration\+\+;multiplayerClient\?\.close\(\);multiplayerClient=null;localServerReady=false/);
});

test('game sends multiplayer input only from the shared street at a bounded cadence', () => {
  assert.match(source, /state\.location==='street'/);
  assert.match(source, /advanceCadence\(lastMultiplayerInputAt,now,50\)/);
  assert.doesNotMatch(source, /lastMultiplayerInputAt=now/);
  assert.match(source, /multiplayerClient\.sendInput/);
  assert.ok(source.indexOf('multiplayerClient=client;client.connect()') > 0);
  assert.match(source, /catch\(error\)\{multiplayerClient=null/);
});
