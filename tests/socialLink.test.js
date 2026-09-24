import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('top-left X button links securely to the official Stockdealer account', () => {
  assert.match(html, /<a[^>]+class="social-x"[^>]+href="https:\/\/x\.com\/StockDealerRH"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Follow STOCKDEALER on X"/);
  assert.match(css, /\.social-x\{[^}]*position:fixed[^}]*left:/);
  assert.match(css, /@media\(max-width:620px\)[^{]*\{[^}]*\.social-x/);
});
