import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-robinhood-mainnet.js', import.meta.url), 'utf8');
const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('deployment script is mainnet-only, external-env-only, and journals before every send', () => {
  assert.match(deploy, /CHAIN_ID = 4663/);
  assert.match(deploy, /STOCKDEALER_MAINNET_DEPLOY\.env/);
  assert.match(deploy, /writePrepared/);
  assert.match(deploy, /await writePrepared[\s\S]*sendTransaction/);
  assert.doesNotMatch(deploy, /46630|testnet/i);
});

test('deployment verifies every deployed runtime against the freshly compiled artifact', () => {
  assert.match(deploy, /assertRuntimeMatchesArtifact/);
  assert.match(deploy, /artifactValue\.deployedBytecode/);
});

test('deployment rejects any pre-existing journal without a plan digest', () => {
  assert.match(deploy, /FOUNDATION_JOURNAL_MISSING_PLAN_DIGEST/);
});

test('completed journal steps revalidate transaction, receipt, and call postcondition', () => {
  assert.match(deploy, /verifyCompletedStep/);
  assert.match(deploy, /provider\.getTransaction\(step\.hash\)/);
  assert.match(deploy, /provider\.waitForTransaction\(step\.hash,confirmations/);
  assert.match(deploy, /verifyCallPostcondition/);
});

test('a fresh broadcast waits for the indexed receipt before authenticating transaction identity', () => {
  const complete = deploy.slice(deploy.indexOf('async function completeBroadcast'), deploy.indexOf('async function sendPrepared'));
  assert.ok(complete.indexOf('provider.waitForTransaction') < complete.indexOf('provider.getTransaction'));
});

test('Railway example never contains a deployer key variable', () => {
  assert.doesNotMatch(example, /PRIVATE_KEY|MNEMONIC|DEPLOYER/);
});

test('deployment forces a fresh compile before reading artifacts', () => {
  assert.match(deploy, /process\.execPath/);
  assert.match(deploy, /node_modules\/hardhat\/dist\/src\/cli\.js/);
  assert.match(deploy, /['"]compile['"],\s*['"]--force/);
  assert.match(deploy, /await ensureFreshBuild\(\)/);
});

test('deployment requires the complete foundation gas budget before creating a journal or broadcasting', () => {
  assert.match(deploy, /MIN_FOUNDATION_BALANCE_WEI/);
  assert.match(deploy, /provider\.getBalance\(signer\.address\)/);
  assert.match(deploy, /INSUFFICIENT_FOUNDATION_GAS_BUDGET/);
  assert.ok(deploy.indexOf('INSUFFICIENT_FOUNDATION_GAS_BUDGET') < deploy.indexOf('await loadJournal()'));
});

test('deployment accepts an exact private key with or without the optional 0x prefix', () => {
  assert.match(deploy, /\^\(\?:0x\)\?\[0-9a-fA-F\]\{64\}\$/);
});
