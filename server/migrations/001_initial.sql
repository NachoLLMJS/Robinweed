CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  address bytea NOT NULL CHECK (octet_length(address) = 20),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, address),
  UNIQUE (user_id, chain_id)
);

CREATE TABLE auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  address bytea NOT NULL CHECK (octet_length(address) = 20),
  nonce_hash bytea NOT NULL UNIQUE,
  domain text NOT NULL,
  uri text NOT NULL,
  message text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CHECK (expires_at > issued_at)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  visibility text NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE world_members (
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'PLAYER',
  banned_at timestamptz,
  muted_until timestamptz,
  PRIMARY KEY (world_id, user_id)
);

CREATE TABLE player_state (
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location text NOT NULL,
  position_x double precision NOT NULL,
  position_y double precision NOT NULL,
  position_z double precision NOT NULL,
  rotation_y double precision NOT NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, user_id)
);

CREATE TABLE game_mutations (
  id bigserial PRIMARY KEY,
  request_id uuid UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chain_contracts (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  address bytea NOT NULL CHECK (octet_length(address) = 20),
  deployment_block bigint NOT NULL CHECK (deployment_block >= 0),
  abi_version text NOT NULL,
  expected_code_hash bytea NOT NULL CHECK (octet_length(expected_code_hash) = 32),
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE chain_blocks (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  number bigint NOT NULL CHECK (number >= 0),
  hash bytea NOT NULL CHECK (octet_length(hash) = 32),
  parent_hash bytea NOT NULL CHECK (octet_length(parent_hash) = 32),
  block_time timestamptz NOT NULL,
  canonical boolean NOT NULL DEFAULT true,
  finality text NOT NULL CHECK (finality IN ('PROVISIONAL', 'FINALIZED')),
  PRIMARY KEY (chain_id, number, hash)
);

CREATE TABLE chain_events (
  id bigserial PRIMARY KEY,
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  block_number bigint NOT NULL,
  block_hash bytea NOT NULL CHECK (octet_length(block_hash) = 32),
  tx_hash bytea NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index integer NOT NULL CHECK (log_index >= 0),
  contract_address bytea NOT NULL CHECK (octet_length(contract_address) = 20),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  canonical boolean NOT NULL DEFAULT true,
  finality text NOT NULL CHECK (finality IN ('PROVISIONAL', 'FINALIZED')),
  UNIQUE (chain_id, block_hash, tx_hash, log_index)
);

CREATE TABLE indexer_checkpoints (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  worker_name text NOT NULL,
  scanned_block bigint NOT NULL,
  scanned_hash bytea NOT NULL CHECK (octet_length(scanned_hash) = 32),
  finalized_block bigint NOT NULL,
  finalized_hash bytea NOT NULL CHECK (octet_length(finalized_hash) = 32),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, worker_name)
);

CREATE TABLE applied_events (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  tx_hash bytea NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index integer NOT NULL CHECK (log_index >= 0),
  reducer_version integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash, log_index),
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE TABLE payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  tx_hash bytea NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index integer NOT NULL CHECK (log_index >= 0),
  payer bytea NOT NULL CHECK (octet_length(payer) = 20),
  purchase_type text NOT NULL,
  purchase_ref bytea NOT NULL,
  amount_raw numeric(78,0) NOT NULL CHECK (amount_raw > 0),
  finalized_block bigint NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE TABLE property_owners (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  house_id bigint NOT NULL CHECK (house_id BETWEEN 1 AND 4294967295),
  owner bytea NOT NULL CHECK (octet_length(owner) = 20),
  capacity smallint NOT NULL CHECK (capacity IN (4, 8, 15)),
  source_tx_hash bytea NOT NULL CHECK (octet_length(source_tx_hash) = 32),
  source_log_index integer NOT NULL CHECK (source_log_index >= 0),
  finalized_block bigint NOT NULL,
  PRIMARY KEY (chain_id, house_id),
  UNIQUE (chain_id, source_tx_hash, source_log_index)
);

CREATE TABLE seed_balances (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  wallet bytea NOT NULL CHECK (octet_length(wallet) = 20),
  ticker text NOT NULL,
  remaining numeric(78,0) NOT NULL CHECK (remaining >= 0),
  unassigned_raw numeric(78,0) NOT NULL CHECK (unassigned_raw >= 0),
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, wallet, ticker)
);

CREATE TABLE crop_positions (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  house_id bigint NOT NULL CHECK (house_id BETWEEN 1 AND 4294967295),
  plot_id smallint NOT NULL CHECK (plot_id BETWEEN 0 AND 14),
  owner bytea NOT NULL CHECK (octet_length(owner) = 20),
  ticker text NOT NULL,
  reward_position bytea NOT NULL CHECK (octet_length(reward_position) = 32),
  planted_at timestamptz NOT NULL,
  watered_at timestamptz,
  claimed_at timestamptz,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, house_id, plot_id),
  UNIQUE (chain_id, reward_position)
);

CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  tx_hash bytea NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index integer NOT NULL CHECK (log_index >= 0),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash, log_index, topic)
);

CREATE INDEX chain_events_scan_idx ON chain_events (chain_id, finality, block_number, log_index);
CREATE INDEX sessions_active_idx ON sessions (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX outbox_pending_idx ON outbox (id) WHERE published_at IS NULL;
