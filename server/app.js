import express from 'express';
import { z } from 'zod';
import { createWalletChallenge, verifyWalletChallenge } from './walletAuth.js';
import { createFixedWindowLimiter } from './rateLimit.js';

const addressBody = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }).strict();
const verifyBody = z.object({
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(8194),
}).strict();

function sessionToken(cookieHeader) {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === '__Host-stockdealer_session') return decodeURIComponent(value.join('='));
  }
  return null;
}

async function runTimedOperation(request, timeoutMs, timeoutCode, operation) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.once('aborted', abort);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error(timeoutCode);
      error.code = timeoutCode;
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
    request.off('aborted', abort);
  }
}

export function createApiApp({ config, repository, quoteSeed = null, quoteHouse = null, readGameState = null, walletProvider = null, quoteTimeoutMs = 8_000, stateTimeoutMs = 8_000 }) {
  if (!Number.isInteger(quoteTimeoutMs) || quoteTimeoutMs < 1 || quoteTimeoutMs > 30_000 || !Number.isInteger(stateTimeoutMs) || stateTimeoutMs < 1 || stateTimeoutMs > 30_000) throw new Error('INVALID_RPC_TIMEOUT');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const authLimiter = createFixedWindowLimiter({ limit: 10, windowMs: 60_000 });
  const quoteLimiter = createFixedWindowLimiter({ limit: 30, windowMs: 60_000 });
  const stateIpLimiter = createFixedWindowLimiter({ limit: 30, windowMs: 60_000 });
  const stateWalletLimiter = createFixedWindowLimiter({ limit: 30, windowMs: 60_000 });
  let activeQuotes = 0;
  let activeStates = 0;
  const websocketOrigin = config.publicOrigin.replace(/^http/, 'ws');
  app.use((_request, response, next) => {
    response.set({
      'Content-Security-Policy': `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self' ${websocketOrigin} blob:; worker-src 'none'; form-action 'self'`,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));

  app.get('/health/live', (_request, response) => response.json({ status: 'live' }));
  app.get('/api/config', (_request, response) => response.json(config.publicConfig ?? { chainId: 4663, economyActive: false, contracts: [] }));
  app.use('/api/quote', (request, response, next) => {
    if (!quoteLimiter.accept(request.ip)) return response.status(429).json({ error: 'RATE_LIMITED' });
    if (activeQuotes >= 8) return response.status(503).json({ error: 'QUOTE_CAPACITY_REACHED' });
    activeQuotes += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeQuotes -= 1;
    };
    response.once('finish', release);
    response.once('close', release);
    request.once('aborted', release);
    next();
  });
  app.get('/api/state', async (request, response) => {
    if (!readGameState) return response.status(503).json({ error: 'ECONOMY_NOT_READY' });
    if (!stateIpLimiter.accept(request.ip)) return response.status(429).json({ error: 'RATE_LIMITED' });
    const identity = await repository.authenticateSession(sessionToken(request.headers.cookie));
    if (!identity) return response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    if (!stateWalletLimiter.accept(identity.address.toLowerCase())) return response.status(429).json({ error: 'RATE_LIMITED' });
    if (activeStates >= 8) return response.status(503).json({ error: 'STATE_CAPACITY_REACHED' });
    activeStates += 1;
    try { response.json(await runTimedOperation(request, stateTimeoutMs, 'STATE_TIMEOUT', signal => readGameState(identity.address, { signal }))); }
    catch (error) { response.status(503).json({ error: error?.code === 'STATE_TIMEOUT' ? 'STATE_TIMEOUT' : 'STATE_UNAVAILABLE' }); }
    finally { activeStates -= 1; }
  });
  app.get('/api/quote/seeds/:symbol', async (request, response) => {
    if (!quoteSeed) return response.status(503).json({ error: 'ECONOMY_NOT_READY' });
    try {
      const symbol = z.enum(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']).parse(request.params.symbol);
      const packs = z.coerce.number().int().min(1).max(100).parse(request.query.packs);
      const slippageBps = z.coerce.number().int().min(0).max(500).parse(request.query.slippageBps);
      response.json(await runTimedOperation(request, quoteTimeoutMs, 'QUOTE_TIMEOUT', signal => quoteSeed({ symbol, packs, slippageBps, signal })));
    } catch (error) {
      if (error?.code === 'QUOTE_TIMEOUT') return response.status(503).json({ error: 'QUOTE_TIMEOUT' });
      response.status(400).json({ error: 'INVALID_OR_UNAVAILABLE_QUOTE' });
    }
  });
  app.get('/api/quote/houses/:houseId', async (request, response) => {
    if (!quoteHouse) return response.status(503).json({ error: 'ECONOMY_NOT_READY' });
    try {
      const houseId = z.coerce.number().int().min(1).max(0xffffffff).parse(request.params.houseId);
      const slippageBps = z.coerce.number().int().min(0).max(500).parse(request.query.slippageBps);
      response.json(await runTimedOperation(request, quoteTimeoutMs, 'QUOTE_TIMEOUT', signal => quoteHouse({ houseId, slippageBps, signal })));
    } catch (error) {
      if (error?.code === 'QUOTE_TIMEOUT') return response.status(503).json({ error: 'QUOTE_TIMEOUT' });
      response.status(400).json({ error: 'INVALID_OR_UNAVAILABLE_QUOTE' });
    }
  });
  app.get('/health/ready', async (_request, response) => {
    try {
      const databaseReady=await repository.ready();
      const stateBindingsReady=Boolean(readGameState&&walletProvider);
      const economyBindingsReady=!config.publicConfig?.economyActive||Boolean(quoteSeed&&quoteHouse);
      const bindingsReady=stateBindingsReady&&economyBindingsReady;
      const rpcReady=stateBindingsReady&&await walletProvider.send('eth_chainId',[])==='0x1237';
      response.status(databaseReady&&bindingsReady&&rpcReady ? 200 : 503).json({ status: databaseReady&&bindingsReady&&rpcReady?'ready':'unavailable' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/auth', (request, response, next) => {
    if (request.get('origin') !== config.publicOrigin) return response.status(403).json({ error: 'ORIGIN_REJECTED' });
    if (!authLimiter.accept(request.ip)) return response.status(429).json({ error: 'RATE_LIMITED' });
    next();
  });

  app.post('/auth/challenge', async (request, response) => {
    try {
      const { address } = addressBody.parse(request.body);
      const challenge = createWalletChallenge({ address, origin: config.publicOrigin });
      await repository.saveChallenge({ ...challenge });
      response.json({ nonce: challenge.nonce, message: challenge.message, chainId: 4663, expiresAt: challenge.expiresAt.toISOString() });
    } catch {
      response.status(400).json({ error: 'INVALID_CHALLENGE_REQUEST' });
    }
  });

  app.post('/auth/verify', async (request, response) => {
    try {
      const { nonce, message, signature } = verifyBody.parse(request.body);
      const challenge = await repository.consumeChallenge(nonce);
      if (!challenge) return response.status(401).json({ error: 'INVALID_OR_USED_CHALLENGE' });
      const identity = await verifyWalletChallenge({ challenge, message, signature, origin: config.publicOrigin, provider: walletProvider });
      const session = await repository.createSession(identity.address);
      response.cookie('__Host-stockdealer_session', session.token, {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        expires: session.expiresAt,
      });
      response.status(204).end();
    } catch {
      response.status(401).json({ error: 'AUTHENTICATION_FAILED' });
    }
  });

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    response.status(400).json({ error: 'INVALID_REQUEST' });
  });
  return app;
}
