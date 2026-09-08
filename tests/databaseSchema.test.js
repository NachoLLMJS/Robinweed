import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../server/migrations/001_initial.sql', import.meta.url), 'utf8');

test('PostgreSQL schema separates auth, world state, chain ingestion and finalized projections', () => {
  for (const table of ['users', 'wallets', 'auth_challenges', 'sessions', 'worlds', 'world_members', 'player_state', 'chain_contracts', 'chain_blocks', 'chain_events', 'indexer_checkpoints', 'applied_events', 'payment_receipts', 'property_owners', 'seed_balances', 'crop_positions', 'outbox']) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`, 'i'));
  }
});

test('chain events and mutations have idempotent natural keys', () => {
  assert.match(sql, /UNIQUE \(chain_id, block_hash, tx_hash, log_index\)/i);
  assert.match(sql, /UNIQUE \(chain_id, tx_hash, log_index\)/i);
  assert.match(sql, /request_id uuid UNIQUE NOT NULL/i);
});

test('wallets are constrained to Robinhood mainnet and 20-byte addresses', () => {
  assert.match(sql, /chain_id bigint NOT NULL CHECK \(chain_id = 4663\)/i);
  assert.match(sql, /CHECK \(octet_length\(address\) = 20\)/i);
});

test('projection integer domains cover uint32 house IDs and uint256 balances', () => {
  assert.match(sql, /house_id bigint NOT NULL CHECK \(house_id BETWEEN 1 AND 4294967295\)/i);
  assert.match(sql, /remaining numeric\(78,0\) NOT NULL/i);
});
