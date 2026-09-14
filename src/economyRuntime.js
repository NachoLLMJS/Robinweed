import { encodeBytes32String, getAddress, Interface, keccak256 } from 'ethers';
import { approveCurrencyIfNeeded, normalizeReceiptStatus, sendGameAction, waitForCanonicalReceipt, waitForSuccessfulReceipt } from './web3EconomyClient.js';
import { HOUSE_PROPERTIES } from './housePropertyState.js';
import { onchainPropertyId } from './onchainPropertyCatalog.js';

const JOURNAL_KEY = 'stockdealer:economy-operation:v1';
let economyOperationActive = false;

async function withEconomyOperation(locks, operation) {
  if (economyOperationActive) throw new Error('ECONOMY_OPERATION_IN_PROGRESS');
  economyOperationActive = true;
  try { return await locks.request('stockdealer-economy', { mode: 'exclusive' }, operation); }
  finally { economyOperationActive = false; }
}
const HASH = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(?:0|[1-9]\d*)$/;
const SYMBOLS = Object.freeze(['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA']);
const QUOTE_WINDOW_SECONDS = 300;
const MAX_QUOTE_AGE_SECONDS = 60;
const HOUSE_CAPACITY = new Map(HOUSE_PROPERTIES.map(property => [onchainPropertyId(property.id), property.capacity]));
const SEED_PURCHASE_EVENTS = new Interface(['event SeedPacksPurchased(address indexed buyer, bytes32 indexed ticker, uint32 packs, uint32 seeds, uint256 paid, uint256 rawStockCredit)']);

async function reportProgress(onProgress, status) {
  try { await onProgress(status); } catch { /* UI progress must never alter transaction semantics. */ }
}
const explicitWalletRejection = error => error?.code === 4001 || error?.code === 'ACTION_REJECTED' || /user rejected/i.test(error?.message ?? '');

function validateConfig(config) {
  if (config?.chainId !== 4663 || typeof config.economyActive !== 'boolean' || !Array.isArray(config.contracts)) throw new Error('INVALID_ECONOMY_CONFIG');
  if (!['onchain', 'visual'].includes(config.wateringMode ?? 'onchain')) throw new Error('INVALID_WATERING_MODE');
  if (config.economyActive) {
    getAddress(config.currency);
    if (!Array.isArray(config.houseBasketSymbols) || config.houseBasketSymbols.length !== SYMBOLS.length || !config.houseBasketSymbols.every((symbol, index) => symbol === SYMBOLS[index])) throw new Error('INCOMPLETE_HOUSE_BASKET');
    for (const name of ['GameCore', 'EconomyRouter']) {
      if (config.contracts.filter(contract => contract.name === name).length !== 1) throw new Error('INCOMPLETE_ECONOMY_CONFIG');
    }
  }
  return config;
}

function contractAddress(config, name) {
  const matches = config.contracts.filter(contract => contract.name === name);
  if (matches.length !== 1) throw new Error('INCOMPLETE_ECONOMY_CONFIG');
  return getAddress(matches[0].address);
}

function validateQuoteIdentity(quote, config) {
  if (quote.chainId !== 4663 || getAddress(quote.gameCore) !== contractAddress(config, 'GameCore') || getAddress(quote.economyRouter) !== contractAddress(config, 'EconomyRouter') || getAddress(quote.currency) !== getAddress(config.currency) || !Number.isSafeInteger(quote.quoteBlock) || quote.quoteBlock < 0 || !HASH.test(quote.quoteBlockHash ?? '') || !Number.isSafeInteger(quote.quoteBlockTimestamp) || quote.quoteBlockTimestamp < 0 || !Number.isSafeInteger(quote.deadline) || quote.deadline !== quote.quoteBlockTimestamp + QUOTE_WINDOW_SECONDS) throw new Error('QUOTE_IDENTITY_MISMATCH');
}

function quantity(value, error = 'INVALID_BLOCK') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(error);
  const parsed = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

async function assertQuoteFresh(ethereum, quote) {
  if (!ethereum?.request) throw new Error('WALLET_UNAVAILABLE');
  const blockTag = `0x${quote.quoteBlock.toString(16)}`;
  const [quotedBlock, latestBlock] = await Promise.all([
    ethereum.request({ method: 'eth_getBlockByNumber', params: [blockTag, false] }),
    ethereum.request({ method: 'eth_getBlockByNumber', params: ['latest', false] }),
  ]);
  if (!quotedBlock || quantity(quotedBlock.number) !== quote.quoteBlock || quotedBlock.hash?.toLowerCase() !== quote.quoteBlockHash.toLowerCase() || quantity(quotedBlock.timestamp) !== quote.quoteBlockTimestamp) throw new Error('QUOTE_BLOCK_CHANGED');
  if (!latestBlock) throw new Error('QUOTE_STALE');
  const latestNumber = quantity(latestBlock.number);
  const latestTimestamp = quantity(latestBlock.timestamp);
  if (latestNumber < quote.quoteBlock || latestTimestamp < quote.quoteBlockTimestamp || latestTimestamp - quote.quoteBlockTimestamp > MAX_QUOTE_AGE_SECONDS) throw new Error('QUOTE_STALE');
  if (latestTimestamp >= quote.deadline) throw new Error('QUOTE_EXPIRED');
}

function positiveDecimal(value) {
  return DECIMAL.test(value ?? '') && BigInt(value) > 0n;
}

function exactMinimum(quoted) {
  return (BigInt(quoted) * 9_900n + 9_999n) / 10_000n;
}

function resumableApproval(storage, expected) {
  const raw=storage.getItem(JOURNAL_KEY);
  if(!raw)return null;
  let journal;try{journal=JSON.parse(raw);}catch{throw new Error('CORRUPT_ECONOMY_JOURNAL');}
  if(journal?.status!=='approvalConfirmed'||journal.approvalConfirmed!==true||journal.type!==expected.type||journal.account?.toLowerCase()!==expected.account.toLowerCase()||(expected.symbol&&journal.symbol!==expected.symbol)||(expected.houseId&&journal.houseId!==expected.houseId))throw new Error('UNRESOLVED_ECONOMY_OPERATION');
  return journal;
}

export async function loadEconomyConfig(fetchImpl = fetch) {
  const response = await fetchImpl('/api/config', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('ECONOMY_CONFIG_UNAVAILABLE');
  return validateConfig(await response.json());
}

export async function loadEconomyConfigWithRetry({ fetchImpl = fetch, maxAttempts = 4, delayMs = 500, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isInteger(delayMs) || delayMs < 0) throw new Error('INVALID_CONFIG_RETRY');
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await loadEconomyConfig(fetchImpl); }
    catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

export async function executeSeedPurchase({ symbol, account, config, ethereum, fetchImpl = fetch, storage = localStorage, locks = navigator.locks, approve = approveCurrencyIfNeeded, send = sendGameAction, waitCanonical = waitForSuccessfulReceipt, authenticate = authenticateSeedPurchaseReceipt, now = Date.now, onProgress = async () => {} }) {
  validateConfig(config);
  if (!config.economyActive || !locks?.request || !storage) throw new Error('ECONOMY_NOT_READY');
  if (!SYMBOLS.includes(symbol)) throw new Error('SEED_NOT_SUPPORTED');
  return withEconomyOperation(locks, async () => {
    const resumed=resumableApproval(storage,{type:'SEED_PURCHASE',symbol,account});
    const quoteResponse = await fetchImpl(`/api/quote/seeds/${symbol}?packs=1&slippageBps=100`, { credentials: 'include', cache: 'no-store' });
    if (!quoteResponse.ok) throw new Error('QUOTE_UNAVAILABLE');
    const quote = await quoteResponse.json();
    validateQuoteIdentity(quote, config);
    if (quote.symbol !== symbol || quote.packs !== 1 || quote.ticker !== encodeBytes32String(symbol) || !HASH.test(quote.ticker ?? '') || !positiveDecimal(quote.totalPrice) || !positiveDecimal(quote.quotedStockOut) || !positiveDecimal(quote.minimumStockOut) || BigInt(quote.minimumStockOut) !== exactMinimum(quote.quotedStockOut)) throw new Error('INVALID_QUOTE');
    await assertQuoteFresh(ethereum, quote);
    const totalPrice = BigInt(quote.totalPrice);
    const minimumStockOut = BigInt(quote.minimumStockOut);
    const deadline = BigInt(quote.deadline);
    const journal = resumed ? { ...resumed, totalPrice: quote.totalPrice } : { type: 'SEED_PURCHASE', symbol, account: account.toLowerCase(), totalPrice: quote.totalPrice, status: 'preparedApproval', createdAt: now() };
    storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    try {
      await reportProgress(onProgress, 'AWAITING_APPROVAL');
      const approvalHash = await approve({ ethereum, config, account, amount: totalPrice, onPrepared: approvalPrepared => { Object.assign(journal, { status: 'preparedApproval', approvalPrepared }); storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } });
      if (approvalHash) {
        journal.status = 'approvalBroadcast'; journal.approvalHash = approvalHash; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
        await reportProgress(onProgress, 'APPROVAL_BROADCAST');
        await waitCanonical(ethereum, approvalHash);
        journal.status = 'approvalConfirmed'; journal.approvalConfirmed = true; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
        await reportProgress(onProgress, 'APPROVAL_CONFIRMED');
      }
      await assertQuoteFresh(ethereum, quote);
      journal.status = 'preparedPurchase'; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      await reportProgress(onProgress, 'AWAITING_PURCHASE');
      const hash = await send({ ethereum, config, account, action: 'buySeedPacks', args: [quote.ticker, 1, totalPrice, minimumStockOut, deadline], onPrepared: actionPrepared => { Object.assign(journal, { status: 'preparedPurchase', actionPrepared }); storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } });
      journal.status = 'purchaseBroadcast'; journal.hash = hash; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      await reportProgress(onProgress, 'PURCHASE_BROADCAST');
      const receipt = await waitCanonical(ethereum, hash);
      const creditedSeeds = await authenticate({ ethereum, receipt, hash, journal, account, symbol, totalPrice });
      storage.removeItem(JOURNAL_KEY);
      await reportProgress(onProgress, 'PURCHASE_CONFIRMED');
      return Object.freeze({ hash, receipt, creditedSeeds });
    } catch (error) {
      if (!journal.hash && !journal.approvalConfirmed && explicitWalletRejection(error)) storage.removeItem(JOURNAL_KEY);
      throw error;
    }
  });
}

function validateHouseQuote(quote, houseId, config) {
  const expectedTickers = config.houseBasketSymbols.map(encodeBytes32String);
  const expectedCapacity = HOUSE_CAPACITY.get(houseId);
  const arrays = [quote.tickers, quote.quotedStockOuts, quote.minimumOuts];
  if (quote.houseId !== houseId || expectedCapacity === undefined || quote.capacity !== expectedCapacity || !positiveDecimal(quote.totalPrice) || arrays.some(values => !Array.isArray(values) || values.length !== SYMBOLS.length) || !quote.tickers.every((ticker, index) => ticker === expectedTickers[index]) || !quote.quotedStockOuts.every(positiveDecimal) || !quote.minimumOuts.every(positiveDecimal) || quote.minimumOuts.some((minimum, index) => BigInt(minimum) !== exactMinimum(quote.quotedStockOuts[index]))) throw new Error('INVALID_QUOTE');
}

export async function executeHousePurchase({ houseId, account, config, ethereum, fetchImpl = fetch, storage = localStorage, locks = navigator.locks, approve = approveCurrencyIfNeeded, send = sendGameAction, waitCanonical = waitForSuccessfulReceipt, now = Date.now }) {
  validateConfig(config);
  if (!config.economyActive || !Number.isInteger(houseId) || !HOUSE_CAPACITY.has(houseId) || !locks?.request || !storage) throw new Error('ECONOMY_NOT_READY');
  return withEconomyOperation(locks, async () => {
    const resumed=resumableApproval(storage,{type:'HOUSE_PURCHASE',houseId,account});
    const quoteResponse = await fetchImpl(`/api/quote/houses/${houseId}?slippageBps=100`, { credentials: 'include', cache: 'no-store' });
    if (!quoteResponse.ok) throw new Error('QUOTE_UNAVAILABLE');
    const quote = await quoteResponse.json();
    validateQuoteIdentity(quote, config);
    validateHouseQuote(quote, houseId, config);
    await assertQuoteFresh(ethereum, quote);
    const totalPrice = BigInt(quote.totalPrice);
    const minimumOuts = quote.minimumOuts.map(BigInt);
    const deadline = BigInt(quote.deadline);
    const journal = resumed ? { ...resumed, totalPrice: quote.totalPrice } : { type: 'HOUSE_PURCHASE', houseId, account: account.toLowerCase(), totalPrice: quote.totalPrice, status: 'preparedApproval', createdAt: now() };
    storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    try {
      const approvalHash = await approve({ ethereum, config, account, amount: totalPrice, onPrepared: approvalPrepared => { Object.assign(journal, { status: 'preparedApproval', approvalPrepared }); storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } });
      if (approvalHash) {
        journal.status = 'approvalBroadcast'; journal.approvalHash = approvalHash; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
        await waitCanonical(ethereum, approvalHash);
        journal.status = 'approvalConfirmed'; journal.approvalConfirmed = true; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      }
      await assertQuoteFresh(ethereum, quote);
      journal.status = 'preparedPurchase'; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      const hash = await send({ ethereum, config, account, action: 'buyHouse', args: [houseId, totalPrice, minimumOuts, deadline], onPrepared: actionPrepared => { Object.assign(journal, { status: 'preparedPurchase', actionPrepared }); storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } });
      journal.status = 'purchaseBroadcast'; journal.hash = hash; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      const receipt = await waitCanonical(ethereum, hash);
      storage.removeItem(JOURNAL_KEY);
      return Object.freeze({ hash, receipt });
    } catch (error) {
      if (!journal.hash && !journal.approvalConfirmed && explicitWalletRejection(error)) storage.removeItem(JOURNAL_KEY);
      throw error;
    }
  });
}

function validatePrepared(prepared, account) {
  if (!prepared || prepared.chainId !== 4663 || prepared.account?.toLowerCase() !== account.toLowerCase() || !Number.isSafeInteger(prepared.nonce) || !HASH.test(prepared.dataHash ?? '') || !/^0x[0-9a-fA-F]{40}$/.test(prepared.target ?? '')) throw new Error('CORRUPT_ECONOMY_JOURNAL');
}

function transactionNonce(transaction) {
  return typeof transaction?.nonce === 'number' ? transaction.nonce : quantity(transaction?.nonce, 'TRANSACTION_IDENTITY_MISMATCH');
}

function validatePreparedTransaction(transaction, prepared, account) {
  const input = transaction?.input ?? transaction?.data;
  if (!transaction || transaction.from?.toLowerCase() !== account.toLowerCase() || transaction.to?.toLowerCase() !== prepared.target.toLowerCase() || transactionNonce(transaction) !== prepared.nonce || !/^0x[0-9a-fA-F]*$/.test(input ?? '') || keccak256(input).toLowerCase() !== prepared.dataHash.toLowerCase()) throw new Error('TRANSACTION_IDENTITY_MISMATCH');
}

export async function authenticateSeedPurchaseReceipt({ ethereum, receipt, hash, journal, account, symbol, totalPrice }) {
  validatePrepared(journal.actionPrepared, account);
  const transaction = await ethereum.request({ method: 'eth_getTransactionByHash', params: [hash] });
  if (transaction?.hash?.toLowerCase() !== hash.toLowerCase()) throw new Error('TRANSACTION_IDENTITY_MISMATCH');
  validatePreparedTransaction(transaction, journal.actionPrepared, account);
  const expectedCore = journal.actionPrepared.target.toLowerCase();
  const matchingEvents = [];
  for (const log of receipt?.logs ?? []) {
    if (log?.address?.toLowerCase() !== expectedCore) continue;
    try {
      const parsed = SEED_PURCHASE_EVENTS.parseLog(log);
      if (parsed?.name === 'SeedPacksPurchased') matchingEvents.push(parsed);
    } catch { /* Ignore unrelated GameCore logs. */ }
  }
  if (matchingEvents.length !== 1) throw new Error('SEED_CREDIT_EVENT_MISMATCH');
  const event = matchingEvents[0].args;
  if (getAddress(event.buyer) !== getAddress(account) || String(event.ticker).toLowerCase() !== encodeBytes32String(symbol).toLowerCase() || event.packs !== 1n || event.seeds !== 4n || event.paid !== totalPrice || event.rawStockCredit <= 0n) throw new Error('SEED_CREDIT_EVENT_MISMATCH');
  return Number(event.seeds);
}

function confirmedStatus(journal) {
  return journal.hash ? 'ACTION_CONFIRMED' : 'APPROVAL_CONFIRMED_RETRY_ACTION';
}

export async function reconcileEconomyJournal({ ethereum, account, storage = localStorage, locks = navigator.locks, waitCanonical = waitForCanonicalReceipt, authenticate = authenticateSeedPurchaseReceipt }) {
  if (!ethereum?.request || !locks?.request || !storage) throw new Error('RECONCILIATION_UNAVAILABLE');
  return withEconomyOperation(locks, async () => {
    const raw = storage.getItem(JOURNAL_KEY);
    if (!raw) return Object.freeze({ status: 'CLEAR' });
    let journal;
    try { journal = JSON.parse(raw); } catch { throw new Error('CORRUPT_ECONOMY_JOURNAL'); }
    if (!journal || typeof journal !== 'object' || journal.account?.toLowerCase() !== account?.toLowerCase()) throw new Error('JOURNAL_ACCOUNT_MISMATCH');
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (chainId?.toLowerCase() !== '0x1237' || accounts?.[0]?.toLowerCase() !== account.toLowerCase()) throw new Error('WALLET_CONTEXT_MISMATCH');
    const failedBeforePreparation = journal.status === 'preparedApproval' && !journal.approvalPrepared && !journal.actionPrepared && !journal.prepared && !journal.approvalHash && !journal.hash && journal.approvalConfirmed !== true;
    if (failedBeforePreparation) {
      storage.removeItem(JOURNAL_KEY);
      return Object.freeze({ status: 'PREPARATION_FAILED_NOT_BROADCAST' });
    }
    const isActionHash = Boolean(journal.hash);
    const isApprovalHash = !isActionHash && Boolean(journal.approvalHash);
    const hash = isActionHash ? journal.hash : journal.approvalHash;
    const prepared = isActionHash ? (journal.actionPrepared ?? journal.prepared) : isApprovalHash ? journal.approvalPrepared : (journal.actionPrepared ?? journal.approvalPrepared ?? journal.prepared);
    if (!hash) {
      validatePrepared(prepared, account);
      const pendingNonce = quantity(await ethereum.request({ method: 'eth_getTransactionCount', params: [account, 'pending'] }), 'INVALID_PENDING_NONCE');
      if (pendingNonce <= prepared.nonce) {
        storage.removeItem(JOURNAL_KEY);
        return Object.freeze({ status: 'PREPARED_NOT_BROADCAST' });
      }
      throw new Error('AMBIGUOUS_NONCE_CONSUMED');
    }
    if (!HASH.test(hash)) throw new Error('CORRUPT_ECONOMY_JOURNAL');
    validatePrepared(prepared, account);
    const [receipt, transaction] = await Promise.all([
      ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] }),
      ethereum.request({ method: 'eth_getTransactionByHash', params: [hash] }),
    ]);
    if (transaction) validatePreparedTransaction(transaction, prepared, account);
    if (receipt) {
      if (!transaction) throw new Error('TRANSACTION_IDENTITY_MISMATCH');
      normalizeReceiptStatus(receipt.status);
      const terminalReceipt=await waitCanonical(ethereum,hash);
      const terminalStatus=normalizeReceiptStatus(terminalReceipt.status);
      if (isApprovalHash && terminalStatus === 1) {
        journal.approvalConfirmed = true;
        journal.status = 'approvalConfirmed';
        delete journal.approvalHash;
        delete journal.approvalPrepared;
        storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
        return Object.freeze({ status: 'APPROVAL_CONFIRMED_RETRY_ACTION', hash });
      }
      let purchaseEvidence = {};
      if (isActionHash && terminalStatus === 1 && journal.type === 'SEED_PURCHASE') {
        if (!SYMBOLS.includes(journal.symbol) || !positiveDecimal(journal.totalPrice)) throw new Error('CORRUPT_ECONOMY_JOURNAL');
        const creditedSeeds = await authenticate({ ethereum, receipt: terminalReceipt, hash, journal, account, symbol: journal.symbol, totalPrice: BigInt(journal.totalPrice) });
        purchaseEvidence = { symbol: journal.symbol, creditedSeeds, receipt: terminalReceipt };
      }
      storage.removeItem(JOURNAL_KEY);
      return Object.freeze({ status: terminalStatus === 1 ? confirmedStatus(journal) : 'TRANSACTION_REVERTED', hash, ...purchaseEvidence });
    }
    if (transaction) return Object.freeze({ status: 'TRANSACTION_PENDING', hash });
    const [latestNonce, pendingNonce] = await Promise.all(['latest', 'pending'].map(tag => ethereum.request({ method: 'eth_getTransactionCount', params: [account, tag] }).then(value => quantity(value, 'INVALID_PENDING_NONCE'))));
    if (latestNonce <= prepared.nonce && pendingNonce <= prepared.nonce) {
      if (journal.approvalConfirmed && journal.hash) {
        delete journal.hash; delete journal.actionPrepared; delete journal.prepared; journal.status = 'approvalConfirmed';
        storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      } else storage.removeItem(JOURNAL_KEY);
      return Object.freeze({ status: journal.hash ? 'ACTION_DROPPED_RETRY' : 'ACTION_DROPPED_RETRY', hash });
    }
    if (latestNonce > prepared.nonce) {
      let replacement;
      if (Number.isSafeInteger(prepared.preparedBlock) && prepared.preparedBlock >= 0) {
        const currentBlock = quantity(await ethereum.request({ method: 'eth_blockNumber' }), 'INVALID_LATEST_BLOCK');
        if (currentBlock - prepared.preparedBlock > 256) throw new Error('REPLACEMENT_SCAN_RANGE_EXCEEDED');
        for (let blockNumber = prepared.preparedBlock; blockNumber <= currentBlock && !replacement; blockNumber += 1) {
          const block = await ethereum.request({ method: 'eth_getBlockByNumber', params: [`0x${blockNumber.toString(16)}`, true] });
          replacement = block?.transactions?.find(candidate => candidate?.from?.toLowerCase() === account.toLowerCase() && transactionNonce(candidate) === prepared.nonce);
        }
      } else {
        const latestBlock = await ethereum.request({ method: 'eth_getBlockByNumber', params: ['latest', true] });
        replacement = latestBlock?.transactions?.find(candidate => candidate?.from?.toLowerCase() === account.toLowerCase() && transactionNonce(candidate) === prepared.nonce);
      }
      if (replacement) {
        validatePreparedTransaction(replacement, prepared, account);
        const replacementReceipt = await ethereum.request({ method: 'eth_getTransactionReceipt', params: [replacement.hash] });
        if (!replacementReceipt) return Object.freeze({ status: 'ACTION_REPLACEMENT_PENDING', hash: replacement.hash });
        normalizeReceiptStatus(replacementReceipt.status);
        const terminalReceipt=await waitCanonical(ethereum,replacement.hash);
        const terminalStatus=normalizeReceiptStatus(terminalReceipt.status);
        if (isApprovalHash && terminalStatus === 1) {
          journal.approvalConfirmed = true;
          journal.status = 'approvalConfirmed';
          delete journal.approvalHash;
          delete journal.approvalPrepared;
          storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
          return Object.freeze({ status: 'APPROVAL_CONFIRMED_RETRY_ACTION', hash: replacement.hash });
        }
        let purchaseEvidence = {};
        if (isActionHash && terminalStatus === 1 && journal.type === 'SEED_PURCHASE') {
          if (!SYMBOLS.includes(journal.symbol) || !positiveDecimal(journal.totalPrice)) throw new Error('CORRUPT_ECONOMY_JOURNAL');
          const replacementJournal = { ...journal, actionPrepared: prepared };
          const creditedSeeds = await authenticate({ ethereum, receipt: terminalReceipt, hash: replacement.hash, journal: replacementJournal, account, symbol: journal.symbol, totalPrice: BigInt(journal.totalPrice) });
          purchaseEvidence = { symbol: journal.symbol, creditedSeeds, receipt: terminalReceipt };
        }
        storage.removeItem(JOURNAL_KEY);
        return Object.freeze({ status: terminalStatus === 1 ? confirmedStatus(journal) : 'TRANSACTION_REVERTED', hash: replacement.hash, ...purchaseEvidence });
      }
      return Object.freeze({ status: 'ACTION_REPLACED', hash });
    }
    return Object.freeze({ status: 'TRANSACTION_STATUS_UNKNOWN', hash });
  });
}

export async function executeCultivationAction({ action, args, account, config, ethereum, storage = localStorage, locks = navigator.locks, send = sendGameAction, waitCanonical = waitForSuccessfulReceipt, now = Date.now }) {
  validateConfig(config);
  if (!config.economyActive || !['plant', 'water', 'claimHarvest', 'plantWarehouse', 'waterWarehouse', 'claimWarehouseHarvest'].includes(action) || !Array.isArray(args) || !locks?.request || !storage) throw new Error('INVALID_CULTIVATION_ACTION');
  return withEconomyOperation(locks, async () => {
    if (storage.getItem(JOURNAL_KEY)) throw new Error('UNRESOLVED_ECONOMY_OPERATION');
    const journal = { type: 'CULTIVATION', action, account: account.toLowerCase(), status: 'preparedAction', createdAt: now() };
    storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    try {
      const hash = await send({ ethereum, config, account, action, args, onPrepared: actionPrepared => { Object.assign(journal, { status: 'preparedAction', actionPrepared }); storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } });
      journal.status = 'actionBroadcast'; journal.hash = hash; storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      const receipt = await waitCanonical(ethereum, hash);
      storage.removeItem(JOURNAL_KEY);
      return Object.freeze({ hash, receipt });
    } catch (error) {
      if (!journal.hash && explicitWalletRejection(error)) storage.removeItem(JOURNAL_KEY);
      throw error;
    }
  });
}
