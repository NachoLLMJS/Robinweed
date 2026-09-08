export function isNeighborGuideNearby(player, npc, radius = 2.6) {
  return Math.hypot(player.x - npc.x, player.z - npc.z) <= radius;
}
