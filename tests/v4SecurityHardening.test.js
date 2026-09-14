import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertNoNewResidue } from '../scripts/lib/economicInvariant.js';

const deploy = readFileSync(new URL('../scripts/deploy-robinhood-mainnet-v4.js', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-robinhood-mainnet-v4.js', import.meta.url), 'utf8');
const safeAttestation = readFileSync(new URL('../scripts/lib/safeAttestation.js', import.meta.url), 'utf8');

test('V4 deployment plan commits complete Safe and MultiSend provenance', () => {
  for (const field of ['singletonCodeHash','factoryCodeHash','deploymentTxHash','modules','guard','multiSend']) {
    assert.match(`${deploy}\n${safeAttestation}`, new RegExp(field));
  }
  assert.match(safeAttestation, /getModulesPaginated/);
  assert.match(safeAttestation, /SAFE_GUARD_STORAGE_SLOT/);
  assert.match(safeAttestation, /ProxyCreation/);
});

test('V4 postdeploy reattests complete Safe identity and plan-bound MultiSend', () => {
  assert.match(verify, /plan\.safe\.multiSend\.address/);
  assert.match(verify, /plan\.safe\.multiSend\.codeHash/);
  assert.match(safeAttestation, /getModulesPaginated/);
  assert.match(safeAttestation, /SAFE_GUARD_STORAGE_SLOT/);
  assert.match(verify, /SAFE_POSTEXEC_ATTESTATION_MISMATCH/);
});

test('economic residue invariant tolerates donated dust but rejects newly retained funds', () => {
  assert.doesNotThrow(() => assertNoNewResidue({ input: 1n, pair: 2n, target: 3n, native: 4n }, { input: 1n, pair: 2n, target: 3n, native: 4n }));
  assert.throws(() => assertNoNewResidue({ input: 1n, pair: 2n, target: 3n, native: 4n }, { input: 2n, pair: 2n, target: 3n, native: 4n }), /ECONOMIC_ROUTE_RESIDUE_INCREASED:input/);
});
