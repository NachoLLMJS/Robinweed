export async function authenticateRealtime({ ethereum, account, fetchImpl = fetch }) {
  if (!ethereum?.request || !/^0x[0-9a-fA-F]{40}$/.test(account ?? '')) throw new Error('WALLET_REQUIRED');
  const challengeResponse = await fetchImpl('/auth/challenge', {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account }),
  });
  if (!challengeResponse.ok) throw new Error('CHALLENGE_FAILED');
  const challenge = await challengeResponse.json();
  if (challenge.chainId !== 4663 || typeof challenge.message !== 'string') throw new Error('INVALID_CHALLENGE');
  const signature = await ethereum.request({ method: 'personal_sign', params: [challenge.message, account] });
  const verifyResponse = await fetchImpl('/auth/verify', {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce: challenge.nonce, message: challenge.message, signature }),
  });
  if (!verifyResponse.ok) throw new Error('AUTHENTICATION_FAILED');
}

export function createSerializedAuthenticator(authenticate = authenticateRealtime) {
  let tail = Promise.resolve();
  return input => {
    const current = tail.then(() => authenticate(input));
    tail = current.catch(() => {});
    return current;
  };
}

export class MultiplayerClient {
  constructor({ WebSocketImpl = WebSocket, onSnapshot = () => {}, onClose = () => {}, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
    this.WebSocketImpl = WebSocketImpl;
    this.onSnapshot = onSnapshot;
    this.onClose = onClose;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
    this.clientSeq = 0;
    this.serverSeq = -1;
    this.socket = null;
    this.origin = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 500;
    this.manualClosed = false;
  }

  connect(origin = location.origin) {
    this.origin = origin;
    this.manualClosed = false;
    if (this.reconnectTimer !== null) this.clearTimeoutImpl(this.reconnectTimer);
    this.reconnectTimer = null;
    const url = new URL('/realtime', origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new this.WebSocketImpl(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.reconnectDelay = 500;
      this.serverSeq = -1;
      socket.send(JSON.stringify({ type: 'join_world', worldId: 'outside' }));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message?.type !== 'snapshot' || message.worldVersion !== 1 || !Number.isSafeInteger(message.serverSeq) || message.serverSeq <= this.serverSeq || !Array.isArray(message.players) || message.players.length > 64) return;
      if (!message.players.every(player => typeof player?.userId === 'string' && /^[0-9a-f-]{36}$/i.test(player.userId) && /^0x[0-9a-f]{40}$/i.test(player.address) && Number.isFinite(player.x) && player.x >= -54 && player.x <= 54 && Number.isFinite(player.z) && player.z >= 8.65 && player.z <= 108.4 && Number.isFinite(player.yaw) && player.yaw >= -Math.PI && player.yaw <= Math.PI)) return;
      this.serverSeq=message.serverSeq;this.onSnapshot(message);
    });
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return;
      this.socket = null;
      const policyClose = event?.code === 1000 || event?.code === 1003 || event?.code === 1008 || event?.code >= 4000;
      const willReconnect = !this.manualClosed && !policyClose;
      this.onClose(event, { willReconnect });
      if (willReconnect && this.reconnectTimer === null) {
        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000);
        this.reconnectTimer = this.setTimeoutImpl(() => { this.reconnectTimer = null; if (!this.manualClosed) this.connect(this.origin); }, delay);
      }
    });
    socket.addEventListener('error', () => { if (this.socket === socket) socket.close(); });
    return socket;
  }

  sendInput(buttons, lookDirection) {
    if (this.socket?.readyState !== this.WebSocketImpl.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'input', clientSeq: ++this.clientSeq, buttons, lookDirection }));
    return true;
  }

  close() {
    this.manualClosed = true;
    if (this.reconnectTimer !== null) this.clearTimeoutImpl(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'CLIENT_CLOSE');
    this.socket = null;
  }
}
