import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/inputController.js';

test('number hotkeys select all ten tool and stock-seed slots', () => {
  const input = new InputController();
  input.setGameplayEnabled(true);
  const expected = [
    ['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Digit4', 3], ['Digit5', 4],
    ['Digit6', 5], ['Digit7', 6], ['Digit8', 7], ['Digit9', 8], ['Digit0', 9],
  ];
  for (const [code, slot] of expected) {
    assert.deepEqual(input.keyDown(code, false), [{ type: 'select-slot', slot }]);
    input.keyUp(code);
  }
});

test('one-shot tool changes never repeat while a key is held', () => {
  const input = new InputController();
  input.setGameplayEnabled(true);
  assert.deepEqual(input.keyDown('Digit2', false), [{ type: 'select-slot', slot: 1 }]);
  assert.deepEqual(input.keyDown('Digit2', true), []);
  assert.equal(input.isHeld('Digit2'), true);
});

test('leaving pointer lock clears movement and blocks actions', () => {
  const input = new InputController();
  input.setGameplayEnabled(true);
  input.keyDown('KeyW');
  input.keyDown('ShiftLeft');
  input.setGameplayEnabled(false);
  assert.equal(input.isHeld('KeyW'), false);
  assert.equal(input.isHeld('ShiftLeft'), false);
  assert.deepEqual(input.primaryDown(), []);
  assert.deepEqual(input.keyDown('Digit3'), []);
});

test('click produces exactly one tool action only during gameplay', () => {
  const input = new InputController();
  assert.deepEqual(input.primaryDown(), []);
  input.setGameplayEnabled(true);
  assert.deepEqual(input.primaryDown(), [{ type: 'use-tool' }]);
});

test('interaction action is stable and key release cannot trigger it', () => {
  const input = new InputController();
  input.setGameplayEnabled(true);
  assert.deepEqual(input.keyDown('KeyE'), [{ type: 'interact' }]);
  input.keyUp('KeyE');
  assert.equal(input.isHeld('KeyE'), false);
});
