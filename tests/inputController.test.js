import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/inputController.js';

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
