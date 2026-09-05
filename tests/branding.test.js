import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VENDOR_NAME, buildingUsesRobinhoodLogo } from '../src/branding.js';

test('the principal vendor is Vlad Tenev', () => {
  assert.equal(VENDOR_NAME, 'Vlad Tenev');
});

test('Robinhood branding is reserved for commercial buildings', () => {
  assert.equal(buildingUsesRobinhoodLogo('shop'), true);
  assert.equal(buildingUsesRobinhoodLogo('house'), false);
  assert.equal(buildingUsesRobinhoodLogo('apartment'), false);
});

test('all user-facing vendor copy says Vlad Tenev and never Milo', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const userFacing = `${html}\n${main}`;
  assert.match(userFacing, /Vlad Tenev|VLAD TENEV/);
  assert.doesNotMatch(userFacing, /MILO'S|TALK TO MILO|Sell your harvest to Milo/);
});
