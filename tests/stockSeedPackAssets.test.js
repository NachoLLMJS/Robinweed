import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const slugs = ['msft','tsla','nvda','mstr','aapl','qqq','googl'];

function glbJson(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const jsonLength = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim()) };
}

test('all seven production tokenized-stock seed packets contain textured geometry', () => {
  for (const slug of slugs) {
    const version = slug === 'qqq' ? 'models-v29' : 'models-v26';
    const { bytes, json } = glbJson(`../public/${version}/items/stock-seed-packs/${slug}-seed-pack.glb`);
    assert.ok(bytes.length > (slug === 'qqq' ? 80_000 : 100_000), `${slug} GLB should not be an empty placeholder`);
    assert.ok(json.meshes?.length > 0, `${slug} needs a mesh`);
    assert.ok(json.meshes.some(mesh => mesh.primitives?.length), `${slug} needs triangle primitives`);
    assert.ok(json.images?.length > 0, `${slug} needs a baked image texture`);
    assert.ok(json.textures?.length > 0, `${slug} needs a texture binding`);
  }
});

test('QQQ V5 has a dedicated continuous-UV front and separate bag material', () => {
  const qqq = glbJson('../public/models-v29/items/stock-seed-packs/qqq-seed-pack.glb').json;
  assert.equal(qqq.meshes[0].primitives.length, 2);
  assert.equal(qqq.accessors[0].count, 4);
  assert.equal(qqq.accessors[2].type, 'VEC2');
  assert.equal(qqq.materials[0].name, 'QQQ_Print');
  assert.equal(qqq.materials[1].name, 'Purple_Bag');
  assert.equal(qqq.images[0].name, 'QQQ_Front_Print');
});
