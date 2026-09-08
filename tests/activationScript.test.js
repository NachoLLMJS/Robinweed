import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/activate-stockdealer-mainnet.js', import.meta.url), 'utf8');

test('activation script is read-only and generates a plan-bound Safe batch', () => {
  assert.doesNotMatch(source, /new Wallet|sendTransaction|--broadcast/);
  assert.match(source, /planDigest/);
  assert.match(source, /safe-activation-batch\.json/);
  assert.match(source, /PREFLIGHT COMPLETE · SAFE BATCH GENERATED · NO TRANSACTIONS SENT/);
});

test('activation requires accepted multisig ownership and enables purchases last', () => {
  assert.match(source, /owner\(\)/);
  assert.match(source, /pendingOwner\(\)/);
  assert.match(source, /POSITIVE_BURN_INVARIANT_FAILED/);
  assert.ok(source.lastIndexOf("'enablePurchases'") > source.lastIndexOf("'enableGameplay'"));
  assert.ok(source.lastIndexOf("'enablePurchases'") > source.lastIndexOf("'enableClaims'"));
  assert.ok(source.lastIndexOf("'enablePurchases'") > source.lastIndexOf("'activate'"));
});

test('activation verifies token bytecode, every unconfigured initial state, and simulates the complete Safe batch before writing it', () => {
  assert.match(source, /expectedTokenCodeHash/);
  assert.match(source, /INITIAL_ROUTE_MISMATCH/);
  assert.match(source, /INITIAL_PATH_NOT_EMPTY/);
  assert.match(source, /INITIAL_SEED_SKU_NOT_EMPTY/);
  assert.match(source, /INITIAL_HOUSE_NOT_EMPTY/);
  assert.match(source, /INITIAL_BASKET_NOT_EMPTY/);
  assert.match(source, /eth_simulateV1/);
  assert.ok(source.indexOf('eth_simulateV1') < source.indexOf('atomicWrite(SAFE_BATCH_PATH'));
});

test('activation force-compiles and matches deployed runtimes to current artifacts with immutable masking', () => {
  assert.match(source, /hardhat['"],\s*['"]compile['"],\s*['"]--force/);
  assert.match(source, /immutableReferences/);
  assert.match(source, /DEPLOYED_RUNTIME_ARTIFACT_MISMATCH/);
});

test('activation proves a positive burn with sequential simulated balance and supply reads', () => {
  assert.match(source, /burnProbeHolder/);
  assert.match(source, /POSITIVE_BURN_INVARIANT_FAILED/);
  assert.doesNotMatch(source, /encodeFunctionData\('burn',\[0n\]\)/);
});
