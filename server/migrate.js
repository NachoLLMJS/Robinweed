import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadBackendConfig } from './config.js';

const { Pool } = pg;
const config = loadBackendConfig();
const pool = new Pool({ connectionString: config.databaseUrl, max: 1, ssl: config.databaseSsl });

try {
  const sql = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(sql).digest();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum bytea NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  await pool.query('SELECT pg_advisory_lock(4663001)');
  const applied = await pool.query('SELECT checksum FROM schema_migrations WHERE version = $1', ['001_initial']);
  if (applied.rowCount) {
    if (!applied.rows[0].checksum.equals(checksum)) throw new Error('MIGRATION_CHECKSUM_MISMATCH');
    console.info('STOCKDEALER database migration 001 already applied');
  } else {
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (version,checksum) VALUES ($1,$2)', ['001_initial', checksum]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    console.info('STOCKDEALER database migration 001 applied');
  }
} finally {
  await pool.query('SELECT pg_advisory_unlock(4663001)').catch(() => {});
  await pool.end();
}
