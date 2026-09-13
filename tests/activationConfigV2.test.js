import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePonsActivationConfig } from '../scripts/lib/activationConfigV2.js';
import { externalConfigPath } from '../scripts/lib/localPaths.js';

const rehearsalPath=externalConfigPath('STOCKDEALER_FLYCO_REHEARSAL_ONLY.json');

test('Pons rehearsal config validates seven typed curve routes and remains impossible to broadcast', async () => {
  const config=JSON.parse(await readFile(rehearsalPath,'utf8'));
  const validated=validatePonsActivationConfig(config);
  assert.equal(validated.rehearsalOnly,true);
  assert.equal(validated.activateAfterValidation,false);
  assert.equal(validated.symbols.length,7);
  assert.equal(validated.routes.GOOGL.downstreamPath,'0x');
});

test('Pons production activation requires STOCKDEALER identity and explicit activation authorization', async () => {
  const config=JSON.parse(await readFile(rehearsalPath,'utf8'));
  assert.throws(()=>validatePonsActivationConfig({...config,rehearsalOnly:false,productionReady:true,activateAfterValidation:true}),/PRODUCTION_TOKEN_SYMBOL_REQUIRED/);
  const production={...config,rehearsalOnly:false,productionReady:true,activateAfterValidation:true,expectedTokenSymbol:'STOCKDEALER'};
  assert.equal(validatePonsActivationConfig(production).productionReady,true);
});

test('FLYCO live trial requires the exact provisional token and remains distinct from production', async () => {
  const config=JSON.parse(await readFile(rehearsalPath,'utf8'));
  const trial={...config,rehearsalOnly:false,productionReady:false,activateAfterValidation:true,trialMainnet:true};
  assert.equal(validatePonsActivationConfig(trial).trialMainnet,true);
  assert.throws(()=>validatePonsActivationConfig({...trial,tokenAddress:'0x0000000000000000000000000000000000000002'}),/INVALID_TRIAL_TOKEN/);
});
