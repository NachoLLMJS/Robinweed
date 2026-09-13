import { readFile, writeFile } from 'node:fs/promises';
import { AbiCoder, getAddress } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';
const basePath=externalConfigPath('STOCKDEALER_MAINNET_ACTIVATION.json');
const routePath=externalConfigPath('STOCKDEALER_FLYCO_ROUTE_REHEARSAL.json');
const outputPath=process.env.STOCKDEALER_REHEARSAL_OUTPUT ?? externalConfigPath('STOCKDEALER_FLYCO_REHEARSAL_ONLY.json');
const STOCKS={AAPL:'0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',GOOGL:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',MSFT:'0xe93237C50D904957Cf27E7B1133b510C669c2e74',MSTR:'0xec262a75e413fAfD0dF80480274532C79D42da09',NVDA:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',QQQ:'0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',TSLA:'0x322F0929c4625eD5bAd873c95208D54E1c003b2d'};
const base=JSON.parse(await readFile(basePath,'utf8')),report=JSON.parse(await readFile(routePath,'utf8')),coder=AbiCoder.defaultAbiCoder();
const curve=getAddress(report.pons.curve),pair=getAddress(report.pons.pairToken),currency=getAddress(report.currency);base.tokenAddress=currency;base.expectedTokenSymbol=report.currencySymbol;base.expectedTokenCodeHash=report.currencyCodeHash;base.burnProbeHolder='0x3949ba1660ad6658d4103ceb7eb8d0a50904fb30';
for(const [symbol,target] of Object.entries(STOCKS)){const chosen=report.routes[symbol]?.[0];if(!chosen&&getAddress(target)!==pair)throw new Error(`NO_ROUTE:${symbol}`);base.paths[symbol]=coder.encode(['address','address','bytes'],[curve,pair,chosen?.path??'0x']);}
base.seedPackPriceTokens='100';base.houseBasket=Object.keys(STOCKS).map((ticker,index)=>({ticker,weightBps:index===6?1426:1429}));
for(const house of base.houses){house.seedPackPriceTokens='100';house.priceTokens=String(Number(house.capacity)*250);house.weeklyPriceTokens=String(Number(house.capacity)*50);}
base.rehearsalOnly=true;base.productionReady=false;base.activateAfterValidation=false;base.rehearsalNote='DO_NOT_BROADCAST: prices are provisional and token is temporary';
await writeFile(outputPath,JSON.stringify(base,null,2)+'\n');console.log(JSON.stringify({outputPath,token:base.tokenAddress,symbol:base.expectedTokenSymbol,curve,pair,routes:Object.keys(base.paths).length,prices:base.houses.length*5,rehearsalOnly:true},null,2));
