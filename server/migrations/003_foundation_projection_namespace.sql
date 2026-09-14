-- Namespace reducer idempotency and economy projections by GameCore.
-- The existing V3 rows and its checkpoint are moved atomically into the
-- canonical V3 GameCore namespace; V4 starts with an independent namespace.
ALTER TABLE applied_events ADD COLUMN foundation_id bytea NOT NULL DEFAULT decode(repeat('00',20),'hex') CHECK (octet_length(foundation_id)=20);
ALTER TABLE applied_events DROP CONSTRAINT applied_events_pkey;
ALTER TABLE applied_events ADD PRIMARY KEY (chain_id,foundation_id,tx_hash,log_index);

ALTER TABLE property_owners ADD COLUMN foundation_id bytea NOT NULL DEFAULT decode(repeat('00',20),'hex') CHECK (octet_length(foundation_id)=20);
ALTER TABLE property_owners DROP CONSTRAINT property_owners_pkey;
ALTER TABLE property_owners ADD PRIMARY KEY (chain_id,foundation_id,house_id);

ALTER TABLE seed_balances ADD COLUMN foundation_id bytea NOT NULL DEFAULT decode(repeat('00',20),'hex') CHECK (octet_length(foundation_id)=20);
ALTER TABLE seed_balances DROP CONSTRAINT seed_balances_pkey;
ALTER TABLE seed_balances ADD PRIMARY KEY (chain_id,foundation_id,wallet,ticker);

ALTER TABLE crop_positions ADD COLUMN foundation_id bytea NOT NULL DEFAULT decode(repeat('00',20),'hex') CHECK (octet_length(foundation_id)=20);
ALTER TABLE crop_positions DROP CONSTRAINT crop_positions_pkey;
ALTER TABLE crop_positions DROP CONSTRAINT crop_positions_chain_id_reward_position_key;
ALTER TABLE crop_positions ADD PRIMARY KEY (chain_id,foundation_id,house_id,plot_id);
ALTER TABLE crop_positions ADD UNIQUE (chain_id,foundation_id,reward_position);

ALTER TABLE warehouse_crop_positions ADD COLUMN foundation_id bytea NOT NULL DEFAULT decode(repeat('00',20),'hex') CHECK (octet_length(foundation_id)=20);
ALTER TABLE warehouse_crop_positions DROP CONSTRAINT warehouse_crop_positions_pkey;
ALTER TABLE warehouse_crop_positions ADD PRIMARY KEY (chain_id,foundation_id,owner,plot_id);

-- Preserve and identify every historical V3 projection instead of replaying it
-- into V4 or leaving it in an ambiguous zero namespace.
UPDATE applied_events SET foundation_id=decode('4e7db3f33e495d4932bd5460b25ca36db0d403c5','hex') WHERE foundation_id=decode(repeat('00',20),'hex');
UPDATE property_owners SET foundation_id=decode('4e7db3f33e495d4932bd5460b25ca36db0d403c5','hex') WHERE foundation_id=decode(repeat('00',20),'hex');
UPDATE seed_balances SET foundation_id=decode('4e7db3f33e495d4932bd5460b25ca36db0d403c5','hex') WHERE foundation_id=decode(repeat('00',20),'hex');
UPDATE crop_positions SET foundation_id=decode('4e7db3f33e495d4932bd5460b25ca36db0d403c5','hex') WHERE foundation_id=decode(repeat('00',20),'hex');
UPDATE warehouse_crop_positions SET foundation_id=decode('4e7db3f33e495d4932bd5460b25ca36db0d403c5','hex') WHERE foundation_id=decode(repeat('00',20),'hex');

INSERT INTO indexer_checkpoints (chain_id,worker_name,scanned_block,scanned_hash,finalized_block,finalized_hash,updated_at)
SELECT chain_id,'main:0x4e7db3f33e495d4932bd5460b25ca36db0d403c5',scanned_block,scanned_hash,finalized_block,finalized_hash,updated_at
FROM indexer_checkpoints WHERE chain_id=4663 AND worker_name='main'
ON CONFLICT (chain_id,worker_name) DO NOTHING;
