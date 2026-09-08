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

test('all user-facing application branding says Stockdealer and never Robinweed', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const packageMetadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(html, /robinweed/i);
  assert.match(html, /<title>STOCKDEALER<\/title>/);
  assert.match(html, /STOCK<span>DEALER<\/span>/);
  assert.doesNotMatch(main, /ROBINWEED CITY/);
  assert.match(main, /STOCKDEALER CITY/);
  assert.match(readme, /^# Stockdealer$/m);
  assert.doesNotMatch(readme, /robinweed/i);
  assert.match(packageMetadata.description, /^Stockdealer\b/);
  assert.doesNotMatch(packageMetadata.description, /robinweed/i);
  assert.equal(packageMetadata.name, 'robinweed', 'technical npm package identifier stays stable');
});
