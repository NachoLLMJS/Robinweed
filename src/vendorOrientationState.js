export function vendorYawTowardPlayer(vendorPosition, playerPosition) {
  const dx = playerPosition.x - vendorPosition.x;
  const dz = playerPosition.z - vendorPosition.z;
  return Math.atan2(dz, -dx);
}
