import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { keccak256, toUtf8Bytes } from 'ethers';

const deploy = readFileSync(new URL('../scripts/deploy-robinhood-mainnet-v4.js', import.meta.url), 'utf8');
const activate = readFileSync(new URL('../scripts/activate-stockdealer-mainnet-v4.js', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-robinhood-mainnet-v4.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../scripts/generate-mainnet-manifest-v4.js', import.meta.url), 'utf8');
const plan = JSON.parse(readFileSync(new URL('../deployments/stockdealer-mainnet-foundation-v4-plan.json', import.meta.url), 'utf8'));
const batch = JSON.parse(readFileSync(new URL('../deployments/stockdealer-mainnet-foundation-v4-safe-batch.json', import.meta.url), 'utf8'));
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;

test('V4 plan digest commits the pinned block, full Safe attestation, addresses and final transaction array', () => {
  const digest = keccak256(toUtf8Bytes(JSON.stringify(stable({
    baseDigest: plan.baseDigest,
    safeAttestation: plan.safe,
    pinnedBlock: plan.pinnedBlock,
    addresses: plan.contracts,
    transactions: batch.transactions
  }))));
  assert.equal(digest, plan.planDigest);
  assert.equal(batch.meta.checksum, plan.planDigest);
  assert.match(plan.pinnedBlock.hash, /^0x[0-9a-f]{64}$/);
  assert.match(plan.safe.codeHash, /^0x[0-9a-f]{64}$/);
  const altered = structuredClone(batch.transactions);
  altered[0].value = '1';
  assert.notEqual(keccak256(toUtf8Bytes(JSON.stringify(stable({ baseDigest: plan.baseDigest, safeAttestation: plan.safe, pinnedBlock: plan.pinnedBlock, addresses: plan.contracts, transactions: altered })))), plan.planDigest);
});

test('V4 deployment pins official Pons and routing infrastructure by runtime hash', () => {
  for (const marker of ['StockdealerPonsLifecycleAdapterV4', 'INFRA_HASHES', 'UNIVERSAL_ROUTER', 'PERMIT2', 'POOL_MANAGER', 'MEME_HOOK']) assert.match(deploy, new RegExp(marker));
  assert.match(deploy, /OFFICIAL_INFRASTRUCTURE_MISMATCH/);
});

test('V4 launch plan contains one Controller transaction and forbids provisional FLYCO', () => {
  assert.match(activate, /PROVISIONAL_FLYCO_FORBIDDEN_FOR_V4/);
  assert.match(activate, /transactions=\[\{to:getAddress\(await controller\.getAddress\(\)\)/);
  assert.doesNotMatch(activate, /transactions\.push/);
  assert.match(activate, /activateStockdealerEconomy/);
  assert.match(activate, /PONS_INFRASTRUCTURE_MISMATCH/);
});

test('V4 activation pins all preflight reads and rejects Safe or Controller drift', () => {
  assert.match(activate, /head-confirmationDepth/);
  assert.match(activate, /verifySafe\(provider,admin,env,blockNumber\)/);
  assert.match(activate, /\{blockTag:blockNumber\}/);
  assert.match(activate, /foundationAttestation=\{planDigest:foundation\.planDigest,deploymentTxHash:foundation\.deploymentTxHash,blockNumber:foundation\.blockNumber,blockHash:foundation\.blockHash/);
  assert.match(activate, /ACTIVATION_STATE_CHANGED_DURING_PREFLIGHT/);
});

test('V4 postdeploy verification authenticates fresh artifacts and the exact Safe MultiSend payload', () => {
  assert.match(verify, /compile','--force/);
  assert.match(verify, /decodeFunctionData\('execTransaction'/);
  assert.match(verify, /decodeFunctionData\('multiSend'/);
  assert.match(verify, /assertPackedBatch\(packed,batch\.transactions\)/);
  assert.match(verify, /plan\.safe\.multiSend\.codeHash/);
  assert.match(verify, /getTransactionHash\(multiSendAddress/);
  assert.match(verify, /SAFE_TRANSACTION_HASH_MISMATCH/);
  assert.match(verify, /V4_CREATION_ARTIFACT_MISMATCH/);
});

test('V4 activation economically simulates the maximum 100-pack seed purchase', () => {
  assert.match(activate, /const MAX_PACKS_PER_PURCHASE = 100n/);
  assert.match(activate, /seedPrice\*MAX_PACKS_PER_PURCHASE\*60n\/100n/);
});

test('V4 manifest is generated only from verified onchain deployments and supports paused/active modes', () => {
  assert.match(manifest, /V4_NOT_ACTIVATED_ONCHAIN/);
  assert.match(manifest, /const pausedMode=process\.argv\.includes\('--paused'\)/);
  assert.match(manifest, /FOUNDATION_V4_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED/);
  assert.match(manifest, /V4_NOT_PAUSED_TOKEN_UNCONFIGURED/);
  assert.match(manifest, /expectedCodeHash:journal\.codeHashes/);
  assert.match(manifest, /currency:pausedMode\?null:token/);
  assert.match(manifest, /wateringMode:'visual'/);
});

test('V4 activation has a dedicated plan-bound executor and post-activation verifier', () => {
  const executor=readFileSync(new URL('../scripts/execute-stockdealer-mainnet-v4-activation.js',import.meta.url),'utf8');
  const verifier=readFileSync(new URL('../scripts/verify-stockdealer-mainnet-v4-activation.js',import.meta.url),'utf8');
  for(const source of [executor,verifier]){
    assert.match(source,/ACTIVATION_PLAN_DIGEST_MISMATCH/);
    for(const field of ['safeAttestation','foundationAttestation','creationHashes','economicPreflight','targetSequenceSimulation','transactions']) assert.match(source,new RegExp(field));
  }
  assert.match(executor,/getTransactionHash/);
  assert.match(executor,/execTransaction\.staticCall/);
  assert.match(executor,/signingKey\.sign\(safeTxHash\)/);
  assert.match(verifier,/ExecutionSuccess/);
  assert.match(verifier,/activateStockdealerEconomy/);
  assert.match(verifier,/controller\.activated/);
  assert.match(verifier,/safeTxGas!==0n\|\|baseGas!==0n\|\|gasPrice!==0n/);
  assert.match(verifier,/getAddress\(gasToken\)!==ZeroAddress\|\|getAddress\(refundReceiver\)!==ZeroAddress/);
});

test('V4 route simulation checks native residue for ERC20 and native pairs',()=>{
  assert.match(activate,/preNative=adapter\.interface\.decodeFunctionResult\('nativeBalance'/);
  assert.match(activate,/postNative=adapter\.interface\.decodeFunctionResult\('nativeBalance'/);
  assert.match(activate,/native:preNative/);
  assert.match(activate,/native:postNative/);
});
