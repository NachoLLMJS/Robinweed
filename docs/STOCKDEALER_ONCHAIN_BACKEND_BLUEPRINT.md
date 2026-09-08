# STOCKDEALER — Onchain + Railway blueprint

Status: frontend implemented; contracts, wallet writes, swaps, claims, and Railway persistence are intentionally not active.

## Confirmed game rules

- Utility token: `$STOCKDEALER`.
- One seed package costs `100 $STOCKDEALER` and contains exactly 4 seeds of one ticker.
- Every token spend is routed atomically:
  - 60% is swapped into tokenized stocks for the funded reward vault.
  - 40% is burned.
- Harvest claims the same tokenized-stock ticker planted in that pot.
- One watering starts the crop clock.
- Crop advances one visual stage every 2 hours and is mature after four timed advances (8 hours from first watering).
- Each player has a separate private warehouse and private crop state.
- The street/neighborhood is shared online.
- Every rendered neighborhood building is a purchasable property except KFC, Nike, and the restaurant.
- Current frontend catalog: 35 properties, including the two initial buildings beside the warehouse exit.
- Capacities are 4, 8, or 15 equipped stations according to building size.
- Purchase prices: TBA; no sale transaction may activate until explicitly supplied.
- A purchased property has one permanent owner wallet unless a future verified transfer function changes it.
- Only the current owner wallet can enter the property's private interior.
- Houses must be addable without upgrading the core property contract.

## Supplied tokenized-stock assets used by this game

| Ticker | Contract |
| --- | --- |
| HOOD | TBA — absent from supplied image; do not deploy with an invented address |
| MSFT | `0xe93237c50d904957cf27e7b1133b510c669c2e74` |
| TSLA | `0x322f0929c4625ed5bad873c95208d54e1c003b2d` |
| NVDA | `0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec` |
| MSTR | `0xecc262a75e413fafd0df80480274532c79d42da09` |
| AAPL | `0xaf3d76f1834a1d425780943c99ea8a608f8a93f9` |
| QQQ | `0xd5f3879160bc7c32ebb4dc785f8a4f505888de68` |
| GOOGL | `0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3` |

Contracts present in the image but intentionally excluded from this game catalog: SPCX, GME, SPY, DJT.

Before activation, verify chain ID, deployed bytecode, token decimals, transfer behavior, and liquidity for every address. The current UI mentions Robinhood Chain, but chain ID, RPC, router, pool addresses, oracle policy, slippage limits, and finality depth remain TBA.

## Contract modules

### 1. `StockdealerSpendRouter`

Single entry point for all `$STOCKDEALER` spending.

Required behavior:

- Pull the exact approved amount from the player.
- Compute `rewardInput = amount * 60 / 100` and `burnInput = amount - rewardInput` using integer-safe arithmetic.
- Burn `burnInput` in the same transaction.
- Swap `rewardInput` into the configured tokenized-stock asset.
- Deposit swap output directly into `StockRewardVault`; never send output through the frontend or backend wallet.
- Emit the spend purpose (`SEED_PACK`, `HOUSE_PURCHASE`) and selected reward ticker.
- Revert the entire transaction if burn, swap, minimum output, or vault deposit fails.
- Protect against reentrancy, stale quotes, unsupported assets, zero output, and fee-on-transfer surprises.

Seed package spending routes to the selected ticker. Property purchases split their 60% stock allocation across the exact seven-route basket approved in the activation config. Those house outputs are segregated as `protocolReserve` (never seed/harvest collateral) and may be withdrawn only by the accepted Safe multisig owner; withdrawal decrements the reserve before transfer and cannot touch player liabilities.

### 2. `SeedShop`

- Product registry keyed by ticker/product ID.
- Current package configuration: 4 seeds, 100 `$STOCKDEALER`.
- Calls `StockdealerSpendRouter` atomically.
- Emits `SeedPackPurchased(player, ticker, quantity, price, receiptId)`.
- Backend credits seeds only after confirmed event finality; never from a browser success toast.

### 3. `HousePropertyRegistry`

- Add/disable properties through role-controlled registry records: `houseId`, capacity, purchase price, metadata URI, active flag.
- Keep house IDs stable when neighborhood visuals expand.
- Store one current owner wallet per property.
- Reject purchase when the property already has an owner or its price is not configured.
- Purchase, 60% reward swap, 40% burn, and ownership assignment must complete atomically or fully revert.
- Access check: `ownerOfHouse(houseId) == wallet`.
- A future transfer function must be explicit, auditable, and preserve the property's crop-state ownership policy.
- Price/capacity changes affect unowned properties only and cannot silently alter a completed purchase.
- Emit `HouseAdded`, `HouseDisabled`, `HousePurchased`, and, only if approved later, `HouseTransferred`.
- All 35 frontend properties remain transaction-disabled until their prices and the registry deployment are verified.

### 4. `StockRewardVault`

- Holds only allowlisted tokenized-stock contracts.
- Tracks total funded balance and outstanding claim liabilities per ticker.
- Claim authorization must bind wallet, ticker, amount, crop/harvest ID, nonce, and expiry.
- Mark a harvest ID consumed before transfer.
- Reject replay, wrong chain, wrong wallet, wrong ticker, expired authorization, and insufficient reserves.
- Emergency controls may pause new claims but must not allow admins to fabricate player harvests.
- Emit `RewardFunded` and `StockClaimed`.

### 5. Crop settlement authorization

Crop timing can be hybrid, but rewards cannot trust mutable browser state.

Recommended design:

- Contract verifies an EIP-712 server authorization signed by a dedicated Railway settlement signer.
- Signed payload: `player`, `cropId`, `locationType`, `locationId`, `potIndex`, `ticker`, `plantedAt`, `wateredAt`, `maturedAt`, `rewardAmount`, `nonce`, `deadline`, `chainId`, `vault`.
- Vault consumes `cropId`/nonce once.
- Railway signs only after reconciling database state with confirmed seed ownership and property ownership.
- Rotate signer through a timelocked/role-controlled contract function.

Do not put the Railway signer private key in the frontend, repository, database rows, logs, or build environment exposed to Vite.

## Railway database model

Use PostgreSQL as authoritative offchain world/crop state, with chain events as authoritative payment/ownership receipts.

Suggested tables:

- `players(wallet PK, created_at, last_seen_at, current_zone)`
- `seed_balances(wallet, ticker, quantity, version, updated_at)`
- `houses(house_id PK, tier_id, capacity, world_x, world_z, metadata_uri, enabled)`
- `property_purchases(chain_id, tx_hash, log_index, house_id, owner_wallet, purchased_at, price_paid, status, UNIQUE(chain_id, tx_hash, log_index), UNIQUE(house_id))`
- `pots(location_type, location_id, pot_index, owner_wallet, ticker, planted_at, watered_at, growth_stage, harvested_at, version, PRIMARY KEY(location_type, location_id, pot_index))`
- `harvests(crop_id PK, wallet, ticker, reward_amount, matured_at, claimed_tx_hash, claim_nonce, status)`
- `chain_cursor(chain_id PK, last_finalized_block, block_hash)`
- `processed_events(chain_id, tx_hash, log_index, event_name, payload_json, PRIMARY KEY(chain_id, tx_hash, log_index))`
- `player_sessions(session_id PK, wallet, connected_at, disconnected_at, last_position)`

Use integer base units for every token amount; never floating-point numbers.

## Crop state machine

`EMPTY -> PLANTED -> WATERED -> SPROUT -> VEGETATIVE -> FLOWERING -> MATURE -> HARVESTED -> CLAIMED`

Rules:

1. Planting decrements one confirmed seed using a database transaction and optimistic `version` check.
2. First watering sets immutable `watered_at`; later watering requests are idempotent no-ops.
3. Stage is derived from server time and `watered_at`, not a client timer:
   - `<2h`: seed
   - `2–4h`: sprout
   - `4–6h`: vegetative
   - `6–8h`: flowering
   - `>=8h`: mature
4. The database may cache `growth_stage`, but API responses must be able to derive it.
5. Harvest transaction locks the pot row, verifies maturity/access, creates one harvest receipt, then clears the pot.
6. Claims consume one harvest receipt onchain and are reconciled back into PostgreSQL.

Property crop rows remain bound to the house and its owner. Any future ownership-transfer design must explicitly define whether planted crops transfer with the house or must be settled first; do not silently reassign or delete crops.

## Realtime multiplayer boundary

- Shared street: server-authoritative presence snapshots over WebSocket; broadcast wallet-safe public avatar/position state only.
- Warehouse: channel scoped to the authenticated wallet.
- Owned property: channel scoped to `ownerWallet` and `houseId`; ownership is rechecked on connect and before every mutation.
- Never broadcast private inventory, signatures, IP addresses, or full wallet session tokens.
- Rate-limit movement and interactions; validate speed/zone transitions server-side.

## Event indexer and finality

- Consume contract logs in block order.
- Store `(chainId, txHash, logIndex)` idempotently.
- Wait the configured finality depth before crediting seed packs or property purchases.
- Persist block hashes and rewind on reorg.
- Reconcile contract state against PostgreSQL periodically.
- Browser submits tx hash only as a hint; backend independently fetches receipt/logs.

## API boundary

Suggested endpoints:

- `GET /v1/catalog/seeds`
- `GET /v1/houses`
- `GET /v1/houses/:houseId/availability`
- `GET /v1/me/state`
- `POST /v1/crops/:location/:pot/plant`
- `POST /v1/crops/:cropId/water`
- `POST /v1/crops/:cropId/harvest`
- `POST /v1/claims/:harvestId/authorization`
- `GET /v1/transactions/:txHash/status`
- `WS /v1/world/street`

Authenticate writes with wallet sign-in (nonce, domain, URI, chain ID, issued/expiry timestamps). Rotate session cookies; use HttpOnly, Secure, SameSite protection.

## Deployment gates

Keep every payment/claim button disabled until all are true:

1. `$STOCKDEALER` contract, decimals, and burn mechanism verified.
2. Target chain ID/RPC/finality policy verified.
3. Router and liquidity paths verified for every used stock.
4. The exact AAPL/GOOGL/MSFT/MSTR/NVDA/QQQ/TSLA tokenized-stock addresses are supplied and verified; HOOD remains excluded.
5. Purchase price supplied for every enabled property; properties without a price remain unavailable.
6. Property-purchase 60% basket weights and multisig reserve-withdrawal policy approved.
7. Contracts audited/tested; roles and multisig ownership configured.
8. Railway PostgreSQL migrations, event indexer, reorg handling, signer isolation, and backups tested.
9. End-to-end test proves: spend -> 60% stock acquisition -> 40% burn -> seed/property-purchase finality -> timed crop -> ticker-matched claim.
