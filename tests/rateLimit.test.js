import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedWindowLimiter } from '../server/rateLimit.js';

test('fixed-window limiter allows its bound and rejects excess until the next window', () => {
  let now = 0;
  const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.equal(limiter.accept('ip'), true);
  assert.equal(limiter.accept('ip'), true);
  assert.equal(limiter.accept('ip'), false);
  now = 1001;
  assert.equal(limiter.accept('ip'), true);
});

test('fixed-window limiter rejects empty keys', () => {
  const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.accept(''), false);
});

test('fixed-window limiter keeps attacker-controlled key storage strictly bounded', () => {
  const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 1000, maxEntries: 3, now: () => 0 });
  for (const key of ['a', 'b', 'c']) assert.equal(limiter.accept(key), true);
  assert.equal(limiter.accept('d'), false);
  assert.ok(limiter.size <= 3);
});
