# Robinweed

Frontend-only first-person low-poly cultivation game prototype prepared for a future Robinhood Chain integration.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, click **ENTER THE GROW ROOM**, and use:

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

This build contains no contract address, token, wallet request, blockchain transaction, payout, or simulated onchain success. The vendor uses local prototype inventory and cash. Robinhood Chain token/ETH settlement remains fail-closed until verified contracts and funded reward vaults exist.

## Meshy

Environment props, characters, buildings, tools, and cultivation assets are generated through Meshy and loaded as versioned GLB files. Generation scripts read `MESHY_API_KEY` from an external `.env` file outside this repository; no secret or local credential path is committed.

The selected production direction is **C — noir modular**. Runtime asset paths are defined in `src/assetManifest.js`; `assets/meshy-manifest.json` is a historical generation record and may mention retired local-only inputs.
