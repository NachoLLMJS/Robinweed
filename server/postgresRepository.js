import { createHash, createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest();
const sessionDigest = (secret, value) => createHmac('sha256', secret).update(value).digest();
const addressBytes = address => Buffer.from(address.slice(2), 'hex');

export function createSessionCredential(entropy = randomBytes(32), sessionSecret) {
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) throw new Error('SESSION_SECRET_REQUIRED');
  const token = Buffer.from(entropy).toString('base64url');
  return Object.freeze({ token, tokenHash: sessionDigest(sessionSecret, token) });
}

export class PostgresRepository {
  constructor(databaseUrl, databaseSsl, sessionSecret) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 10, ssl: databaseSsl });
    this.sessionSecret = sessionSecret;
  }

  async ready() {
    const result = await this.pool.query("SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version='001_initial') AS ready");
    return result.rows[0]?.ready === true;
  }

  async saveChallenge(challenge) {
    await this.pool.query(
      `INSERT INTO auth_challenges
       (chain_id,address,nonce_hash,domain,uri,message,issued_at,expires_at)
       VALUES (4663,$1,$2,$3,$4,$5,$6,$7)`,
      [addressBytes(challenge.address), digest(challenge.nonce), challenge.domain, challenge.uri, challenge.message, challenge.issuedAt, challenge.expiresAt],
    );
  }

  async consumeChallenge(nonce) {
    const result = await this.pool.query(
      `UPDATE auth_challenges
       SET used_at = now()
       WHERE nonce_hash = $1 AND used_at IS NULL AND expires_at >= now()
       RETURNING address,domain,uri,message,issued_at,expires_at`,
      [digest(nonce)],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      address: `0x${row.address.toString('hex')}`,
      chainId: 4663,
      domain: row.domain,
      uri: row.uri,
      nonce,
      message: row.message,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      usedAt: null,
    };
  }

  async createSession(address) {
    const client = await this.pool.connect();
    const credential = createSessionCredential(randomBytes(32), this.sessionSecret);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,4663))', [address.toLowerCase()]);
      let result = await client.query('SELECT user_id FROM wallets WHERE chain_id = 4663 AND address = $1 FOR UPDATE', [addressBytes(address)]);
      let userId = result.rows[0]?.user_id;
      if (!userId) {
        result = await client.query('INSERT INTO users DEFAULT VALUES RETURNING id');
        userId = result.rows[0].id;
        await client.query('INSERT INTO wallets (chain_id,address,user_id) VALUES (4663,$1,$2)', [addressBytes(address), userId]);
      }
      await client.query('INSERT INTO sessions (user_id,token_hash,expires_at) VALUES ($1,$2,$3)', [userId, credential.tokenHash, expiresAt]);
      await client.query('COMMIT');
      return { token: credential.token, expiresAt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async authenticateSession(token) {
    if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
    const result = await this.pool.query(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, w.address
       FROM sessions s
       JOIN wallets w ON w.user_id = s.user_id AND w.chain_id = 4663
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [sessionDigest(this.sessionSecret, token)],
    );
    const row = result.rows[0];
    return row ? { sessionId: row.session_id, userId: row.user_id, expiresAt: row.expires_at, address: `0x${row.address.toString('hex')}` } : null;
  }

  async cleanupExpiredAuth() {
    await this.pool.query("DELETE FROM auth_challenges WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '1 day'");
    await this.pool.query("DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days'");
  }

  async close() {
    await this.pool.end();
  }
}
