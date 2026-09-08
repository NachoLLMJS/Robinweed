# Stockdealer

First-person low-poly cultivation game with a mainnet-only Robinhood Chain economy foundation and Railway-ready multiplayer backend. Economic writes remain fail-closed until the official `$STOCKDEALER` token, prices, routes, liquidity, deployment records, and activation gates are verified.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, click **ENTER THE GAME**, and use:

- `WASD` — move
- Mouse — look
- `Shift` — sprint
- `1` — watering can
- `2` — trimmers
- `3` — seed bag
- Left click — use selected item on the targeted pot
- `E` — speak with the vendor
- `Esc` — release pointer; click the world to resume

## Current boundary

The repository contains mainnet-only contracts, a secure wallet transaction client, a Railway API/realtime service, and a private finalized-event indexer. No project contract has been deployed yet and `$STOCKDEALER` does not yet exist. Therefore `/api/config` must keep `economyActive:false`; seed/house writes stay disabled and the warehouse remains a non-economic tutorial. HOOD remains unavailable because there is no canonical Robinhood HOOD Stock Token in the current registry.

## Verification

```bash
npm test
npx hardhat compile
npx hardhat test -- test/contracts/*.test.js
npm run build
npm audit
```

## Mainnet and Railway

- Mainnet runbook: `docs/MAINNET_RAILWAY_RUNBOOK.md`
- API/realtime Railway service: `railway.toml`
- Private indexer Railway service: `railway.indexer.toml`
- Railway variable template: `.env.example` (never includes a deployment key)
- Deployment and activation secrets/config live only in protected files on the operator desktop.

## Meshy

Environment props, characters, buildings, tools, and cultivation assets are generated through Meshy and loaded as versioned GLB files. Generation scripts read `MESHY_API_KEY` from an external `.env` file outside this repository; no secret or local credential path is committed.

The selected production direction is **C — noir modular**. Runtime asset paths are defined in `src/assetManifest.js`; `assets/meshy-manifest.json` is a historical generation record and may mention retired local-only inputs.
