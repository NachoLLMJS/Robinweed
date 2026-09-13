import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/activate-stockdealer-mainnet.js', import.meta.url), 'utf8');
const sourceV2 = readFileSync(new URL('../scripts/activate-stockdealer-mainnet-v2.js', import.meta.url), 'utf8');

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

test('activation force-compiles portably and matches deployed runtimes to current artifacts with immutable masking', () => {
  assert.match(source, /process\.execPath/);
  assert.match(source, /node_modules\/hardhat\/dist\/src\/cli\.js/);
  assert.match(source, /['"]compile['"],\s*['"]--force/);
  assert.match(source, /immutableReferences/);
  assert.match(source, /DEPLOYED_RUNTIME_ARTIFACT_MISMATCH/);
});

test('activation proves a positive burn with sequential simulated balance and supply reads', () => {
  assert.match(source, /burnProbeHolder/);
  assert.match(source, /POSITIVE_BURN_INVARIANT_FAILED/);
  assert.doesNotMatch(source, /encodeFunctionData\('burn',\[0n\]\)/);
});

test('v2 activation is read-only, authenticates the Pons curve, and rejects rehearsal configs', () => {
  assert.doesNotMatch(sourceV2, /new Wallet|sendTransaction|--broadcast/);
  assert.match(sourceV2, /validatePonsActivationConfig/);
  assert.match(sourceV2, /REHEARSAL_CONFIG_NOT_BROADCASTABLE/);
  assert.match(sourceV2, /getLaunchedToken/);
  assert.match(sourceV2, /PONS_FACTORY_TOKEN_AUTHENTICATION_FAILED/);
  assert.match(sourceV2, /PONS_CURVE_NOT_ACTIVE/);
  assert.match(sourceV2, /StockdealerPonsAdapter/);
  assert.match(sourceV2, /safe-activation-v2-batch\.json/);
  assert.match(sourceV2, /item\.ticker/);
  assert.doesNotMatch(sourceV2, /item\.symbol/);
  assert.match(sourceV2, /getOwners/);
  assert.match(sourceV2, /getThreshold/);
  assert.match(sourceV2, /ADMIN_SAFE_OWNERS/);
  assert.match(sourceV2, /ADMIN_SAFE_THRESHOLD/);
  assert.match(sourceV2, /ADMIN_SAFE_CODE_HASH/);
  assert.match(sourceV2, /ADMIN_SAFE_SINGLETON_ADDRESS/);
  assert.match(sourceV2, /ADMIN_SAFE_DEPLOYMENT_TX_HASH/);
  assert.match(sourceV2, /getModulesPaginated/);
  assert.match(sourceV2, /ADMIN_SAFE_GUARD_STORAGE_SLOT/);
  assert.match(sourceV2, /safeAttestation/);
  assert.match(sourceV2, /simulateEconomicRoute/);
  assert.match(sourceV2, /maximumCurrencyInputBySymbol/);
  assert.match(sourceV2, /minimumOut\s*=\s*\(discoveredOut\s*\*\s*99n\s*\+\s*99n\)\s*\/\s*100n/);
  assert.match(sourceV2, /blockTag/);
  assert.match(sourceV2, /economicPreflight/);
  assert.match(sourceV2, /planDigest[\s\S]*economicPreflight/);
  assert.match(sourceV2, /planDigest[\s\S]*transactions/);
  assert.match(sourceV2, /checksum:planDigest/);
  assert.match(sourceV2, /curveAllowance/);
  assert.match(sourceV2, /pairAllowance/);
  assert.match(sourceV2, /pairResidue/);
  assert.match(sourceV2, /targetResidue/);
  assert.ok(sourceV2.indexOf('eth_simulateV1') < sourceV2.indexOf('atomicWrite(SAFE_BATCH_PATH'));
});

test('v2 activation requires explicit CLI authorization for the exact FLYCO live trial', () => {
  assert.match(sourceV2, /--authorize-flyco-live-trial/);
  assert.match(sourceV2, /FLYCO_LIVE_TRIAL_NOT_AUTHORIZED/);
});
