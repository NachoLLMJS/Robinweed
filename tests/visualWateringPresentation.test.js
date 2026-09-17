import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUAL_WATER_HOLD_MS,
  beginDisplayWatering,
  beginVisualWatering,
  advanceVisualWatering,
  visualWaterDrops,
} from '../src/visualWatering.js';

test('visual watering exposes presentation state only and clamps at completion', () => {
  const started = beginVisualWatering(4, 100);
  const halfway = advanceVisualWatering(started, VISUAL_WATER_HOLD_MS / 2);
  const done = advanceVisualWatering(halfway, VISUAL_WATER_HOLD_MS * 2);
  assert.deepEqual(Object.keys(done).sort(), ['complete', 'heldMs', 'potIndex', 'progress', 'startedAt']);
  assert.equal(halfway.progress, 0.5);
  assert.equal(done.progress, 1);
  assert.equal(done.complete, true);
  for (const forbidden of ['moisture', 'wateredAt', 'stage', 'quality', 'reward', 'care']) {
    assert.equal(forbidden in done, false);
  }
});

test('decorative display watering carries only an ephemeral visual target', () => {
  const started = beginDisplayWatering('DISPLAY-A-L1-P2', 250);
  const done = advanceVisualWatering(started, VISUAL_WATER_HOLD_MS);
  assert.deepEqual(Object.keys(done).sort(), ['complete', 'displayId', 'heldMs', 'progress', 'startedAt']);
  assert.equal(done.displayId, 'DISPLAY-A-L1-P2');
  assert.equal(done.complete, true);
  for (const forbidden of ['plotId', 'potIndex', 'moisture', 'wateredAt', 'reward', 'inventory']) {
    assert.equal(forbidden in done, false);
  }
});

test('hold progress is frame-rate independent', () => {
  let fast = beginVisualWatering(0, 0);
  for (let i = 0; i < 120; i += 1) fast = advanceVisualWatering(fast, 1000 / 60);
  let slow = beginVisualWatering(0, 0);
  for (let i = 0; i < 20; i += 1) slow = advanceVisualWatering(slow, 100);
  assert.ok(Math.abs(fast.progress - slow.progress) < 1e-9);
  assert.equal(slow.complete, true);
});

test('drop stream is bounded per frame and by live-particle capacity', () => {
  assert.deepEqual(visualWaterDrops(0, 1, 0), { emitted: 3, carry: 0 });
  assert.equal(visualWaterDrops(0, 0.125, 39).emitted, 1);
  assert.equal(visualWaterDrops(0, 0.125, 40).emitted, 0);
});
