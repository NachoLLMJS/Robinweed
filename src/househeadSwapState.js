export const HOUSEHEAD_SWAP_ROUTE = Object.freeze({
  inputSymbol: 'ETH',
  outputSymbol: '$STOCKDEALER',
  network: 'Robinhood Chain',
  executable: false,
});

export function isHouseheadNearby(player, npc, radius = 2.6) {
  return Math.hypot(player.x - npc.x, player.z - npc.z) <= radius;
}

export function nextHouseheadPanel(current, event) {
  if (event === 'talk') return 'question';
  if (current === 'question' && event === 'accept') return 'swap';
  if (event === 'decline' || event === 'close') return 'closed';
  return current;
}
