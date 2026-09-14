import { readFile, writeFile } from 'node:fs/promises';
import { Contract, JsonRpcProvider, ZeroAddress, getAddress, keccak256 } from 'ethers';
import { externalConfigPath } from './lib/localPaths.js';

const symbols=['AAPL','GOOGL','MSFT','MSTR','NVDA','QQQ','TSLA'];
const root=new URL('../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const parseEnv=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
async function main(){
  const pausedMode=process.argv.includes('--paused');
  const artifacts={
    FoundationController:await load('artifacts/contracts/StockdealerFoundationControllerV4.sol/StockdealerFoundationControllerV4.json'),
    EconomyRouter:await load('artifacts/contracts/StockdealerEconomyRouter.sol/StockdealerEconomyRouter.json'),
    UniswapV3Adapter:await load('artifacts/contracts/StockdealerPonsLifecycleAdapterV4.sol/StockdealerPonsLifecycleAdapterV4.json'),
    GameCore:await load('artifacts/contracts/StockdealerGameCoreV4.sol/StockdealerGameCoreV4.json'),
    Vault:await load('artifacts/contracts/StockdealerRewardVault.sol/StockdealerRewardVault.json')
  };

  const env=parseEnv(await readFile(process.env.STOCKDEALER_MAINNET_ENV??externalConfigPath('STOCKDEALER_MAINNET_DEPLOY.env'),'utf8'));
  const provider=new JsonRpcProvider(env.ROBINHOOD_MAINNET_RPC_URL,4663,{staticNetwork:true});
  if((await provider.getNetwork()).chainId!==4663n)throw new Error('WRONG_CHAIN');
  const journal=await load('deployments/robinhood-mainnet-foundation-v4.json');
  if(journal.chainId!==4663||journal.status!=='FOUNDATION_V4_DEPLOYED_PAUSED_TOKEN_UNCONFIGURED')throw new Error('V4_FOUNDATION_INVALID');
  const controller=new Contract(journal.contracts.FoundationController,artifacts.FoundationController.abi,provider);
  const router=new Contract(journal.contracts.EconomyRouter,artifacts.EconomyRouter.abi,provider);
  const core=new Contract(journal.contracts.GameCore,artifacts.GameCore.abi,provider);
  const token=getAddress(await controller.stockdealerToken());
  if(pausedMode){
    if(await controller.activated()||token!==ZeroAddress||getAddress(await router.currency())!==ZeroAddress||!(await router.paused())||!(await core.purchasesPaused())||!(await core.gameplayPaused())||!(await core.claimsPaused()))throw new Error('V4_NOT_PAUSED_TOKEN_UNCONFIGURED');
  }else if(!(await controller.activated())||token===ZeroAddress||getAddress(await router.currency())!==token||await router.paused()||await core.purchasesPaused()||await core.gameplayPaused()||await core.claimsPaused())throw new Error('V4_NOT_ACTIVATED_ONCHAIN');
  const pairs=[['FoundationController','FoundationController'],['EconomyRouter','EconomyRouter'],['UniswapV3Adapter','PonsAdapter'],...symbols.map(symbol=>[`Vault_${symbol}`,`Vault_${symbol}`]),['GameCore','GameCore']];
  const contracts=[];
  for(const [name,journalName] of pairs){
    const artifact=name.startsWith('Vault_')?artifacts.Vault:artifacts[name];
    const step=journal.steps[journalName];
    if(step?.status!=='completed'||!Number.isSafeInteger(step.blockNumber))throw new Error(`UNCONFIRMED_DEPLOYMENT:${journalName}`);
    const address=getAddress(journal.contracts[journalName]);
    const code=await provider.getCode(address);
    if(code==='0x'||keccak256(code).toLowerCase()!==journal.codeHashes[journalName]?.toLowerCase())throw new Error(`V4_CODE_HASH_MISMATCH:${journalName}`);
    contracts.push({name,address,deploymentBlock:step.blockNumber,expectedCodeHash:journal.codeHashes[journalName],abiVersion:'4-auto-growth-pons',abi:artifact.abi});
  }
  const manifest={chainId:4663,economyActive:!pausedMode,wateringMode:'visual',currency:pausedMode?null:token,houseBasketSymbols:symbols,contracts};
  await writeFile(new URL('config/mainnet-contract-manifest.json',root),`${JSON.stringify(manifest,null,2)}\n`);
  console.info(`V4_MANIFEST_WRITTEN ${pausedMode?'PAUSED':'ACTIVE'} ${contracts.length} ${pausedMode?ZeroAddress:token} ${Math.min(...contracts.map(contract=>contract.deploymentBlock))}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V4_MANIFEST_GENERATION_FAILED');process.exitCode=1;});
