import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSessionCredential } from '../server/postgresRepository.js';

const source = readFileSync(new URL('../server/postgresRepository.js', import.meta.url), 'utf8');

test('session credentials store only a fixed hash of an opaque random token', () => {
  const credential = createSessionCredential(Buffer.alloc(32, 5), 'x'.repeat(32));
  assert.match(credential.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(credential.tokenHash.length, 32);
  assert.equal(credential.tokenHash.includes(Buffer.from(credential.token)), false);
});

test('challenge consumption is one atomic PostgreSQL update with expiry and replay guards', () => {
  assert.match(source, /UPDATE auth_challenges/i);
  assert.match(source, /SET used_at = now\(\)/i);
  assert.match(source, /used_at IS NULL/i);
  assert.match(source, /expires_at >= now\(\)/i);
  assert.match(source, /RETURNING/i);
});
