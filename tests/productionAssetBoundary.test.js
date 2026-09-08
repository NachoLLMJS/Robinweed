import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
const srcPath = fileURLToPath(new URL('../src/', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const source = [
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ...files(srcPath).filter(path => path.endsWith('.js')).map(path => readFileSync(path, 'utf8')),
].join('\n');
const runtimeUrls = new Set([...source.matchAll(/["'`](\/(?:models(?:-v\d+)?|textures|brands|video)\/[^"'`?]+)(?:\?[^"'`]*)?["'`]/g)].map(match => match[1]));

test('every root-relative runtime asset exists in public', () => {
  for (const url of runtimeUrls) assert.equal(statSync(join(publicPath, url.slice(1))).isFile(), true, url);
});

test('large public assets are explicitly referenced by runtime source', () => {
  const unreferenced = [];
  for (const path of files(publicPath)) {
    if (statSync(path).size < 512 * 1024) continue;
    const url = `/${relative(publicPath, path).replaceAll('\\', '/')}`;
    if (!runtimeUrls.has(url)) unreferenced.push(url);
  }
  assert.deepEqual(unreferenced, []);
});

test('production styles do not import remote fonts blocked by the server CSP', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /@import\s+url\(['"]?https?:\/\//i);
});

test('every published asset is pinned by an exact SHA-256 allowlist', () => {
  const manifest = JSON.parse(readFileSync(new URL('../config/public-assets.sha256.json', import.meta.url), 'utf8'));
  const actual = Object.fromEntries(files(publicPath).map(path => [relative(publicPath, path).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(path)).digest('hex')]));
  assert.deepEqual(actual, manifest);
});
