import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function glbJson(relativePath) {
  const buffer = readFileSync(new URL(relativePath, import.meta.url));
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/\0+$/u, '').trim());
}

function joints(document) {
  return document.skins.flatMap(skin => skin.joints.map(index => document.nodes[index]?.name ?? String(index))).sort();
}

test('Vlad v37 idle GLB is textured, skinned and carries the Idle clip', () => {
  const document = glbJson('../public/models-v37/characters/vlad-tenev-idle.glb');
  assert.ok(document.meshes.length > 0);
  assert.ok(document.images.length > 0);
  assert.equal(document.skins.length, 1);
  assert.equal(joints(document).length, 24);
  assert.match(document.animations[0].name, /Idle/);
  assert.ok(document.animations[0].channels.length >= 24);
});

test('Vlad v37 talk GLB shares the idle skeleton and carries a hand-talk clip', () => {
  const idle = glbJson('../public/models-v37/characters/vlad-tenev-idle.glb');
  const talk = glbJson('../public/models-v37/characters/vlad-tenev-talk.glb');
  assert.deepEqual(joints(talk), joints(idle));
  assert.match(talk.animations[0].name, /Talk_with_Hands_Open/);
  assert.ok(talk.animations[0].channels.length >= 24);
});
