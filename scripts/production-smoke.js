import { readFile } from 'node:fs/promises';
import { Wallet } from 'ethers';
import WebSocket from 'ws';

const origin = 'https://web-production-a33d80.up.railway.app';
const expected = JSON.parse(await readFile(new URL('../config/mainnet-contract-manifest.json', import.meta.url), 'utf8'));
const request = async path => {
  const response = await fetch(`${origin}${path}`);
  const text = await response.text();
  return { response, text, json: () => JSON.parse(text) };
};
const get = async path => {
  const result = await request(path);
  if (!result.response.ok) throw new Error(`${path}:${result.response.status}:${result.text}`);
  return result.json();
};

const config = await get('/api/config');
const expectedNames = expected.contracts.map(contract => contract.name);
if (
  config.chainId !== 4663 ||
  config.economyActive !== expected.economyActive ||
  config.wateringMode !== expected.wateringMode ||
  (config.currency ?? null)?.toLowerCase?.() !== (expected.currency ?? null)?.toLowerCase?.() ||
  JSON.stringify(config.contracts?.map(contract => contract.name)) !== JSON.stringify(expectedNames)
) throw new Error('PUBLIC_CONFIG_MISMATCH');

const symbols = ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA'];
let seedQuotes = 0;
let houseQuote = 0;
if (expected.economyActive) {
  for (const symbol of symbols) {
    const quote = await get(`/api/quote/seeds/${symbol}?packs=1&slippageBps=100`);
    if (BigInt(quote.quotedStockOut) <= 0n || BigInt(quote.minimumStockOut) <= 0n) throw new Error(`BAD_SEED_QUOTE:${symbol}`);
    seedQuotes += 1;
  }
  const quote = await get('/api/quote/houses/1?slippageBps=100');
  if (BigInt(quote.totalPrice) <= 0n || quote.tickers?.length !== 7 || quote.minimumOuts?.some(value => BigInt(value) <= 0n)) throw new Error('BAD_HOUSE_QUOTE');
  houseQuote = 1;
} else {
  for (const path of ['/api/quote/seeds/AAPL?packs=1&slippageBps=100', '/api/quote/houses/1?slippageBps=100']) {
    const result = await request(path);
    if (result.response.status !== 503) throw new Error(`PAUSED_QUOTE_NOT_FAIL_CLOSED:${path}:${result.response.status}`);
  }
}

const wallet = Wallet.createRandom();
let response = await fetch(`${origin}/auth/challenge`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet.address }) });
const challenge = await response.json();
if (!response.ok) throw new Error(`CHALLENGE:${response.status}`);
const signature = await wallet.signMessage(challenge.message);
response = await fetch(`${origin}/auth/verify`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: challenge.nonce, message: challenge.message, signature }) });
if (response.status !== 204) throw new Error(`VERIFY:${response.status}:${await response.text()}`);
const cookie = response.headers.getSetCookie?.()[0]?.split(';')[0] ?? response.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error('SESSION_COOKIE_MISSING');
response = await fetch(`${origin}/api/state`, { headers: { cookie } });
const state = await response.json();
if (!response.ok || state.address?.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(`STATE:${response.status}:${JSON.stringify(state)}`);
await new Promise((resolve, reject) => {
  const socket = new WebSocket('wss://web-production-a33d80.up.railway.app/realtime?role=spectator', { origin });
  const timer = setTimeout(() => { socket.terminate(); reject(new Error('WEBSOCKET_TIMEOUT')); }, 10_000);
  socket.on('message', data => {
    const message = JSON.parse(data);
    if (message.type === 'snapshot') { clearTimeout(timer); socket.close(); resolve(); }
  });
  socket.on('error', reject);
});
console.log(`PRODUCTION_SMOKE_OK mode=${expected.economyActive ? 'active' : 'paused'} contracts=${config.contracts.length} seedQuotes=${seedQuotes} houseQuote=${houseQuote} auth=ok state=ok spectatorWs=ok`);
