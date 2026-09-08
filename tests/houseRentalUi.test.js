import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('HUD has no global house-rental menu and exposes only a contextual property panel', () => {
  assert.doesNotMatch(html, /id="rentals"|id="rentalPanel"|HOUSE RENTALS|RENT A/);
  assert.match(html, /id="propertyPanel"/);
  assert.match(html, /id="propertyOwner"/);
  assert.match(html, /id="propertyAction"/);
  assert.match(html, /PURCHASE PRICE/);
});

test('street proximity controls available, occupied and owner-only house actions', () => {
  assert.match(main, /HOUSE_PROPERTIES/);
  assert.match(main, /propertyNear\(camera\.position/);
  assert.match(main, /propertyAccess\(property,state\.walletAddress\)/);
  assert.match(main, /state\.near=\{type:'property'/);
  assert.match(main, /purchasePreview\(property,state\.walletAddress\)/);
  assert.match(main, /eth_requestAccounts/);
  assert.match(main, /OPEN PROPERTY/);
  assert.match(main, /OWNED BY/);
});

test('a house interior uses the active owned property capacity', () => {
  assert.match(main, /state\.activePropertyId/);
  assert.match(main, /activeProperty\(\)\?\.capacity/);
  assert.match(main, /station\.visible=index<capacity/);
});

test('receipt confirmation never grants local property ownership before authoritative state refresh', () => {
  const wholeAction = main.slice(main.indexOf('async function usePropertyAction()'), main.indexOf('\n\nfunction refresh()', main.indexOf('async function usePropertyAction()')));
  const purchaseAction = wholeAction.slice(wholeAction.indexOf("ui.propertyAction.textContent='PREPARING HOUSE QUOTE…'"));
  assert.doesNotMatch(purchaseAction, /state\.properties\.set\(/);
  assert.match(purchaseAction, /await refreshOnchainState\(\)/);
  assert.doesNotMatch(purchaseAction, /refreshOnchainState\(\)\.catch/);
});

test('receipt confirmation never mutates local crops before authoritative state refresh', () => {
  const toolAction = main.slice(main.indexOf('async function useOnchainTool('), main.indexOf('\nasync function useTool()', main.indexOf('async function useOnchainTool(')));
  assert.doesNotMatch(toolAction, /plantSeed\(|waterPlant\(|Object\.assign\(pot/);
  assert.match(toolAction, /await refreshOnchainState\(\)/);
  assert.doesNotMatch(toolAction, /refreshOnchainState\(\)\.catch/);
});
