import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { JsonRpcProvider } from 'ethers';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { loadBackendConfig } from './config.js';
import { createApiApp } from './app.js';
import { PostgresRepository } from './postgresRepository.js';
import { parseClientMessage, acceptClientSequence } from './realtimeProtocol.js';
import { createQuoteHouseService, createQuoteSeedService, createReadGameStateService } from './chainBindings.js';
import { advanceOutsidePlayer, outsideSpawnForSlot } from './multiplayerMovement.js';
import { PresenceAdmission } from './presenceAdmission.js';
import { realtimeRoleForUrl, roleAllowsClientMessages, stateReceivesSnapshots } from './realtimeAccess.js';

const config = loadBackendConfig();
const repository = new PostgresRepository(config.databaseUrl,config.databaseSsl,config.sessionSecret);
const walletProvider = new JsonRpcProvider(config.rpcPrimary,4663,{staticNetwork:true});
const app = createApiApp({ config, repository, quoteSeed: createQuoteSeedService(config), quoteHouse: createQuoteHouseService(config), readGameState: createReadGameStateService(config), walletProvider });
app.use(express.static('dist', { index: 'index.html', fallthrough: true }));
app.get('/{*splat}',(request,response,next)=>{if(/^\/(?:api|auth|health|realtime)(?:\/|$)/.test(request.path))return next();response.sendFile(resolve('dist/index.html'));});
const server = createServer(app);
const sockets = new Map();
const admission = new PresenceAdmission({ maxConnections: 128, maxPerIp: 4, maxPlayers: 64 });
const spectatorAdmission = new PresenceAdmission({ maxConnections: 128, maxPerIp: 4, maxPlayers: 128 });
const wss = new WebSocketServer({ noServer: true, maxPayload: 16_384, perMessageDeflate: false });

function cookieValue(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

server.on('upgrade', async (request, socket, head) => {
  try {
    const role = realtimeRoleForUrl(request.url);
    if (!role || request.headers.origin !== config.publicOrigin) return socket.destroy();
    const ip = String(request.headers['x-forwarded-for'] ?? socket.remoteAddress ?? '').split(',').map(value=>value.trim()).filter(Boolean).at(-1)??'';
    let token = null;
    let identity;
    if (role === 'spectator') {
      const spectatorId = randomUUID();
      identity = { userId: `spectator:${spectatorId}`, sessionId: `spectator:${spectatorId}`, address: null };
    } else {
      token = cookieValue(request.headers.cookie, '__Host-stockdealer_session');
      identity = await repository.authenticateSession(token);
      if (!identity) return socket.destroy();
    }
    const connectionAdmission = role === 'spectator' ? spectatorAdmission : admission;
    const admissionToken = connectionAdmission.admit({ userId: identity.userId, sessionId: identity.sessionId, ip });
    if (!admissionToken) return socket.destroy();
    wss.handleUpgrade(request, socket, head, websocket => wss.emit('connection', websocket, identity, admissionToken, token, role, connectionAdmission));
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (socket, identity, admissionToken, sessionToken, role, connectionAdmission) => {
  let state;
  if (role === 'spectator') {
    state = { role, joined: false };
  } else {
    const occupiedSpawns=new Set([...sockets.values()].filter(candidate=>candidate.role==='player').map(candidate=>`${candidate.x}:${candidate.z}`));
    const spawn=Array.from({length:64},(_,slot)=>outsideSpawnForSlot(slot)).find(candidate=>!occupiedSpawns.has(`${candidate.x}:${candidate.z}`));
    if(!spawn){connectionAdmission.release(admissionToken);socket.close(1013,'WORLD_FULL');return;}
    state = { role, userId: identity.userId, address: identity.address, joined: false, seq: -1, ...spawn, yaw: Math.PI, buttons: [] };
  }
  sockets.set(socket, state);
  let windowStarted = Date.now();
  let messages = 0;
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', data => {
    try {
      if (!roleAllowsClientMessages(state.role)) throw new Error('READ_ONLY');
      const now = Date.now();
      if (now - windowStarted >= 1_000) { windowStarted = now; messages = 0; }
      if (++messages > 30) throw new Error('RATE_LIMIT');
      const message = parseClientMessage(data.toString());
      if (message.type === 'join_world') {
        if (message.worldId !== 'outside') throw new Error('ROOM_DENIED');
        if (!connectionAdmission.join(admissionToken)) throw new Error('WORLD_FULL');
        state.joined = true;
      } else if (message.type === 'input') {
        state.seq = acceptClientSequence(state.seq, message.clientSeq);
        state.buttons = message.buttons;
        state.yaw = message.lookDirection;
      } else if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', clientTime: message.clientTime }));
      }
    } catch {
      socket.close(1008, 'INVALID_MESSAGE');
    }
  });
  socket.on('close', () => { sockets.delete(socket); connectionAdmission.release(admissionToken); });
  socket.userData={sessionToken,role};
});

let serverSeq = 0;
const tick = setInterval(() => {
  const dt = 0.05;
  for (const state of sockets.values()) {
    if (!state.joined) continue;
    Object.assign(state,advanceOutsidePlayer(state,dt));
  }
  serverSeq++;
  const players = [...sockets.values()].filter(state => state.role === 'player' && state.joined).map(({ userId, address, x, z, yaw }) => ({ userId, address, x, z, yaw }));
  const payload = JSON.stringify({ type: 'snapshot', serverSeq, worldVersion: 1, players });
  for (const [socket,state] of sockets) if (stateReceivesSnapshots(state)&&socket.readyState === WebSocket.OPEN) { if(socket.bufferedAmount>65_536)socket.close(1008,'SLOW_CONSUMER');else socket.send(payload); }
}, 50);
tick.unref();

const heartbeat = setInterval(async () => {
  for (const socket of sockets.keys()) {
    if (!socket.isAlive) { socket.terminate(); continue; }
    if (socket.userData.role === 'player' && !await repository.authenticateSession(socket.userData.sessionToken)) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 25_000);
heartbeat.unref();
const authCleanup=setInterval(()=>repository.cleanupExpiredAuth().catch(error=>console.error('STOCKDEALER auth cleanup failed',error?.message??'UNKNOWN')),3_600_000);authCleanup.unref();

server.listen(config.port, '0.0.0.0', () => console.info(`STOCKDEALER API/realtime listening on ${config.port}`));

async function shutdown() {
  clearInterval(tick);
  clearInterval(heartbeat);
  clearInterval(authCleanup);
  for (const socket of sockets.keys()) socket.close(1001, 'SERVER_SHUTDOWN');
  wss.close();
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
