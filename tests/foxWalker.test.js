import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_URLS } from '../src/assetManifest.js';
import { STREET_LAYOUT, advancePatrol } from '../src/streetLifeState.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const main = fs.readFileSync(path.join(here, '../src/main.js'), 'utf8');

function glbJson(relativePath) {
  const bytes = fs.readFileSync(path.join(here, relativePath));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
}

test('fox walker uses a versioned Meshy Casual_Walk GLB on a safe sidewalk patrol', () => {
  assert.equal(ASSET_URLS.street.foxWalker, '/models-v30/characters/fox-walk.glb?v=1');
  assert.deepEqual(STREET_LAYOUT.foxWalker, {
    x: -4.45, minZ: 42, maxZ: 96, height: 1.8, speed: 1.05,
  });
  const reversed = advancePatrol({ distance: 95.9, direction: 1 }, 1, 42, 96, 1.05);
  assert.deepEqual(reversed, { distance: 96, direction: -1 });
  assert.match(main, /ASSET_URLS\.street\.foxWalker/);
  assert.match(main, /streetActors\.foxWalker/);
  assert.match(main, /foxWalkerMixer/);
});

test('production fox walker is skinned and embeds a walking animation', () => {
  const json = glbJson('../public/models-v30/characters/fox-walk.glb');
  assert.ok(json.skins?.length > 0, 'fox walker needs a skin');
  assert.ok(json.animations?.length > 0, 'fox walker needs an animation');
  assert.ok(json.animations[0].channels?.length > 0, 'walk clip needs animated channels');
  assert.ok(json.animations[0].samplers?.length > 0, 'walk clip needs samplers');
});
