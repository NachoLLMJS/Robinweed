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

test('image-generated neon cat patrols the opposite neighborhood sidewalk', () => {
  assert.equal(ASSET_URLS.street.neonCatWalker, '/models-v31/characters/neon-cat-walk.glb?v=1');
  assert.deepEqual(STREET_LAYOUT.neonCatWalker, {
    x: 4.45, minZ: 55.5, maxZ: 66.8, height: 1.8, speed: 0.95,
  });
  const reversed = advancePatrol({ distance: 55.6, direction: -1 }, 1, 55.5, 66.8, 0.95);
  assert.deepEqual(reversed, { distance: 55.5, direction: 1 });
  assert.match(main, /ASSET_URLS\.street\.neonCatWalker/);
  assert.match(main, /streetActors\.neonCatWalker/);
  assert.match(main, /neonCatWalkerMixer/);
});

test('generated neon cat production GLB is skinned and animated', () => {
  const json = glbJson('../public/models-v31/characters/neon-cat-walk.glb');
  assert.ok(json.skins?.length > 0, 'neon cat needs a Meshy skin');
  assert.ok(json.animations?.length > 0, 'neon cat needs a walk animation');
  assert.ok(json.animations[0].channels?.length > 0, 'walk clip needs channels');
});
