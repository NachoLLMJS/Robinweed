export function advanceCadence(deadline, now, interval) {
  if (!Number.isFinite(deadline) || !Number.isFinite(now) || !Number.isFinite(interval) || interval <= 0) {
    throw new Error('INVALID_CADENCE');
  }
  const elapsed = now - deadline;
  if (elapsed + 1e-7 < interval) return { send: false, deadline };
  const steps = Math.max(1, Math.floor((elapsed + 1e-7) / interval));
  return { send: true, deadline: deadline + steps * interval };
}

export function reconcilePredictedPosition(local, authoritative, deltaSeconds, moving) {
  const distance = Math.hypot(authoritative.x - local.x, authoritative.z - local.z);
  if (moving && distance <= 0.75) return { ...local };
  const rate = moving ? 3 : 10;
  const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) * rate);
  return {
    x: local.x + (authoritative.x - local.x) * alpha,
    z: local.z + (authoritative.z - local.z) * alpha,
  };
}

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function sampleRemoteMotion(track, now) {
  const alpha = Math.min(1.25, Math.max(0, (now - track.updatedAt) / Math.max(20, track.interval)));
  const facingAlpha = Math.min(1, alpha);
  return {
    x: track.from.x + (track.to.x - track.from.x) * alpha,
    z: track.from.z + (track.to.z - track.from.z) * alpha,
    yaw: track.from.yaw + shortestAngle(track.from.yaw, track.to.yaw) * facingAlpha,
  };
}

export function beginRemoteMotion(track, sample, now) {
  if (!track) return { from: { ...sample }, to: { ...sample }, updatedAt: now, interval: 50 };
  const rendered = sampleRemoteMotion(track, now);
  const gap = now - track.updatedAt;
  const interval = gap > 5 && gap < 500 ? track.interval * 0.7 + gap * 0.3 : track.interval;
  return { from: rendered, to: { ...sample }, updatedAt: now, interval };
}
