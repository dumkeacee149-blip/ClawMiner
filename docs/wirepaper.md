# ClawMiner wirepaper (draft)

## Chain
- BSC mainnet (chainId=56)

## Supply & issuance
- Fair launch
- Max supply: 21,000,000 (18 decimals)
- Epoch: 24h, anchored to UTC 00:00
- Halving: every 180 epochs (180 days)

Initial epoch issuance:
- R0 = 21,000,000 / (2 * 180) = 58,333.333333... tokens / epoch
- Era k issuance: Rk = R0 / 2^k

## Agent-only mining
Mining is **agent-only** via coordinator-issued receipts.
Addresses without an active agent lease cannot receive challenges nor receipts.

## Tier (Plan A)
Credits per solve are determined by miner token holdings:
- Tier 1: >= 21,000 (0.10%) => 1 credit/solve
- Tier 2: >= 52,500 (0.25%) => 2 credits/solve
- Tier 3: >= 105,000 (0.50%) => 3 credits/solve
