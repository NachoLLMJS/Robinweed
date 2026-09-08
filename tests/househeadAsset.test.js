import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readGlbJson(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'asset must be a GLB container');
  assert.equal(bytes.readUInt32LE(4), 2, 'asset must use glTF 2.0');
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'first GLB chunk must be JSON');
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('Meshy househead production GLB embeds a seamless named idle clip', () => {
  const gltf = readGlbJson('../public/models-v24/characters/househead-idle.glb');
  assert.equal(gltf.animations.length, 1);
  const idle = gltf.animations[0];
  assert.equal(idle.name, 'Househead_Idle');
  assert.equal(idle.channels.length, 3);
  assert.deepEqual(idle.channels.map(channel => channel.target.path).sort(), ['rotation', 'scale', 'translation']);
  assert.equal(idle.samplers.length, 3);
  const timeAccessor = gltf.accessors[idle.samplers[0].input];
  assert.deepEqual(timeAccessor.min, [0]);
  assert.deepEqual(timeAccessor.max, [4]);
  assert.equal(timeAccessor.count, 9);
  assert.equal(gltf.nodes[idle.channels[0].target.node].matrix, undefined, 'animated node must use TRS instead of a matrix');
});

test('production client references the downloaded GLB without Meshy credentials or source images', () => {
  const manifest = readFileSync(new URL('../src/assetManifest.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(manifest, /househead-idle\.glb\?v=1/);
  assert.doesNotMatch(`${manifest}\n${main}`, /MESHY_API_KEY|MESHY_ENV_FILE|sdadad\.png|househead-a-pose\.png/);
});
