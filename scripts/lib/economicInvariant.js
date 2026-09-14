export function assertNoNewResidue(before, after) {
  for (const key of ['input', 'pair', 'target', 'native']) {
    if (BigInt(after[key]) !== BigInt(before[key])) throw new Error(`ECONOMIC_ROUTE_RESIDUE_INCREASED:${key}`);
  }
}
