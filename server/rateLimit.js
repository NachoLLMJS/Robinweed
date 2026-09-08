export function createFixedWindowLimiter({ limit, windowMs, maxEntries = 10_000, now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1 || !Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('INVALID_RATE_LIMIT');
  const buckets = new Map();
  return {
    accept(key) {
      if (typeof key !== 'string' || !key) return false;
      const current = now();
      let bucket = buckets.get(key);
      if (!bucket || current - bucket.startedAt >= windowMs) {
        if (!bucket && buckets.size >= maxEntries) {
          for (const [candidate, value] of buckets) if (current - value.startedAt >= windowMs) buckets.delete(candidate);
          if (buckets.size >= maxEntries) return false;
        }
        bucket = { startedAt: current, count: 0 };
        buckets.set(key, bucket);
      } else {
        buckets.delete(key);
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      return bucket.count <= limit;
    },
    get size() { return buckets.size; },
  };
}
