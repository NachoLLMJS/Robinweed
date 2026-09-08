import { moveCircle } from '../src/collisionMath.js';
import { boundsForLocation, cityBuildingFor } from '../src/navigationState.js';
import { STREET_LAYOUT } from '../src/streetLifeState.js';

export const OUTSIDE_SPAWN = Object.freeze({ x: 0, z: 9.55 });
export function outsideSpawnForSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 64) throw new Error('INVALID_SPAWN_SLOT');
  return Object.freeze({ x: ((slot % 8) - 3.5) * 0.8, z: OUTSIDE_SPAWN.z + Math.floor(slot / 8) * 0.8 });
}
const PLAYER_RADIUS = 0.28;
const OUTSIDE_BOUNDS = boundsForLocation('street');
const OUTSIDE_OBSTACLES = Object.freeze([
  cityBuildingFor('shop').obstacle,
  cityBuildingFor('house').obstacle,
  ...STREET_LAYOUT.obstacles,
]);

export function advanceOutsidePlayer(state, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 0.1) throw new Error('INVALID_TICK_DELTA');
  const forward = Number(state.buttons.includes('forward')) - Number(state.buttons.includes('backward'));
  const strafe = Number(state.buttons.includes('right')) - Number(state.buttons.includes('left'));
  const length = Math.hypot(forward, strafe) || 1;
  const speed = state.buttons.includes('run') ? 5.1 : 3.25;
  const delta = {
    x: (-Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe) / length * speed * deltaSeconds,
    z: (-Math.cos(state.yaw) * forward - Math.sin(state.yaw) * strafe) / length * speed * deltaSeconds,
  };
  const next = moveCircle(state, delta, OUTSIDE_OBSTACLES, OUTSIDE_BOUNDS, PLAYER_RADIUS);
  return { ...state, x: next.x, z: next.z };
}
