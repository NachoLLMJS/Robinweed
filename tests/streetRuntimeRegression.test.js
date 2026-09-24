import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STREET_LAYOUT, STREET_WALKERS, advanceStrollPatrol } from '../src/streetLifeState.js';
import { propColliders, solidosPresetById, DEFAULT_SOLIDOS_PRESET } from '../src/propColliderState.js';
import { dressingColliders, veredaPresetById, DEFAULT_VEREDA_PRESET } from '../src/streetDressingState.js';
import { cornerColliders, islaPresetById, DEFAULT_ISLA_PRESET } from '../src/spawnCornerState.js';
import { POINT_BUDGET, assignBudgetSlots, budgetPlacement, buildFixtureTable, tuneFixtures } from '../src/lightBudget.js';
import { lightingPresetById, DEFAULT_LIGHTING_PRESET } from '../src/lightingPresets.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

test('animated neighborhood walkers translate, turn and pause their walk clip while dwelling', () => {
  let patrol = { distance: 10, direction: 1, dwell: 0 };
  patrol = advanceStrollPatrol(patrol, 0.5, 10, 20, 2, 1.5);
  assert.deepEqual(patrol, { distance: 11, direction: 1, dwell: 0, moving: true });
  patrol = advanceStrollPatrol({ distance: 19.8, direction: 1, dwell: 0 }, 0.5, 10, 20, 2, 1.5);
  assert.deepEqual(patrol, { distance: 20, direction: -1, dwell: 1.5, moving: false });

  assert.match(main, /streetWalkerActors\.forEach\(entry=>\{/);
  assert.match(main, /entry\.patrol=advanceStrollPatrol\(entry\.patrol,dt,entry\.walker\.minZ,entry\.walker\.maxZ,entry\.walker\.speed/);
  assert.match(main, /entry\.actor\.position\.z=entry\.patrol\.distance/);
  assert.match(main, /entry\.actor\.rotation\.y\+=turn\*Math\.min\(1,dt\*5\)/);
  assert.match(main, /entry\.action\.paused=!entry\.patrol\.moving/);
});

test('every additional walker route remains on a sidewalk and clears all live street obstacles', () => {
  const paved = [{ minZ: 6, maxZ: 30.4 }, { minZ: 37.6, maxZ: 110 }];
  const obstacles = [
    ...propColliders(solidosPresetById(DEFAULT_SOLIDOS_PRESET)),
    ...dressingColliders(veredaPresetById(DEFAULT_VEREDA_PRESET)),
    ...cornerColliders(islaPresetById(DEFAULT_ISLA_PRESET)),
  ];
  assert.ok(obstacles.length > 0);
  for (const walker of STREET_WALKERS) {
    assert.ok(paved.some(segment => walker.minZ >= segment.minZ && walker.maxZ <= segment.maxZ), `${walker.key} leaves paved sidewalk`);
    const route = { minX: walker.lane - 0.35, maxX: walker.lane + 0.35, minZ: walker.minZ - 0.35, maxZ: walker.maxZ + 0.35 };
    const hits = obstacles.filter(obstacle => overlaps(route, obstacle)).map(obstacle => obstacle.id);
    assert.deepEqual(hits, [], `${walker.key} crosses ${hits.join(', ')}`);
  }
});

test('street lamp pool follows the street camera and applies real illumination each frame', () => {
  const fixtures = tuneFixtures(buildFixtureTable({ lamps: STREET_LAYOUT.lamps, restaurant: STREET_LAYOUT.restaurant }), lightingPresetById(DEFAULT_LIGHTING_PRESET));
  const slots = assignBudgetSlots(null, 'street', 0, 12, fixtures);
  const placement = budgetPlacement(slots, 'street', fixtures);
  assert.equal(placement.length, POINT_BUDGET.slots);
  assert.ok(placement.some(entry => entry.fixtureId?.startsWith('lamp-') && entry.intensity > 0), 'a nearby streetlamp must receive a live light slot');
  const parked = budgetPlacement(assignBudgetSlots(null, 'disabled', 0, 0, fixtures), 'disabled', fixtures);
  assert.ok(parked.every(entry => entry.fixtureId === null && entry.intensity === 0), 'street lights must stay parked inside every interior');

  assert.match(main, /const lightZone=state\.location==='street'\?'street':'disabled'/);
  assert.match(main, /if\(now-lightSlotsAt>=POINT_BUDGET\.updateMs\)/);
  assert.match(main, /lightSlots=assignBudgetSlots\(lightSlots,lightZone,camera\.position\.x,camera\.position\.z,lightFixtures\)/);
  assert.match(main, /lightPlacement=budgetPlacement\(lightSlots,lightZone,lightFixtures\)/);
  assert.match(main, /refreshLampPools\(lightPlacement\)/);
  assert.match(main, /l\.position\.set\(p\.x,p\.y,p\.z\)/);
  assert.match(main, /l\.intensity=p\.intensity/);
});
