import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUNT_BUD_COST, bluntGradeFor, pickBluntTicker, rollBlunt } from '../src/blunt.js';
import { beginHigh, HIGH_TOTAL_MS, IDLE_HIGH, sampleHigh, smokeWindFor } from '../src/bluntHighState.js';

test('a blunt costs three harvested buds and never mutates its input', () => {
  assert.equal(BLUNT_BUD_COST, 3);
  const input = { buds: 7, ticker: 'TSLA' };
  const result = rollBlunt(input, 4200);
  assert.deepEqual(input, { buds: 7, ticker: 'TSLA' });
  assert.equal(result.changed, true);
  assert.equal(result.buds, 4);
  assert.equal(result.blunt.ticker, 'TSLA');
  assert.equal(result.blunt.color, '#e82127');
  assert.equal(result.blunt.label, 'TOP SHELF');
  assert.equal(result.blunt.rolledAt, 4200);
  assert.equal(bluntGradeFor(2), null);
  assert.equal(bluntGradeFor(3).key, 'street');
  assert.equal(bluntGradeFor(6).key, 'shelf');
  assert.equal(bluntGradeFor(9).key, 'reserve');
});

test('rolling fails closed without three buds and ticker selection is deterministic', () => {
  assert.equal(rollBlunt({ buds: 2, ticker: 'QQQ' }).changed, false);
  assert.equal(rollBlunt({ buds: 3, ticker: null }).changed, false);
  assert.equal(pickBluntTicker({ slotTicker: 'NVDA', claimableStocks: { QQQ: 20 } }), 'NVDA');
  assert.equal(pickBluntTicker({ claimableStocks: { MSFT: 4, QQQ: 9 } }), 'QQQ');
  assert.equal(pickBluntTicker({ claimableStocks: {} }), 'HOOD');
});

test('the smoking animation has draw, hold, exhale and haze phases for exactly twenty seconds', () => {
  assert.equal(HIGH_TOTAL_MS, 20000);
  const high = beginHigh(1, 1000);
  assert.equal(sampleHigh(high, 1000).phase, 'draw');
  assert.equal(sampleHigh(high, 2000).phase, 'hold');
  assert.equal(sampleHigh(high, 2700).phase, 'exhale');
  assert.equal(sampleHigh(high, 5000).phase, 'haze');
  assert.equal(sampleHigh(high, 21000), IDLE_HIGH);
  assert.ok(sampleHigh(high, 3900).fovOffset > 6.9);
  assert.equal(sampleHigh(high, 2700).exhaling, true);
});

test('smoke wind is stronger outdoors than inside the warehouse', () => {
  assert.ok(smokeWindFor('street').x > smokeWindFor('warehouse').x);
  assert.deepEqual(smokeWindFor('warehouse'), { x: 0.05, z: 0 });
});
