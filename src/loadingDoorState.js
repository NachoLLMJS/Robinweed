const OPEN_DISTANCE = 3;
const TRAVEL_PER_SECOND = 2.4;

export function loadingDoorTarget(location, player, door) {
  if (location !== 'warehouse' && location !== 'street') return 0;
  return Math.hypot(player.x - door.x, player.z - door.z) <= OPEN_DISTANCE ? 1 : 0;
}

export function advanceLoadingDoor(current, target, deltaSeconds) {
  const step = TRAVEL_PER_SECOND * Math.max(0, deltaSeconds);
  if (target > current) return Math.min(target, current + step);
  return Math.max(target, current - step);
}
