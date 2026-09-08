export const ONCHAIN_PROPERTY_IDS = Object.freeze({
  'START-WEST': 1,
  'START-EAST': 2,
  'HOME-001': 3,
  'HOME-002': 4,
  'HOME-003': 5,
  'HOME-004': 6,
  'HOME-005': 7,
  'HOME-006': 8,
  'HOME-007': 9,
  'HOME-008': 10,
  'HOME-009': 11,
  'HOME-010': 12,
  'HOME-011': 13,
  'HOME-012': 14,
  'HOME-013': 15,
  'HOME-014': 16,
  'HOME-015': 17,
  'HOME-016': 18,
  'HOME-017': 19,
  'HOME-018': 20,
  'HOME-019': 21,
  'HOME-020': 22,
  'HOME-021': 23,
  'HOME-022': 24,
  'HOME-023': 25,
  'HOME-024': 26,
  'HOME-025': 27,
  'HOME-026': 28,
  'HOME-027': 29,
  'HOME-028': 30,
  'BLOCK-001': 31,
  'BLOCK-002': 32,
  'BLOCK-003': 33,
  'BLOCK-004': 34,
  'BLOCK-005': 35,
});

export const PROPERTY_IDS_BY_ONCHAIN_ID = Object.freeze(Object.fromEntries(Object.entries(ONCHAIN_PROPERTY_IDS).map(([propertyId, onchainId]) => [onchainId, propertyId])));

export function propertyIdFromOnchain(onchainId) {
  const value = PROPERTY_IDS_BY_ONCHAIN_ID[onchainId];
  if (!value) throw new Error('ONCHAIN_PROPERTY_NOT_REGISTERED');
  return value;
}

export function onchainPropertyId(propertyId) {
  const value = ONCHAIN_PROPERTY_IDS[propertyId];
  if (!value) throw new Error('PROPERTY_NOT_REGISTERED_ONCHAIN');
  return value;
}
