import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const tickers = ['MSFT','TSLA','NVDA','MSTR','AAPL','QQQ','GOOGL'];

test('hotbar exposes ten ordered selectable slots including all seven stock packets', () => {
  const slots = [...html.matchAll(/data-slot="(\d+)"/g)].map(match => Number(match[1]));
  assert.deepEqual(slots, [0,1,2,3,4,5,6,7,8,9]);
  assert.match(html, /data-slot="2"[\s\S]*?<kbd>3<\/kbd>[\s\S]*?data-ticker="HOOD"[\s\S]*?<small>HOOD SEEDS<\/small>/);
  for (const ticker of tickers) assert.match(html, new RegExp(`data-ticker="${ticker}"`));
  assert.doesNotMatch(html, /data-ticker="RDDT"/);
  assert.match(html, /<kbd>9<\/kbd>[\s\S]*data-ticker="QQQ"/);
  assert.match(html, /<kbd>0<\/kbd>[\s\S]*data-ticker="GOOGL"/);
});

test('all stock packets load as first-person viewmodels and remain seed tools', () => {
  assert.match(main, /Array\.from\(\{ length: 10 \}/);
  assert.match(main, /Object\.entries\(ASSET_URLS\.items\.stockSeedPacks\)/);
  assert.match(main, /loadViewModel\(index \+ 3, url/);
  assert.match(main, /state\.slot >= 2/);
  assert.match(main, /input\.keyDown\(e\.code,e\.repeat\)/);
  assert.match(css, /\.stats\{position:fixed;right:24px;bottom:96px/);
});
