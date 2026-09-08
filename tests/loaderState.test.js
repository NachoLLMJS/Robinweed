import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { trailerButtonsVisible, spectatorFlightDelta } from '../src/loaderState.js';

const root=path.resolve(import.meta.dirname,'..');

test('trailer choices appear only during the final four seconds and remain visible at the end',()=>{
  assert.equal(trailerButtonsVisible(11.99,16),false);
  assert.equal(trailerButtonsVisible(12,16),true);
  assert.equal(trailerButtonsVisible(16,16),true);
});

test('spectator flight supports vertical movement independently of rewards',()=>{
  assert.deepEqual(spectatorFlightDelta({x:0,z:-1,up:1},2,5),{x:0,y:10,z:-10});
  assert.deepEqual(spectatorFlightDelta({x:-1,z:0,up:-1},.5,8),{x:-4,y:-4,z:0});
});

test('loader uses the supplied trailer and exposes game and spectator choices',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
  assert.match(html,/stockdealer-corridor-trailer\.mp4/);
  assert.match(html,/id="play"[^>]*>ENTER THE GAME/);
  assert.match(html,/id="spectate"[^>]*>SPECTATOR MODE/);
  assert.match(source,/trailerButtonsVisible/);
  assert.match(source,/beginSession\('spectator'\)/);
  assert.match(source,/state\.tokenBalance=null;state\.seeds=0;state\.buds=0/);
  assert.match(source,/state\.mode==='spectator'/);
});
