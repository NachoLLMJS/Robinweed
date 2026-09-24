import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { trailerButtonsVisible } from '../src/loaderState.js';

const root=path.resolve(import.meta.dirname,'..');

test('trailer choices appear only during the final four seconds and remain visible at the end',()=>{
  assert.equal(trailerButtonsVisible(11.99,16),false);
  assert.equal(trailerButtonsVisible(12,16),true);
  assert.equal(trailerButtonsVisible(16,16),true);
});

test('loader uses the supplied trailer and exposes game and spectator choices',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
  assert.match(html,/stockdealer-corridor-trailer\.mp4/);
  assert.match(html,/id="play"[^>]*>ENTER THE GAME/);
  assert.match(html,/id="spectate"[^>]*>PLAY OFFCHAIN DEMO/);
  assert.match(source,/trailerButtonsVisible/);
  assert.match(source,/beginSession\('spectator'\)/);
  assert.match(source,/createSpectatorSession\(\)/);
  assert.match(source,/state\.location=INITIAL_PLAYER_SPAWN\.location/);
  assert.doesNotMatch(source,/spectatorFlightDelta/);
  assert.match(source,/state\.mode==='spectator'/);
});
