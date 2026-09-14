import { keccak256, toUtf8Bytes } from 'ethers';

export const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

export function activationPlanPayload(batch) {
  return {
    activation: batch.activation,
    safeAttestation: batch.meta?.safeAttestation,
    foundation: batch.foundationAttestation,
    creationHashes: batch.creationHashes,
    economicPreflight: batch.economicPreflight,
    targetSequenceSimulation: batch.meta?.targetSequenceSimulation,
    transactions: batch.transactions,
  };
}

export function activationPlanDigest(batch) {
  return keccak256(toUtf8Bytes(JSON.stringify(stable(activationPlanPayload(batch)))));
}

export function assertActivationPlanDigest(batch) {
  const digest=activationPlanDigest(batch);
  if(digest!==batch.meta?.checksum)throw new Error('ACTIVATION_PLAN_DIGEST_MISMATCH');
  return digest;
}
