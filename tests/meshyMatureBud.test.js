import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_URLS } from '../src/assetManifest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

function readGlbJson(file) {
  const bytes = fs.readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
}

test('mature colored buds use a versioned Meshy-generated bud GLB', () => {
  assert.equal(ASSET_URLS.plants.matureBudCluster, '/models-v32/plants/meshy-cannabis-bud.glb?v=1');
  assert.match(main, /ASSET_URLS\.plants\.matureBudCluster/);
  assert.match(main, /meshyMatureBudTemplate/);
  const body = main.match(/function createMatureBudOverlay[\s\S]*?\n}/)?.[0] || '';
  assert.doesNotMatch(body, /IcosahedronGeometry/);
});

test('production Meshy bud asset contains textured game geometry', () => {
  const file = path.join(root, 'public/models-v32/plants/meshy-cannabis-bud.glb');
  assert.ok(fs.statSync(file).size > 20_000);
  const gltf = readGlbJson(file);
  assert.ok((gltf.meshes || []).length >= 1);
  assert.ok((gltf.materials || []).length >= 1);
  assert.ok((gltf.images || []).length >= 1);
});
