import { JsonRpcProvider, Interface, getAddress, keccak256 } from 'ethers';
import pg from 'pg';
import { loadBackendConfig } from './config.js';
import { corroboratedFinalizedHead } from './indexerCore.js';
import { serializeEventPayload, validateFinalizedEvent } from './chainEvent.js';
import { applyProjectionOperations, projectionOperations } from './eventReducer.js';

const { Pool } = pg;
const config = loadBackendConfig();
const pool = new Pool({ connectionString: config.databaseUrl, max: 3, ssl: config.databaseSsl });
const primary = new JsonRpcProvider(config.rpcPrimary, 4663, { staticNetwork: true, batchMaxCount: 1 });
const secondary = new JsonRpcProvider(config.rpcSecondary, 4663, { staticNetwork: true, batchMaxCount: 1 });
let stopping = false;
let ingestedRanges = 0;
let lastCaughtUpBlock = -1;

const contracts = config.contractManifest.contracts.map(entry => {
  const address = getAddress(entry.address);
  if (!entry.name || !Number.isSafeInteger(entry.deploymentBlock) || entry.deploymentBlock < 0 || !/^0x[0-9a-fA-F]{64}$/.test(entry.expectedCodeHash) || !Array.isArray(entry.abi)) throw new Error('INVALID_CONTRACT_MANIFEST');
  return { ...entry, address, key: address.toLowerCase(), interface: new Interface(entry.abi) };
});
if (!contracts.length) throw new Error('EMPTY_CONTRACT_MANIFEST');
const byAddress = new Map(contracts.map(entry => [entry.key, entry]));
if (byAddress.size !== contracts.length) throw new Error('DUPLICATE_CONTRACT_ADDRESS');
const allowlist = new Set(byAddress.keys());
const bytes = hex => Buffer.from(hex.slice(2), 'hex');
const sameHex = (left, right) => left?.toLowerCase() === right?.toLowerCase();
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function transientRpcError(error) {
  const status = Number(error?.info?.responseStatus?.match?.(/^\d+/)?.[0]);
  return error?.code === -32005 || error?.error?.code === -32005 || error?.code === 'TIMEOUT' || error?.code === 'SERVER_ERROR' && (status === 429 || status >= 500);
}

async function retryRpc(task) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await task(); } catch (error) {
      lastError = error;
      if (!transientRpcError(error) || attempt === 5) throw error;
      await sleep(attempt * 1_000);
    }
  }
  throw lastError;
}

async function verifyManifest(blockNumber) {
  for (const entry of contracts) {
    const [primaryCode, secondaryCode] = await Promise.all([retryRpc(() => primary.getCode(entry.address, blockNumber)), retryRpc(() => secondary.getCode(entry.address, blockNumber))]);
    if (primaryCode === '0x' || !sameHex(primaryCode, secondaryCode) || !sameHex(keccak256(primaryCode), entry.expectedCodeHash)) throw new Error(`CONTRACT_CODE_MISMATCH:${entry.name}`);
  }
}

function logKey(log) {
  return [log.blockNumber, log.transactionIndex, log.index, log.blockHash, log.transactionHash, log.address, log.topics.join(','), log.data].join(':').toLowerCase();
}

async function corroboratedBlocks(fromBlock, toBlock, expectedParentHash) {
  const blocks = [];
  let parentHash = expectedParentHash;
  for (let pageStart = fromBlock; pageStart <= toBlock; pageStart += 10) {
    const numbers = Array.from({ length: Math.min(10, toBlock - pageStart + 1) }, (_, index) => pageStart + index);
    const page = await Promise.all(numbers.map(async number => {
      const [left, right] = await Promise.all([retryRpc(() => primary.getBlock(number)), retryRpc(() => secondary.getBlock(number))]);
      return { number, left, right };
    }));
    for (const { number, left, right } of page) {
      if (!left || !right || left.number !== number || right.number !== number || !sameHex(left.hash, right.hash) || !sameHex(left.parentHash, right.parentHash) || left.timestamp !== right.timestamp) throw new Error(`BLOCK_PROVIDER_DISAGREEMENT:${number}`);
      if (parentHash && !sameHex(left.parentHash, parentHash)) throw new Error(`BLOCK_PARENT_DISCONTINUITY:${number}`);
      parentHash = left.hash;
      blocks.push(left);
    }
  }
  return blocks;
}

async function corroboratedLogs(fromBlock, toBlock) {
  const filter = { address: contracts.map(entry => entry.address), fromBlock, toBlock };
  const [left, right] = await Promise.all([retryRpc(() => primary.getLogs(filter)), retryRpc(() => secondary.getLogs(filter))]);
  left.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.index - b.index);
  right.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.index - b.index);
  if (left.length !== right.length || left.some((log, index) => logKey(log) !== logKey(right[index]))) throw new Error(`LOG_PROVIDER_DISAGREEMENT:${fromBlock}-${toBlock}`);
  return left;
}

async function ingestRange(client, fromBlock, toBlock, expectedParentHash) {
  const [blocks, logs] = await Promise.all([corroboratedBlocks(fromBlock, toBlock, expectedParentHash), corroboratedLogs(fromBlock, toBlock)]);
  const blockCache = new Map(blocks.map(block => [block.number, block]));
  for (const block of blocks) {
    await client.query(
      `INSERT INTO chain_blocks (chain_id,number,hash,parent_hash,block_time,canonical,finality)
       VALUES (4663,$1,$2,$3,$4,true,'FINALIZED') ON CONFLICT DO NOTHING`,
      [block.number, bytes(block.hash), bytes(block.parentHash), new Date(block.timestamp * 1000)],
    );
  }
  for (const log of logs) {
    const block = blockCache.get(log.blockNumber);
    if (!block || !sameHex(block.hash, log.blockHash)) throw new Error('LOG_BLOCK_HASH_MISMATCH');
    const entry = byAddress.get(log.address.toLowerCase());
    if (!(log.blockNumber >= entry.deploymentBlock)) continue;
    const parsed = entry?.interface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) continue;
    validateFinalizedEvent({ chainId: 4663, blockNumber: log.blockNumber, blockHash: log.blockHash, transactionHash: log.transactionHash, logIndex: log.index, contractAddress: log.address, finality: 'FINALIZED' }, allowlist);
    await client.query(
      `INSERT INTO chain_events (chain_id,block_number,block_hash,tx_hash,log_index,contract_address,event_type,payload,canonical,finality)
       VALUES (4663,$1,$2,$3,$4,$5,$6,$7,true,'FINALIZED') ON CONFLICT DO NOTHING`,
      [log.blockNumber, bytes(log.blockHash), bytes(log.transactionHash), log.index, bytes(log.address), parsed.name, serializeEventPayload(parsed.args.toObject())],
    );
    const applied = await client.query(
      `INSERT INTO applied_events (chain_id,tx_hash,log_index,reducer_version) VALUES (4663,$1,$2,1)
       ON CONFLICT DO NOTHING RETURNING log_index`,
      [bytes(log.transactionHash), log.index],
    );
    if (applied.rowCount === 1) await applyProjectionOperations(client, projectionOperations({
      contractName: entry.name,
      eventName: parsed.name,
      args: parsed.args.toObject(),
      meta: { blockNumber: log.blockNumber, blockTime: new Date(block.timestamp * 1000), transactionHash: log.transactionHash, logIndex: log.index },
    }));
  }
  const checkpointBlock = blocks.at(-1);
  await client.query(
    `INSERT INTO indexer_checkpoints (chain_id,worker_name,scanned_block,scanned_hash,finalized_block,finalized_hash)
     VALUES (4663,'main',$1,$2,$1,$2)
     ON CONFLICT (chain_id,worker_name) DO UPDATE SET scanned_block=$1,scanned_hash=$2,finalized_block=$1,finalized_hash=$2,updated_at=now()`,
    [toBlock, bytes(checkpointBlock.hash)],
  );
  return checkpointBlock.hash;
}

async function validatedCheckpoint(client, finalized) {
  const result = await client.query("SELECT finalized_block,finalized_hash FROM indexer_checkpoints WHERE chain_id=4663 AND worker_name='main' FOR UPDATE");
  if (!result.rows[0]) return null;
  const number = Number(result.rows[0].finalized_block);
  const storedHash = `0x${result.rows[0].finalized_hash.toString('hex')}`;
  if (!Number.isSafeInteger(number) || number > finalized.number) throw new Error('CHECKPOINT_AHEAD_OF_FINALITY');
  const [left, right] = await Promise.all([retryRpc(() => primary.getBlock(number)), retryRpc(() => secondary.getBlock(number))]);
  if (!left || !right || !sameHex(left.hash, storedHash) || !sameHex(right.hash, storedHash)) throw new Error('CHECKPOINT_HASH_MISMATCH');
  return { number, hash: storedHash };
}

async function run() {
  const lockClient = await pool.connect();
  let acquired = false;
  while (!stopping && !acquired) {
    const lock = await lockClient.query('SELECT pg_try_advisory_lock(4663002) AS acquired');
    acquired = Boolean(lock.rows[0]?.acquired);
    if (!acquired) await sleep(5_000);
  }
  if (!acquired) {
    lockClient.release();
    await pool.end();
    return;
  }
  try {
    while (!stopping) {
      const finalized = await corroboratedFinalizedHead(primary, secondary);
      await verifyManifest(finalized.number);
      let checkpoint = await validatedCheckpoint(lockClient, finalized);
      let fromBlock = checkpoint ? checkpoint.number + 1 : config.indexerStartBlock;
      let parentHash = checkpoint?.hash ?? null;
      if (!parentHash && fromBlock > 0) {
        const parents = await corroboratedBlocks(fromBlock - 1, fromBlock - 1, null);
        parentHash = parents[0].hash;
      }
      while (fromBlock <= finalized.number) {
        const toBlock = Math.min(fromBlock + 49, finalized.number);
        await lockClient.query('BEGIN');
        try {
          parentHash = await ingestRange(lockClient, fromBlock, toBlock, parentHash);
          await lockClient.query('COMMIT');
          ingestedRanges += 1;
          if (ingestedRanges % 20 === 0) console.info('STOCKDEALER indexer checkpoint', toBlock);
        } catch (error) {
          await lockClient.query('ROLLBACK');
          throw error;
        }
        fromBlock = toBlock + 1;
      }
      if (lastCaughtUpBlock !== finalized.number) {
        lastCaughtUpBlock = finalized.number;
        console.info('STOCKDEALER indexer caught up', finalized.number);
      }
      await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(4663002)').catch(() => {});
    lockClient.release();
    await pool.end();
  }
}

process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });
run().catch(error => {
  console.error('STOCKDEALER indexer halted', error instanceof Error ? error.message : 'UNKNOWN_ERROR');
  process.exitCode = 1;
});
