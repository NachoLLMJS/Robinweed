const HASH = /^0x[0-9a-fA-F]{64}$/;

export async function corroboratedFinalizedHead(primary, secondary) {
  const [primaryNetwork, secondaryNetwork, primaryBlock, secondaryBlock] = await Promise.all([
    primary.getNetwork(),
    secondary.getNetwork(),
    primary.getBlock('finalized'),
    secondary.getBlock('finalized'),
  ]);
  if (primaryNetwork.chainId !== 4663n || secondaryNetwork.chainId !== 4663n) throw new Error('WRONG_CHAIN');
  if (!primaryBlock || !secondaryBlock || !Number.isSafeInteger(primaryBlock.number) || !Number.isSafeInteger(secondaryBlock.number)) {
    throw new Error('FINALIZED_TAG_UNAVAILABLE');
  }
  if (!HASH.test(primaryBlock.hash ?? '') || primaryBlock.number !== secondaryBlock.number || primaryBlock.hash.toLowerCase() !== secondaryBlock.hash?.toLowerCase()) {
    throw new Error('FINALITY_DISAGREEMENT');
  }
  return Object.freeze({ number: primaryBlock.number, hash: primaryBlock.hash });
}
