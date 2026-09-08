import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCadence, beginRemoteMotion, reconcilePredictedPosition, sampleRemoteMotion } from '../src/multiplayerSmoothing.js';

test('small network lag never pulls a moving predicted player backward', () => {
  const local = { x: 10, z: 20 };
  const authoritative = { x: 9.7, z: 20 };
  assert.deepEqual(reconcilePredictedPosition(local, authoritative, 1 / 60, true), local);
});

test('idle prediction converges smoothly without snapping and is frame-rate independent', () => {
  const local = { x: 10, z: 20 };
  const authoritative = { x: 9.7, z: 20 };
  const oneFrame = reconcilePredictedPosition(local, authoritative, 1 / 30, false);
  let twoFrames = local;
  twoFrames = reconcilePredictedPosition(twoFrames, authoritative, 1 / 60, false);
  twoFrames = reconcilePredictedPosition(twoFrames, authoritative, 1 / 60, false);
  assert.ok(oneFrame.x < local.x && oneFrame.x > authoritative.x);
  assert.ok(Math.abs(oneFrame.x - twoFrames.x) < 1e-12);
});

test('remote updates re-anchor from the pose already rendered on screen', () => {
  let track = beginRemoteMotion(null, { x: 0, z: 0, yaw: 0 }, 0);
  track = beginRemoteMotion(track, { x: 10, z: 0, yaw: 0 }, 50);
  assert.equal(sampleRemoteMotion(track, 75).x, 5);
  track = beginRemoteMotion(track, { x: 20, z: 0, yaw: 0 }, 75);
  assert.equal(track.from.x, 5);
  assert.equal(sampleRemoteMotion(track, 75).x, 5);
});

test('network cadence preserves 20Hz across common display refresh rates', () => {
  for (const refreshRate of [60, 90, 120, 144, 165]) {
    let deadline = 0;
    let sends = 0;
    for (let frame = 1; frame <= refreshRate * 10; frame++) {
      const cadence = advanceCadence(deadline, frame * 1000 / refreshRate, 50);
      deadline = cadence.deadline;
      if (cadence.send) sends++;
    }
    assert.ok(sends >= 199 && sends <= 200, `${refreshRate}Hz display produced ${sends} sends`);
  }
});
