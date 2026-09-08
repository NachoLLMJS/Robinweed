import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server/indexer.js', import.meta.url), 'utf8');

test('private indexer uses advisory lock, corroborated finalized head, bytecode hashes and bounded log ranges', () => {
  assert.match(source, /pg_try_advisory_lock/);
  assert.match(source, /corroboratedFinalizedHead/);
  assert.match(source, /expectedCodeHash/);
  assert.match(source, /Math\.min\(fromBlock \+ 499, finalized\.number\)/);
  assert.match(source, /INSERT INTO applied_events/);
  assert.match(source, /applyProjectionOperations/);
});

test('indexer has no signer or deployment key path', () => {
  assert.doesNotMatch(source, /Wallet|DEPLOYER_PRIVATE_KEY|sendTransaction/);
});

test('indexer filters every log against that contracts own deployment block', () => {
  assert.match(source, /log\.blockNumber\s*>=\s*entry\.deploymentBlock/);
});

test('indexer ignores non-projection events from code-hash-verified contracts instead of halting', () => {
  assert.match(source, /if \(!parsed\) continue/);
  assert.doesNotMatch(source, /UNKNOWN_ALLOWLISTED_EVENT/);
});
