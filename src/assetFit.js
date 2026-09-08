export function fitScaleForWorldBox(size, limits, rotationY = 0) {
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const worldWidthX = cosine * size.x + sine * size.z;
  const worldDepthZ = sine * size.x + cosine * size.z;
  return Math.min(
    limits.maxWidthX / worldWidthX,
    limits.maxDepthZ / worldDepthZ,
    limits.maxHeight / size.y,
  );
}
