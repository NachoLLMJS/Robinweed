const ONE_SHOT_KEYS = new Map([
  ['KeyE', { type: 'interact' }],
]);

const NUMERIC_SLOTS = new Map([
  ['Digit1', 0], ['Numpad1', 0],
  ['Digit2', 1], ['Numpad2', 1],
  ['Digit3', 2], ['Numpad3', 2],
  ['Digit4', 3], ['Numpad4', 3],
  ['Digit5', 4], ['Numpad5', 4],
  ['Digit6', 5], ['Numpad6', 5],
  ['Digit7', 6], ['Numpad7', 6],
  ['Digit8', 7], ['Numpad8', 7],
  ['Digit9', 8], ['Numpad9', 8],
  ['Digit0', 9], ['Numpad0', 9],
]);

export class InputController {
  constructor() {
    this.held = new Set();
    this.gameplayEnabled = false;
  }

  setGameplayEnabled(enabled) {
    this.gameplayEnabled = Boolean(enabled);
    if (!this.gameplayEnabled) this.releaseAll();
  }

  keyDown(code, repeat = false) {
    if (!this.gameplayEnabled) return [];
    this.held.add(code);
    const numericSlot = NUMERIC_SLOTS.get(code);
    const action = numericSlot === undefined ? ONE_SHOT_KEYS.get(code) : { type: 'select-slot', slot: numericSlot };
    return action && !repeat ? [{ ...action }] : [];
  }

  keyUp(code) {
    this.held.delete(code);
  }

  isHeld(code) {
    return this.gameplayEnabled && this.held.has(code);
  }

  primaryDown() {
    return this.gameplayEnabled ? [{ type: 'use-tool' }] : [];
  }

  releaseAll() {
    this.held.clear();
  }
}
