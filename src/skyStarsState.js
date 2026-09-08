export const SKY_STAR_COUNT = 420;
export const SKY_STAR_RADIUS = 68;

export function buildSkyStarPositions(count = SKY_STAR_COUNT, radius = SKY_STAR_RADIUS) {
  const positions = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const progress = (index + 0.5) / count;
    const vertical = 0.16 + progress * 0.78;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const angle = index * goldenAngle;
    positions.push(
      Math.cos(angle) * radius * horizontal,
      radius * vertical,
      Math.sin(angle) * radius * horizontal,
    );
  }
  return positions;
}
