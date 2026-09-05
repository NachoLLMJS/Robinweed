import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('seed-pack repair pins the glTF Transform CLI version', () => {
  const source = readFileSync(new URL('../scripts/fix-seed-pack-logo.py', import.meta.url), 'utf8');
  assert.match(source, /@gltf-transform\/cli@4\.5\.0/);
  assert.doesNotMatch(source, /["']@gltf-transform\/cli["']/);
});