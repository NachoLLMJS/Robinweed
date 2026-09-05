import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const signBlock = source.match(/\/\/ Branded wall sign built from geometry\/DOM-like canvas texture([\s\S]*?)const tex=/)?.[1] ?? '';

test('warehouse wall sign renders STOCKDEALER without clipping', () => {
  assert.match(signBlock, /const signLeft='STOCK'/);
  assert.match(signBlock, /const signAccent='DEALER'/);
  assert.match(signBlock, /measureText\(signLeft\)/);
  assert.match(signBlock, /measureText\(signAccent\)/);
  assert.doesNotMatch(signBlock, /ROBIN|WEED/);
});
