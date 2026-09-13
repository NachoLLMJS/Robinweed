import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-robinhood-mainnet.js', import.meta.url), 'utf8');
const deployV2 = readFileSync(new URL('../scripts/deploy-robinhood-mainnet-v2.js', import.meta.url), 'utf8');
const rehearsalSimulation = readFileSync(new URL('../scripts/simulate-flyco-adapter-mainnet.js', import.meta.url), 'utf8');
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

test('v2 deployment uses a distinct journal and the Pons lifecycle adapter', () => {
  assert.match(deployV2, /robinhood-mainnet-foundation-v2\.json/);
  assert.match(deployV2, /safe-accept-ownership-v2-batch\.json/);
  assert.match(deployV2, /artifact\('StockdealerPonsAdapter','StockdealerPonsAdapter'\)/);
  assert.match(deployV2, /deployContract\(context,'PonsAdapter'/);
  assert.match(deployV2, /FOUNDATION_V2_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED/);
  assert.doesNotMatch(deployV2, /journal\.status='FOUNDATION_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED'/);
  assert.match(deployV2, /getOwners/);
  assert.match(deployV2, /getThreshold/);
  assert.match(deployV2, /ADMIN_SAFE_OWNERS/);
  assert.match(deployV2, /ADMIN_SAFE_THRESHOLD/);
  assert.match(deployV2, /ADMIN_SAFE_CODE_HASH/);
  assert.match(deployV2, /ADMIN_SAFE_SINGLETON_ADDRESS/);
  assert.match(deployV2, /ADMIN_SAFE_SINGLETON_CODE_HASH/);
  assert.match(deployV2, /ADMIN_SAFE_FACTORY_ADDRESS/);
  assert.match(deployV2, /ADMIN_SAFE_FACTORY_CODE_HASH/);
  assert.match(deployV2, /ADMIN_SAFE_DEPLOYMENT_TX_HASH/);
  assert.match(deployV2, /ProxyCreation/);
  assert.match(deployV2, /getModulesPaginated/);
  assert.match(deployV2, /ADMIN_SAFE_MODULES/);
  assert.match(deployV2, /ADMIN_SAFE_GUARD_STORAGE_SLOT/);
  assert.match(deployV2, /SAFE_GUARD_STORAGE_SLOT\s*=\s*'0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c7'/);
  assert.match(deployV2, /ADMIN_SAFE_GUARD_STORAGE_SLOT_MISMATCH/);
  assert.match(deployV2, /ADMIN_SAFE_GUARD_ADDRESS/);
  assert.match(deployV2, /safeAttestation/);
  assert.match(deployV2, /EXPECTED_DEPLOYER_ADDRESS_REQUIRED/);
  assert.match(deployV2, /DEPLOYER_MUST_BE_EOA/);
  assert.match(deployV2, /ownershipBatchDigest/);
  assert.match(deployV2, /ownershipTransactions/);
});

test('Windows contract test command enumerates files instead of passing a literal glob', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(packageJson.scripts['contracts:test'], /\*/);
  for (const file of ['cultivation', 'economyRouter', 'gameCore', 'rewardVault', 'uniswapAdapter']) {
    assert.match(packageJson.scripts['contracts:test'], new RegExp(`test/contracts/${file}\\.test\\.js`));
  }
  assert.match(packageJson.scripts['contracts:test'], /test\/StockdealerPonsAdapter\.test\.js/);
});

test('FLYCO simulation compiles fresh and reruns swaps with bounded output and residue checks', () => {
  assert.match(rehearsalSimulation, /compile['"],\s*['"]--force/);
  assert.match(rehearsalSimulation, /minimumOutBySymbol/);
  assert.doesNotMatch(rehearsalSimulation, /amount,1n,deadline/);
  assert.match(rehearsalSimulation, /allowance/);
  assert.match(rehearsalSimulation, /ADAPTER_RESIDUE_DETECTED/);
  assert.match(rehearsalSimulation, /SIMULATION_ZERO_OUTPUT/);
});
