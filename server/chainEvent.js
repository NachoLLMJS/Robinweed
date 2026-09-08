const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function validateFinalizedEvent(event, allowlistedContracts) {
  if (!event || event.chainId !== 4663 || event.finality !== 'FINALIZED') throw new Error('EVENT_NOT_FINALIZED_MAINNET');
  if (!Number.isSafeInteger(event.blockNumber) || event.blockNumber < 0) throw new Error('INVALID_BLOCK_NUMBER');
  if (!HASH.test(event.blockHash) || !HASH.test(event.transactionHash)) throw new Error('INVALID_EVENT_HASH');
  if (!Number.isSafeInteger(event.logIndex) || event.logIndex < 0) throw new Error('INVALID_LOG_INDEX');
  if (!ADDRESS.test(event.contractAddress) || !allowlistedContracts?.has(event.contractAddress.toLowerCase())) throw new Error('CONTRACT_NOT_ALLOWLISTED');
  return event;
}

export function finalizedEventIdentity(event, allowlistedContracts) {
  validateFinalizedEvent(event, allowlistedContracts);
  return Object.freeze({
    rawUid: `${event.chainId}:${event.blockHash}:${event.transactionHash}:${event.logIndex}`,
    semanticUid: `${event.chainId}:${event.transactionHash}:${event.logIndex}`,
  });
}

export function serializeEventPayload(payload) {
  return JSON.stringify(payload, (_key, value) => typeof value === 'bigint' ? value.toString(10) : value);
}
