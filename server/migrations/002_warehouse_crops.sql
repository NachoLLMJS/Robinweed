CREATE TABLE warehouse_crop_positions (
  chain_id bigint NOT NULL CHECK (chain_id = 4663),
  owner bytea NOT NULL CHECK (octet_length(owner) = 20),
  plot_id smallint NOT NULL CHECK (plot_id BETWEEN 0 AND 7),
  ticker text NOT NULL,
  reward_position bytea NOT NULL CHECK (octet_length(reward_position) = 32),
  planted_at timestamptz NOT NULL,
  watered_at timestamptz,
  claimed_at timestamptz,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, owner, plot_id)
);
