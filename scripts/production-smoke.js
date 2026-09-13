import { Wallet } from 'ethers';
import WebSocket from 'ws';
const origin='https://web-production-a33d80.up.railway.app';
const get=async path=>{const r=await fetch(`${origin}${path}`);const text=await r.text();if(!r.ok)throw new Error(`${path}:${r.status}:${text}`);return JSON.parse(text)};
const config=await get('/api/config');
if(config.chainId!==4663||config.economyActive!==true||config.currency?.toLowerCase()!=='0x8998706ebf337575f05f294036ebfc3d1de01290'||config.contracts?.length!==10)throw new Error('PUBLIC_CONFIG_MISMATCH');
const symbols=['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'];
for(const symbol of symbols){const q=await get(`/api/quote/seeds/${symbol}?packs=1&slippageBps=100`);if(BigInt(q.quotedStockOut)<=0n||BigInt(q.minimumStockOut)<=0n)throw new Error(`BAD_SEED_QUOTE:${symbol}`)}
const house=await get('/api/quote/houses/1?slippageBps=100');if(BigInt(house.totalPrice)<=0n||house.tickers?.length!==7||house.minimumOuts?.some(value=>BigInt(value)<=0n))throw new Error('BAD_HOUSE_QUOTE');
const wallet=Wallet.createRandom();
let r=await fetch(`${origin}/auth/challenge`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({address:wallet.address})});let challenge=await r.json();if(!r.ok)throw new Error(`CHALLENGE:${r.status}`);
const signature=await wallet.signMessage(challenge.message);
r=await fetch(`${origin}/auth/verify`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({nonce:challenge.nonce,message:challenge.message,signature})});if(r.status!==204)throw new Error(`VERIFY:${r.status}:${await r.text()}`);const cookie=r.headers.getSetCookie?.()[0]?.split(';')[0]??r.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw new Error('SESSION_COOKIE_MISSING');
r=await fetch(`${origin}/api/state`,{headers:{cookie}});const state=await r.json();if(!r.ok||state.address?.toLowerCase()!==wallet.address.toLowerCase())throw new Error(`STATE:${r.status}:${JSON.stringify(state)}`);
await new Promise((resolve,reject)=>{const ws=new WebSocket('wss://web-production-a33d80.up.railway.app/realtime?role=spectator',{origin});const timer=setTimeout(()=>{ws.terminate();reject(new Error('WEBSOCKET_TIMEOUT'))},10000);ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='snapshot'){clearTimeout(timer);ws.close();resolve()}});ws.on('error',reject)});
console.log(`PRODUCTION_SMOKE_OK contracts=${config.contracts.length} seedQuotes=${symbols.length} houseQuote=1 auth=ok state=ok spectatorWs=ok`);
