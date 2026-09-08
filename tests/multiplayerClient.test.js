import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateRealtime, createSerializedAuthenticator, isSameWalletAddress, MultiplayerClient } from '../src/multiplayerClient.js';

const account = '0x1111111111111111111111111111111111111111';

test('wallet identity comparison ignores checksum casing but rejects missing or different accounts', () => {
  assert.equal(isSameWalletAddress(account, account.toUpperCase().replace('0X', '0x')), true);
  assert.equal(isSameWalletAddress(account, '0x2222222222222222222222222222222222222222'), false);
  assert.equal(isSameWalletAddress(account, null), false);
});

test('multiplayer authentication uses SIWE personal_sign and never a transaction method', async () => {
  const walletCalls = [];
  const ethereum = { request: async request => { walletCalls.push(request); if (request.method === 'personal_sign') return `0x${'a'.repeat(130)}`; throw new Error('unexpected'); } };
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url, options });
    if (url === '/auth/challenge') return { ok: true, json: async () => ({ nonce: 'ab'.repeat(16), message: 'SIWE MESSAGE', chainId: 4663 }) };
    if (url === '/auth/verify') return { ok: true, status: 204 };
    throw new Error('unexpected URL');
  };
  await authenticateRealtime({ ethereum, account, fetchImpl });
  assert.deepEqual(walletCalls.map(call => call.method), ['personal_sign']);
  assert.equal(walletCalls.some(call => /sendTransaction/i.test(call.method)), false);
  assert.deepEqual(fetchCalls.map(call => call.url), ['/auth/challenge', '/auth/verify']);
  assert.equal(fetchCalls.every(call => call.options.credentials === 'include'), true);
});

test('multiplayer authentication stops when challenge or verification fails', async () => {
  await assert.rejects(authenticateRealtime({ ethereum: { request: async () => '' }, account, fetchImpl: async () => ({ ok: false }) }));
});

test('wallet authentications are serialized so the newest request owns the final session cookie', async () => {
  const pending = [];
  const calls = [];
  const authenticate = input => new Promise((resolve, reject) => { calls.push(input.account); pending.push({ resolve, reject }); });
  const serialized = createSerializedAuthenticator(authenticate);
  const first = serialized({ account: 'A' });
  const second = serialized({ account: 'B' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['A']);
  pending.shift().resolve();
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['A', 'B']);
  pending.shift().resolve();
  await second;

  const third = serialized({ account: 'C' });
  const fourth = serialized({ account: 'D' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['A', 'B', 'C']);
  pending.shift().reject(new Error('rejected'));
  await assert.rejects(third);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['A', 'B', 'C', 'D']);
  pending.shift().resolve();
  await fourth;
});

test('multiplayer reconnects after transient close but not policy rejection or manual close', () => {
  class FakeSocket {
    static OPEN = 1;
    static instances = [];
    constructor(url) { this.url = url; this.listeners = new Map(); FakeSocket.instances.push(this); }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    send() {}
    close(code = 1000) { this.emit('close', { code }); }
    emit(type, event = {}) { this.listeners.get(type)?.(event); }
  }
  const scheduled = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket, setTimeoutImpl: callback => { scheduled.push(callback); return scheduled.length; }, clearTimeoutImpl: () => {} });
  client.connect('https://stockdealer.example');
  FakeSocket.instances[0].emit('close', { code: 1006 });
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  assert.equal(FakeSocket.instances.length, 2);
  FakeSocket.instances[1].emit('close', { code: 1008 });
  assert.equal(scheduled.length, 0);
  client.connect('https://stockdealer.example');
  client.close();
  assert.equal(scheduled.length, 0);
});

test('multiplayer accepts a restarted server sequence after reconnect', () => {
  class FakeSocket { static OPEN=1; static instances=[]; constructor(){this.listeners=new Map();FakeSocket.instances.push(this);} addEventListener(t,h){this.listeners.set(t,h);} send(){} close(){} emit(t,e={}){this.listeners.get(t)?.(e);} }
  const snapshots=[];const scheduled=[];
  const client=new MultiplayerClient({WebSocketImpl:FakeSocket,onSnapshot:value=>snapshots.push(value.serverSeq),setTimeoutImpl:callback=>{scheduled.push(callback);return 1;},clearTimeoutImpl:()=>{}});
  client.connect('https://stockdealer.example');FakeSocket.instances[0].emit('open');FakeSocket.instances[0].emit('message',{data:JSON.stringify({type:'snapshot',worldVersion:1,serverSeq:100,players:[]})});FakeSocket.instances[0].emit('close',{code:1006});scheduled.shift()();FakeSocket.instances[1].emit('open');FakeSocket.instances[1].emit('message',{data:JSON.stringify({type:'snapshot',worldVersion:1,serverSeq:1,players:[]})});
  assert.deepEqual(snapshots,[100,1]);
});

test('multiplayer normalizes accumulated camera yaw before sending input', () => {
  class FakeSocket {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.listeners = new Map(); this.sent = []; }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close() {}
    emit(type, event = {}) { this.listeners.get(type)?.(event); }
  }
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket });
  const socket = client.connect('https://stockdealer.example');
  socket.emit('open');
  assert.equal(client.sendInput(['forward'], Math.PI * 4 + 0.25), true);
  const input = socket.sent.at(-1);
  assert.equal(input.type, 'input');
  assert.ok(input.lookDirection >= -Math.PI && input.lookDirection <= Math.PI);
  assert.ok(Math.abs(input.lookDirection - 0.25) < Number.EPSILON * 4);
});

test('multiplayer reports connecting, socket-open, online and close diagnostics', () => {
  class FakeSocket { static OPEN=1; constructor(){this.listeners=new Map();} addEventListener(t,h){this.listeners.set(t,h);} send(){} close(){} emit(t,e={}){this.listeners.get(t)?.(e);} }
  const statuses=[];
  const client=new MultiplayerClient({WebSocketImpl:FakeSocket,onStatus:status=>statuses.push(status),setTimeoutImpl:()=>1,clearTimeoutImpl:()=>{}});
  const socket=client.connect('https://stockdealer.example');
  assert.deepEqual(statuses,[{state:'connecting'}]);
  socket.emit('open');
  assert.deepEqual(statuses.at(-1),{state:'socket-open'});
  socket.emit('message',{data:JSON.stringify({type:'snapshot',worldVersion:1,serverSeq:1,players:[]})});
  assert.deepEqual(statuses.at(-1),{state:'online',players:0});
  socket.emit('close',{code:1006});
  assert.deepEqual(statuses.at(-1),{state:'closed',code:1006,willReconnect:true});
});
