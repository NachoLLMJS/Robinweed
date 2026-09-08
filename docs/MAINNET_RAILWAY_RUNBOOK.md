# STOCKDEALER mainnet and Railway runbook

Status: source-ready, not deployed. Robinhood Chain Mainnet only (`chainId 4663`). `$STOCKDEALER` is not launched, so every economic action remains fail-closed.

## External files

Never commit or paste these values into chat:

- `C:\Users\nacho\Desktop\STOCKDEALER_MAINNET_DEPLOY.env`
- `C:\Users\nacho\Desktop\STOCKDEALER_MAINNET_ACTIVATION.json`

The activation JSON contains public configuration but is kept external so incomplete or operator-edited prices/routes cannot silently enter a release commit.

## Phase 1 — foundation before token launch

1. Review and compile the exact repository tree.
2. Fill only the RPC, deployer key, expected deployer, Safe multisig, confirmation gate, and the independently measured complete-sequence `MIN_FOUNDATION_BALANCE_WEI` in the external env.
   The script checks that full balance before creating its journal or broadcasting transaction one.
3. Run all tests and `npm audit`.
4. Run `node scripts/deploy-robinhood-mainnet.js`.
5. Verify `deployments/robinhood-mainnet-foundation.json`, receipts, addresses, code hashes, owner/pendingOwner and paused state.
6. Import `deployments/safe-accept-ownership-batch.json` into the configured Safe.
7. Execute the Safe batch and verify every contract now has the Safe as owner and zero pending owner.

Foundation components:

- EconomyRouter, paused and currency unset.
- GameCore, purchases/gameplay/claims paused.
- Uniswap V3 adapter, paths empty and configuration unfrozen.
- One immutable-asset RewardVault for each canonical supported stock: AAPL, GOOGL, MSFT, MSTR, NVDA, QQQ and TSLA.

HOOD remains unavailable until Robinhood publishes a canonical HOOD Stock Token or an explicit alternative policy is approved.

## Phase 2 — token launch day

1. Verify official `$STOCKDEALER` address, bytecode/source, symbol, decimals, fixed supply policy, burn semantics and ownership.
2. Create and fund real Uniswap V3 liquidity paths from `$STOCKDEALER` to all seven canonical Stock Tokens.
3. Fill the external activation JSON:
   - token address;
   - seed pack price;
   - exact seven-stock house basket totaling 10,000 bps;
   - seven executable paths;
   - all 35 permanent house prices;
   - `activateAfterValidation: true`.
4. Run `node scripts/activate-stockdealer-mainnet.js` without any broadcast option.
5. The script verifies code hashes, multisig ownership, pause state, burn compatibility and positive live quotes, then writes `deployments/safe-activation-batch.json`.
6. Review the printed `planDigest` and the complete Safe batch.
7. Execute the batch atomically from the Safe. Its final ordering is:
   - configure currency/paths/SKUs/houses;
   - freeze adapter;
   - enable claims;
   - enable gameplay;
   - activate Router;
   - enable purchases last.
8. Read every postcondition back from mainnet before setting Railway `economyActive=true`.

## Railway services

Create one Railway project with PostgreSQL and two services from the same GitHub repository.

### api-realtime

- Config file: `railway.toml`
- Start: `npm start`
- Exactly one replica initially.
- Public domain enabled.
- Runs migration pre-deploy.
- Serves frontend, REST/SIWE and `/realtime` WebSocket.

### chain-indexer

- Config file: `railway.indexer.toml`
- Start: `npm run start:indexer`
- Exactly one replica.
- No public domain.
- Uses a PostgreSQL advisory lock.

### Required variables

The deployed, inactive mainnet addresses, blocks, code hashes and ABIs are versioned in `config/mainnet-contract-manifest.json`. Set `CONTRACT_MANIFEST_PATH=config/mainnet-contract-manifest.json`, leave `CONTRACT_MANIFEST_JSON` empty, and use `INDEXER_START_BLOCK=57826741`. The checked-in manifest deliberately keeps `economyActive:false` and `currency:null` until the final token and executable liquidity paths pass activation preflight.

Use `.env.example` as the names-only template. Important rules:

- `DATABASE_SSL_MODE=private` only over Railway private networking; otherwise use `verify-full` with `DATABASE_CA_BASE64`.
- Primary and secondary RPC URLs must have different provider hosts.
- `CONTRACT_MANIFEST_JSON` stays inactive until deployment and activation are independently verified.
- Never add the deployer private key to Railway.

## Launch gates

Do not call the system launched until all are true:

- mainnet receipts and exact deployed bytecode verified;
- multisig accepted ownership;
- token and seven Stock Tokens verified;
- real quotes and liquidity tested with bounded amounts;
- adapter frozen;
- Vault solvency checked;
- all 35 houses and seven seed SKUs read back;
- Railway migrations succeed against real PostgreSQL;
- primary/secondary finalized block and logs agree;
- API readiness is healthy;
- two-browser outside multiplayer smoke test passes;
- seed purchase, permanent house purchase, plant, one-time water, 8-hour maturity and claim smoke tests pass with small real amounts;
- production UI has no QA hooks and no preview ownership path.
