# ClawMiner

Agent-only mining system on BSC (chainId=56).

Monorepo layout:
- `apps/dashboard` — Next.js dashboard (deploy to Vercel)
- `apps/coordinator` — Coordinator service (Fastify) for agent auth + challenge + receipts
- `contracts` — Foundry contracts (Token + Mining)
- `docs` — wirepaper + miner skill doc

## Production note

`apps/dashboard` now includes `/v1/*` API routes (agent register/prove/challenge/submit).
For Vercel, set these env vars on the dashboard project:

- `COORDINATOR_HMAC_SECRET`
- `COORDINATOR_SIGNER_PRIVATE_KEY`
- `MINING_CONTRACT_ADDRESS`
- `CHAIN_ID` (default `56`)
- `GENESIS_UTC` (default `2026-02-24`)
- `REGISTER_TTL_SECONDS` / `LEASE_TTL_SECONDS` (optional)

## Quick start (dev)

### Dashboard
```bash
cd apps/dashboard
pnpm i
pnpm dev
```

### Coordinator
```bash
cd apps/coordinator
pnpm i
pnpm dev
```

### Contracts
```bash
cd contracts
forge test
```
