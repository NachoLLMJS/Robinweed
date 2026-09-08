import { decodeBytes32String, getAddress } from 'ethers';

const addressBytes = address => Buffer.from(getAddress(address).slice(2), 'hex');
const hashBytes = hash => Buffer.from(hash.slice(2), 'hex');
const uint32Bytes = value => { const buffer = Buffer.alloc(4); buffer.writeUInt32BE(Number(value)); return buffer; };

export function projectionOperations({ contractName, eventName, args, meta }) {
  if (!meta || !Number.isSafeInteger(meta.blockNumber) || !Number.isSafeInteger(meta.logIndex)) return [];
  const base = { blockNumber: meta.blockNumber, txHash: hashBytes(meta.transactionHash), logIndex: meta.logIndex, blockTime: meta.blockTime };
  if (contractName === 'GameCore' && eventName === 'HousePurchased') return [
    { kind: 'property', values: { ...base, houseId: Number(args.houseId), owner: addressBytes(args.buyer), capacity: Number(args.capacity) } },
    { kind: 'payment', values: { ...base, payer: addressBytes(args.buyer), purchaseType: 'HOUSE', purchaseRef: uint32Bytes(args.houseId), amount: args.paid.toString() } },
    { kind: 'outbox', values: { ...base, topic: 'property.purchased', payload: { houseId: Number(args.houseId), owner: getAddress(args.buyer) } } },
  ];
  if (contractName === 'GameCore' && eventName === 'SeedPacksPurchased') return [
    { kind: 'payment', values: { ...base, payer: addressBytes(args.buyer), purchaseType: 'SEEDS', purchaseRef: Buffer.from(args.ticker.slice(2), 'hex'), amount: args.paid.toString() } },
    { kind: 'outbox', values: { ...base, topic: 'seeds.purchased', payload: { buyer: getAddress(args.buyer), ticker: decodeBytes32String(args.ticker) } } },
  ];
  if (contractName?.startsWith('Vault_') && eventName === 'PackCredited') return [{ kind: 'seed-credit', values: { ...base, wallet: addressBytes(args.buyer), ticker: contractName.slice(6), seeds: args.seeds.toString(), rawAssets: args.rawAssets.toString() } }];
  if (contractName?.startsWith('Vault_') && eventName === 'SeedConsumed') return [{ kind: 'seed-consume', values: { ...base, wallet: addressBytes(args.buyer), ticker: contractName.slice(6), rawAssets: args.rawAssets.toString() } }];
  if (contractName === 'GameCore' && eventName === 'SeedPlanted') return [{ kind: 'crop-plant', values: { ...base, owner: addressBytes(args.owner), houseId: Number(args.houseId), plotId: Number(args.plotId), ticker: decodeBytes32String(args.ticker), rewardPosition: hashBytes(args.rewardPosition) } }];
  if (contractName === 'GameCore' && eventName === 'PlantWatered') return [{ kind: 'crop-water', values: { ...base, houseId: Number(args.houseId), plotId: Number(args.plotId), wateredAt: new Date(Number(args.wateredAt) * 1000) } }];
  if (contractName === 'GameCore' && eventName === 'HarvestClaimed') return [{ kind: 'crop-claim', values: { ...base, houseId: Number(args.houseId), plotId: Number(args.plotId) } }];
  return [];
}

export async function applyProjectionOperations(client, operations) {
  for (const operation of operations) {
    const v = operation.values;
    if (operation.kind === 'property') await client.query(`INSERT INTO property_owners (chain_id,house_id,owner,capacity,source_tx_hash,source_log_index,finalized_block) VALUES (4663,$1,$2,$3,$4,$5,$6) ON CONFLICT (chain_id,house_id) DO UPDATE SET owner=$2,capacity=$3,source_tx_hash=$4,source_log_index=$5,finalized_block=$6`, [v.houseId, v.owner, v.capacity, v.txHash, v.logIndex, v.blockNumber]);
    else if (operation.kind === 'payment') await client.query(`INSERT INTO payment_receipts (chain_id,tx_hash,log_index,payer,purchase_type,purchase_ref,amount_raw,finalized_block) VALUES (4663,$1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [v.txHash, v.logIndex, v.payer, v.purchaseType, v.purchaseRef, v.amount, v.blockNumber]);
    else if (operation.kind === 'seed-credit') await client.query(`INSERT INTO seed_balances (chain_id,wallet,ticker,remaining,unassigned_raw,updated_block) VALUES (4663,$1,$2,$3,$4,$5) ON CONFLICT (chain_id,wallet,ticker) DO UPDATE SET remaining=seed_balances.remaining+$3,unassigned_raw=seed_balances.unassigned_raw+$4,updated_block=$5`, [v.wallet, v.ticker, v.seeds, v.rawAssets, v.blockNumber]);
    else if (operation.kind === 'seed-consume') requireOneRow(await client.query(`UPDATE seed_balances SET remaining=remaining-1,unassigned_raw=unassigned_raw-$1,updated_block=$2 WHERE chain_id=4663 AND wallet=$3 AND ticker=$4 AND remaining>0 AND unassigned_raw >= $1`, [v.rawAssets, v.blockNumber, v.wallet, v.ticker]));
    else if (operation.kind === 'crop-plant') await client.query(`INSERT INTO crop_positions (chain_id,house_id,plot_id,owner,ticker,reward_position,planted_at,updated_block) VALUES (4663,$1,$2,$3,$4,$5,$6,$7) ON CONFLICT (chain_id,house_id,plot_id) DO UPDATE SET owner=$3,ticker=$4,reward_position=$5,planted_at=$6,watered_at=NULL,claimed_at=NULL,updated_block=$7`, [v.houseId, v.plotId, v.owner, v.ticker, v.rewardPosition, v.blockTime, v.blockNumber]);
    else if (operation.kind === 'crop-water') requireOneRow(await client.query(`UPDATE crop_positions SET watered_at=$1,updated_block=$2 WHERE chain_id=4663 AND house_id=$3 AND plot_id=$4 AND claimed_at IS NULL AND watered_at IS NULL`, [v.wateredAt, v.blockNumber, v.houseId, v.plotId]));
    else if (operation.kind === 'crop-claim') requireOneRow(await client.query(`UPDATE crop_positions SET claimed_at=$1,updated_block=$2 WHERE chain_id=4663 AND house_id=$3 AND plot_id=$4 AND claimed_at IS NULL`, [v.blockTime, v.blockNumber, v.houseId, v.plotId]));
    else if (operation.kind === 'outbox') await client.query(`INSERT INTO outbox (chain_id,tx_hash,log_index,topic,payload) VALUES (4663,$1,$2,$3,$4) ON CONFLICT DO NOTHING`, [v.txHash, v.logIndex, v.topic, JSON.stringify(v.payload)]);
  }
}

function requireOneRow(result) {
  if (result?.rowCount !== 1) throw new Error('PROJECTION_PREREQUISITE_MISSING');
}
