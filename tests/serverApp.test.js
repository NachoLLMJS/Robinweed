import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import http from 'node:http';
import { Wallet } from 'ethers';
import { createApiApp } from '../server/app.js';

function memoryRepository() {
  const challenges = new Map();
  return {
    ready: async () => true,
    saveChallenge: async challenge => challenges.set(challenge.nonce, challenge),
    consumeChallenge: async nonce => {
      const challenge = challenges.get(nonce);
      if (!challenge || challenge.usedAt) return null;
      challenge.usedAt = new Date();
      return { ...challenge, usedAt: null };
    },
    createSession: async address => ({ token: `session-${address}`, expiresAt: new Date(Date.now() + 3600_000) }),
    authenticateSession: async token => token === 'valid-session-token-which-is-long-enough' ? { userId: 'user-1', address: '0x1111111111111111111111111111111111111111' } : null,
  };
}

const config = { publicOrigin: 'https://stockdealer.example', chainId: 4663 };

test('API permits only the blob image and WebAssembly sources required by Three.js GLB assets', async () => {
  const app = createApiApp({ config, repository: memoryRepository() });
  const response = await request(app).get('/health/live');
  const csp = response.headers['content-security-policy'];
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /connect-src 'self' [^;]+ blob:/);
  assert.match(csp, /worker-src 'none'/);
  assert.doesNotMatch(csp, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/);
});

test('API exposes liveness/readiness and issues a strict SIWE challenge', async () => {
  const app = createApiApp({ config, repository: memoryRepository(), readGameState: async () => ({}), walletProvider: { send: async () => '0x1237' } });
  assert.equal((await request(app).get('/health/live')).status, 200);
  assert.equal((await request(app).get('/health/ready')).status, 200);
  const wallet = Wallet.createRandom();
  const response = await request(app).post('/auth/challenge').set('Origin', config.publicOrigin).send({ address: wallet.address });
  assert.equal(response.status, 200);
  assert.equal(response.body.chainId, 4663);
  assert.match(response.body.message, /stockdealer\.example wants you to sign in/);
});

test('paused production is not ready unless authenticated state reads and Robinhood RPC are available', async () => {
  const unavailable = createApiApp({ config: { ...config, publicConfig: { economyActive: false } }, repository: memoryRepository() });
  assert.equal((await request(unavailable).get('/health/ready')).status, 503);
  const available = createApiApp({
    config: { ...config, publicConfig: { economyActive: false } },
    repository: memoryRepository(),
    readGameState: async () => ({}),
    walletProvider: { send: async () => '0x1237' },
  });
  assert.equal((await request(available).get('/health/ready')).status, 200);
});

test('API verifies SIWE and returns only a secure opaque session cookie', async () => {
  const repository = memoryRepository();
  const app = createApiApp({ config, repository });
  const wallet = Wallet.createRandom();
  const challenge = await request(app).post('/auth/challenge').set('Origin', config.publicOrigin).send({ address: wallet.address });
  const signature = await wallet.signMessage(challenge.body.message);
  const response = await request(app).post('/auth/verify').set('Origin', config.publicOrigin).send({ nonce: challenge.body.nonce, message: challenge.body.message, signature });
  assert.equal(response.status, 204);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const replay = await request(app).post('/auth/verify').set('Origin', config.publicOrigin).send({ nonce: challenge.body.nonce, message: challenge.body.message, signature });
  assert.equal(replay.status, 401);
});

test('API rejects untrusted origins before auth processing', async () => {
  const app = createApiApp({ config, repository: memoryRepository() });
  const response = await request(app).post('/auth/challenge').set('Origin', 'https://evil.example').send({ address: Wallet.createRandom().address });
  assert.equal(response.status, 403);
});

test('API exposes only sanitized public mainnet configuration', async () => {
  const publicConfig = { chainId: 4663, economyActive: false, contracts: [{ name: 'GameCore', address: '0x1111111111111111111111111111111111111111' }] };
  const app = createApiApp({ config: { ...config, publicConfig, rpcPrimary: 'https://secret-rpc.example/key' }, repository: memoryRepository() });
  const response = await request(app).get('/api/config');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, publicConfig);
  assert.equal(JSON.stringify(response.body).includes('secret-rpc'), false);
});

test('seed quote endpoint is fail-closed until a verified quote service exists', async () => {
  const inactive = createApiApp({ config, repository: memoryRepository() });
  assert.equal((await request(inactive).get('/api/quote/seeds/MSFT?packs=1&slippageBps=100')).status, 503);
  const quoteSeed = async input => ({ ...input, totalPrice: '100', minimumStockOut: '59', deadlineSeconds: 300 });
  const active = createApiApp({ config, repository: memoryRepository(), quoteSeed });
  const response = await request(active).get('/api/quote/seeds/MSFT?packs=1&slippageBps=100');
  assert.equal(response.status, 200);
  assert.equal(response.body.minimumStockOut, '59');
});

test('authenticated state endpoint derives the wallet only from the secure session', async () => {
  const readGameState = async address => ({ chainId: 4663, address, properties: [], crops: [], seeds: {} });
  const app = createApiApp({ config, repository: memoryRepository(), readGameState });
  assert.equal((await request(app).get('/api/state')).status, 401);
  const response = await request(app).get('/api/state').set('Cookie', '__Host-stockdealer_session=valid-session-token-which-is-long-enough');
  assert.equal(response.status, 200);
  assert.equal(response.body.address, '0x1111111111111111111111111111111111111111');
});

test('authenticated state endpoint is rate-limited by IP and wallet', async () => {
  const readGameState = async address => ({ chainId: 4663, address, properties: [], crops: [], seeds: {} });
  const app = createApiApp({ config, repository: memoryRepository(), readGameState });
  const call = () => request(app).get('/api/state').set('Cookie', '__Host-stockdealer_session=valid-session-token-which-is-long-enough');
  for (let index = 0; index < 30; index += 1) assert.equal((await call()).status, 200);
  assert.equal((await call()).status, 429);
});

test('authenticated state endpoint caps concurrent expensive reads', async () => {
  const pending = [];
  const readGameState = () => new Promise(resolve => pending.push(resolve));
  const app = createApiApp({ config, repository: memoryRepository(), readGameState });
  const call = () => request(app).get('/api/state').set('Cookie', '__Host-stockdealer_session=valid-session-token-which-is-long-enough').then(response => response);
  const inFlight = Array.from({ length: 8 }, call);
  while (pending.length < 8) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await call()).status, 503);
  pending.splice(0).forEach(resolve => resolve({ ok: true }));
  await Promise.all(inFlight);
});

test('state RPC work times out, aborts, and releases its capacity slot', async () => {
  let calls = 0;
  let receivedSignal;
  const readGameState = (_address, { signal } = {}) => {
    calls += 1;
    receivedSignal = signal;
    return calls === 1 ? new Promise(() => {}) : Promise.resolve({ ok: true });
  };
  const app = createApiApp({ config, repository: memoryRepository(), readGameState, stateTimeoutMs: 10 });
  const call = () => request(app).get('/api/state').set('Cookie', '__Host-stockdealer_session=valid-session-token-which-is-long-enough');
  const timedOut = await call();
  assert.equal(timedOut.status, 503);
  assert.deepEqual(timedOut.body, { error: 'STATE_TIMEOUT' });
  assert.equal(receivedSignal.aborted, true);
  assert.equal((await call()).status, 200);
});

test('completed quote responses release one capacity slot exactly once', async () => {
  const pending = [];
  const quoteSeed = input => input.packs === 1
    ? Promise.resolve({ ok: true })
    : new Promise(resolve => pending.push(resolve));
  const app = createApiApp({ config, repository: memoryRepository(), quoteSeed });

  for (let index = 0; index < 8; index += 1) {
    assert.equal((await request(app).get('/api/quote/seeds/MSFT?packs=1&slippageBps=100')).status, 200);
  }
  const inFlight = Array.from({ length: 8 }, () => request(app).get('/api/quote/seeds/MSFT?packs=2&slippageBps=100').then(response => response));
  while (pending.length < 8) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await request(app).get('/api/quote/seeds/MSFT?packs=3&slippageBps=100')).status, 503);
  pending.splice(0).forEach(resolve => resolve({ ok: true }));
  await Promise.all(inFlight);
});

test('quote RPC work times out and receives an abort signal', async () => {
  let receivedSignal;
  const quoteSeed = input => {
    receivedSignal = input.signal;
    return new Promise(resolve => setTimeout(() => resolve({ late: true }), 50));
  };
  const app = createApiApp({ config, repository: memoryRepository(), quoteSeed, quoteTimeoutMs: 10 });
  const response = await request(app).get('/api/quote/seeds/MSFT?packs=1&slippageBps=100');
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: 'QUOTE_TIMEOUT' });
  assert.equal(receivedSignal.aborted, true);
});

test('aborted quote requests release their capacity slots', async () => {
  const pending = [];
  const app = createApiApp({
    config,
    repository: memoryRepository(),
    quoteSeed: () => new Promise(resolve => pending.push(resolve)),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const clients = Array.from({ length: 8 }, () => {
    const client = http.get(`http://127.0.0.1:${port}/api/quote/seeds/MSFT?packs=1&slippageBps=100`);
    client.on('error', () => {});
    return client;
  });
  while (pending.length < 8) await new Promise(resolve => setTimeout(resolve, 1));
  clients.forEach(client => client.destroy());
  await new Promise(resolve => setTimeout(resolve, 20));

  const probe = request(app).get('/api/quote/seeds/MSFT?packs=1&slippageBps=100').then(response => response);
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    assert.equal(pending.length, 9);
    pending.splice(0).forEach(resolve => resolve({ ok: true }));
    assert.equal((await probe).status, 200);
  } finally {
    pending.splice(0).forEach(resolve => resolve({ ok: true }));
    await probe.catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
});
