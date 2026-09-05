const ONE_SHOT_KEYS = new Map([
  ['Digit1', { type: 'select-slot', slot: 0 }],
  ['Digit2', { type: 'select-slot', slot: 1 }],
  ['Digit3', { type: 'select-slot', slot: 2 }],
  ['KeyE', { type: 'interact' }],
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
    const action = ONE_SHOT_KEYS.get(code);
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
