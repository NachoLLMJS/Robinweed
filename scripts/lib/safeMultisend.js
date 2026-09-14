import { getAddress } from 'ethers';

export function packBatch(transactions) {
  return `0x${transactions.map(transaction => {
    const data=transaction.data;
    if(!/^0x[0-9a-fA-F]*$/.test(data)||data.length%2!==0)throw new Error('SAFE_MULTISEND_PAYLOAD_INVALID');
    return [
      '00',
      getAddress(transaction.to).slice(2).toLowerCase(),
      BigInt(transaction.value).toString(16).padStart(64,'0'),
      BigInt((data.length-2)/2).toString(16).padStart(64,'0'),
      data.slice(2).toLowerCase()
    ].join('');
  }).join('')}`;
}

export function assertPackedBatch(packed, expected) {
  if (!/^0x[0-9a-fA-F]*$/.test(packed)) throw new Error('SAFE_MULTISEND_PAYLOAD_INVALID');
  const hex = packed.slice(2);
  let offset = 0;
  let index = 0;
  while (offset < hex.length) {
    if (hex.length - offset < 170 || index >= expected.length) throw new Error('SAFE_MULTISEND_PAYLOAD_INVALID');
    const operation = Number.parseInt(hex.slice(offset, offset + 2), 16); offset += 2;
    const to = getAddress(`0x${hex.slice(offset, offset + 40)}`); offset += 40;
    const value = BigInt(`0x${hex.slice(offset, offset + 64)}`); offset += 64;
    const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`)); offset += 64;
    if (!Number.isSafeInteger(length) || length < 0 || offset + length * 2 > hex.length) throw new Error('SAFE_MULTISEND_PAYLOAD_INVALID');
    const data = `0x${hex.slice(offset, offset + length * 2)}`; offset += length * 2;
    const target = expected[index++];
    if (operation !== 0 || to !== getAddress(target.to) || value !== BigInt(target.value) || data.toLowerCase() !== target.data.toLowerCase()) throw new Error(`SAFE_MULTISEND_CALL_MISMATCH:${index - 1}`);
  }
  if (offset !== hex.length || index !== expected.length) throw new Error('SAFE_MULTISEND_CALL_COUNT_MISMATCH');
}
