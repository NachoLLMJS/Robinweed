import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const project='30145f86-77c0-4283-8854-8f631007d94c',environment='production';
const manifest=JSON.parse(readFileSync('config/mainnet-contract-manifest.json','utf8'));
const indexerStartBlock=String(Math.min(...manifest.contracts.map(entry=>entry.deploymentBlock)));
const shared={NODE_ENV:'production',DATABASE_URL:'${{Postgres.DATABASE_URL}}',DATABASE_SSL_MODE:'private',SESSION_SECRET:randomBytes(48).toString('base64url'),PUBLIC_APP_ORIGIN:'https://web-production-a33d80.up.railway.app',ROBINHOOD_CHAIN_ID:'4663',ROBINHOOD_RPC_QUOTE:'https://rpc.mainnet.chain.robinhood.com',ROBINHOOD_RPC_PRIMARY:'https://robinhood-mainnet.drpc.org',ROBINHOOD_RPC_SECONDARY:'https://rpc.ordofi.network',CONTRACT_MANIFEST_PATH:'config/mainnet-contract-manifest.json',INDEXER_START_BLOCK:indexerStartBlock,FINALITY_MODE:'corroborated-finalized-tag',LOG_LEVEL:'info'};
const npxCli=join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js');
for(const service of ['web','indexer']){
  const values={...shared,FLY_ROLE:service};
  const args=['-y','@railway/cli','variable','set','--project',project,'--environment',environment,'--service',service,'--skip-deploys',...Object.entries(values).map(([key,value])=>`${key}=${value}`)];
  const result=spawnSync(process.execPath,[npxCli,...args],{shell:false,stdio:'ignore'});if(result.status!==0)throw new Error(`RAILWAY_VARIABLE_SET_FAILED:${service}`);console.info(`RAILWAY_VARIABLES_SET ${service} ${Object.keys(values).length}`);
}
