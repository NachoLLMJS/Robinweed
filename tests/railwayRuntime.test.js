import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const railway = readFileSync(new URL('../railway.toml', import.meta.url), 'utf8');
const railwayIndexer = readFileSync(new URL('../railway.indexer.toml', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

test('Railway starts the production API/realtime process on injected PORT and all interfaces', () => {
  assert.equal(packageJson.scripts.start, 'node server/index.js');
  assert.match(railway, /startCommand = "npm start"/);
  assert.match(server, /listen\(config\.port, '0\.0\.0\.0'/);
  assert.match(server, /SIGTERM/);
  assert.match(server, /\.\.\.OUTSIDE_SPAWN/);
});

test('Railway runtime authenticates WebSocket upgrades and never loads deployment keys', () => {
  assert.match(server, /authenticateSession/);
  assert.match(server, /request\.headers\.origin !== config\.publicOrigin/);
  assert.doesNotMatch(server, /DEPLOYER_PRIVATE_KEY/);
  assert.match(server, /split\(','\).*\.at\(-1\)/s);
  assert.doesNotMatch(server, /split\(','\)\[0\]/);
});

test('Railway has an explicit private indexer service command', () => {
  assert.equal(packageJson.scripts['start:indexer'], 'node server/indexer.js');
  assert.match(railwayIndexer, /startCommand = "npm run start:indexer"/);
  assert.doesNotMatch(railwayIndexer, /healthcheckPath|domain|public/i);
});
