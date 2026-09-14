import test from 'node:test';
import assert from 'node:assert/strict';
import { activationPlanDigest, assertActivationPlanDigest } from '../scripts/lib/activationPlanDigest.js';

const batch={
  activation:{tokenAddress:'0x1111111111111111111111111111111111111111'},
  meta:{safeAttestation:{nonce:'1'},targetSequenceSimulation:'single-call-complete'},
  foundationAttestation:{planDigest:'0xabc'},
  creationHashes:{controller:'0xdef'},
  economicPreflight:{block:1,routes:{}},
  transactions:[{to:'0x2222222222222222222222222222222222222222',value:'0',data:'0x1234'}],
};
batch.meta.checksum=activationPlanDigest(batch);

test('activation digest binds every signed transaction byte and attestation',()=>{
  assert.doesNotThrow(()=>assertActivationPlanDigest(batch));
  for(const mutate of [
    copy=>{copy.transactions[0].value='1';},
    copy=>{copy.transactions[0].data='0x1235';},
    copy=>{copy.activation.tokenAddress='0x3333333333333333333333333333333333333333';},
    copy=>{copy.meta.safeAttestation.nonce='2';},
    copy=>{copy.economicPreflight.block=2;},
  ]){
    const altered=structuredClone(batch);mutate(altered);
    assert.throws(()=>assertActivationPlanDigest(altered),/ACTIVATION_PLAN_DIGEST_MISMATCH/);
  }
});
