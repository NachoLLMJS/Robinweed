import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedOriginY } from '../src/placementMath.js';

test('places an object base directly on a supporting surface', () => {
  assert.equal(supportedOriginY({ surfaceY: 0.84, localMinY: 0 }), 0.84);
});

test('allows a tiny controlled inset to avoid visible floating gaps', () => {
  assert.equal(supportedOriginY({ surfaceY: 0.84, localMinY: 0, inset: 0.008 }), 0.832);
});

test('accounts for models whose local origin is below their base', () => {
  assert.ok(Math.abs(supportedOriginY({ surfaceY: 1.2, localMinY: -0.15, inset: 0.01 }) - 1.34) < 1e-12);
});
