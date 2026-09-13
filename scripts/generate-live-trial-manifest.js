import { readFile, writeFile } from 'node:fs/promises';
const symbols=['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'];
const root=new URL('../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
async function main(){
  const journal=await load('deployments/robinhood-mainnet-foundation-v2.json');
  const artifacts={EconomyRouter:await load('artifacts/contracts/StockdealerEconomyRouter.sol/StockdealerEconomyRouter.json'),UniswapV3Adapter:await load('artifacts/contracts/StockdealerPonsAdapter.sol/StockdealerPonsAdapter.json'),GameCore:await load('artifacts/contracts/StockdealerGameCore.sol/StockdealerGameCore.json'),Vault:await load('artifacts/contracts/StockdealerRewardVault.sol/StockdealerRewardVault.json')};
  const pairs=[['EconomyRouter','EconomyRouter'],['UniswapV3Adapter','PonsAdapter'],...symbols.map(symbol=>[`Vault_${symbol}`,`Vault_${symbol}`]),['GameCore','GameCore']];
  const contracts=pairs.map(([name,journalName])=>{const artifact=name.startsWith('Vault_')?artifacts.Vault:artifacts[name],step=journal.steps[journalName];if(step?.status!=='completed'||!Number.isSafeInteger(step.blockNumber))throw new Error(`UNCONFIRMED_DEPLOYMENT:${journalName}`);return{name,address:journal.contracts[journalName],deploymentBlock:step.blockNumber,expectedCodeHash:journal.codeHashes[journalName],abiVersion:'2-pons-trial',abi:artifact.abi};});
  const manifest={chainId:4663,economyActive:true,currency:'0x8998706EbF337575f05F294036eBfc3D1dE01290',houseBasketSymbols:symbols,contracts};
  await writeFile(new URL('config/mainnet-contract-manifest.json',root),`${JSON.stringify(manifest,null,2)}\n`);
  console.info(`LIVE_TRIAL_MANIFEST_WRITTEN ${contracts.length} ${Math.min(...contracts.map(contract=>contract.deploymentBlock))}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'MANIFEST_GENERATION_FAILED');process.exitCode=1;});
