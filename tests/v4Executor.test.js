import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('V4 executor signs only an exact revalidated plan-bound Safe transaction', () => {
  const source=readFileSync(new URL('../scripts/execute-robinhood-mainnet-v4.js',import.meta.url),'utf8');
  assert.match(source,/--broadcast/);
  assert.match(source,/V4_PLAN_DIGEST_MISMATCH/);
  assert.match(source,/attestSafe/);
  assert.match(source,/assertPackedBatch/);
  assert.match(source,/getTransactionHash/);
  assert.match(source,/signingKey\.sign\(safeTxHash\)/);
  assert.match(source,/execTransaction\.staticCall/);
  assert.doesNotMatch(source,/console\.(?:log|info|error)\([^\n]*(?:PRIVATE_KEY|privateKey)/);
});
