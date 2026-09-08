export class PresenceAdmission {
  constructor({ maxConnections, maxPerIp, maxPlayers }) {
    this.maxConnections = maxConnections;
    this.maxPerIp = maxPerIp;
    this.maxPlayers = maxPlayers;
    this.tokens = new Set();
    this.users = new Set();
    this.sessions = new Set();
    this.ipCounts = new Map();
    this.joined = new Set();
  }

  admit(identity) {
    if (!identity?.userId || !identity?.sessionId || !identity?.ip || this.tokens.size >= this.maxConnections || this.users.has(identity.userId) || this.sessions.has(identity.sessionId) || (this.ipCounts.get(identity.ip) ?? 0) >= this.maxPerIp) return null;
    const token = Object.freeze({ ...identity });
    this.tokens.add(token);
    this.users.add(identity.userId);
    this.sessions.add(identity.sessionId);
    this.ipCounts.set(identity.ip, (this.ipCounts.get(identity.ip) ?? 0) + 1);
    return token;
  }

  join(token) {
    if (!this.tokens.has(token)) return false;
    if (this.joined.has(token)) return true;
    if (this.joined.size >= this.maxPlayers) return false;
    this.joined.add(token);
    return true;
  }

  release(token) {
    if (!this.tokens.delete(token)) return;
    this.joined.delete(token);
    this.users.delete(token.userId);
    this.sessions.delete(token.sessionId);
    const next = (this.ipCounts.get(token.ip) ?? 1) - 1;
    if (next <= 0) this.ipCounts.delete(token.ip); else this.ipCounts.set(token.ip, next);
  }
}
