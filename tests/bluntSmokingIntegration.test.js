import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InputController } from '../src/inputController.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('F is a one-shot smoke action and repeats do not consume another blunt', () => {
  const input = new InputController();
  input.setGameplayEnabled(true);
  assert.deepEqual(input.keyDown('KeyF'), [{ type: 'smoke-blunt' }]);
  assert.deepEqual(input.keyDown('KeyF', true), []);
  input.keyUp('KeyF');
  assert.deepEqual(input.keyDown('KeyF'), [{ type: 'smoke-blunt' }]);
});

test('runtime wires F to a procedural blunt, smoke particles and a twenty-second high', () => {
  assert.match(main, /action\.type==='smoke-blunt'/);
  assert.match(main, /function smokeBlunt\(\)/);
  assert.match(main, /function stepBlunt\(dt,now\)/);
  assert.match(main, /function exhaleSmoke\(\)/);
  assert.match(main, /function dropBlunt\(\)/);
  assert.match(main, /stepBlunt\(dt,now\)/);
  assert.match(main, /advanceSmoke\(dt,smokeWindFor\(state\.location\)\)/);
});

test('high overlay and readout exist and the warehouse artwork keeps the visible bong', () => {
  assert.match(html, /id="highOverlay"/);
  assert.match(html, /id="highReadout"/);
  assert.match(css, /\.high-overlay/);
  assert.match(main, /ASSET_URLS\.textures\.growthDiagram/);
  assert.equal(readFileSync(new URL('../public/textures/warehouse/pizarra.png', import.meta.url)).length > 100000, true);
});
