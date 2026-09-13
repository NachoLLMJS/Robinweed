import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadBackendConfig } from './config.js';

const { Pool } = pg;
const config = loadBackendConfig();
const pool = new Pool({ connectionString: config.databaseUrl, max: 1, ssl: config.databaseSsl });
const migrationsDirectory = new URL('./migrations/', import.meta.url);

try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum bytea NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  await pool.query('SELECT pg_advisory_lock(4663001)');
  const filenames = (await readdir(migrationsDirectory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!filenames.length) throw new Error('DATABASE_MIGRATIONS_MISSING');
  for (const filename of filenames) {
    const version = filename.slice(0, -4);
    const sql = await readFile(new URL(filename, migrationsDirectory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest();
    const applied = await pool.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount) {
      if (!applied.rows[0].checksum.equals(checksum)) throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${version}`);
      console.info(`STOCKDEALER database migration ${version} already applied`);
      continue;
    }
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (version,checksum) VALUES ($1,$2)', [version, checksum]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    console.info(`STOCKDEALER database migration ${version} applied`);
  }
} finally {
  await pool.query('SELECT pg_advisory_unlock(4663001)').catch(() => {});
  await pool.end();
}
