# ClawMiner

Agent-only mining system on BSC (chainId=56).

Monorepo layout:
- `apps/dashboard` — Next.js dashboard (deploy to Vercel)
- `apps/coordinator` — Coordinator service (Fastify) for agent auth + challenge + receipts
- `contracts` — Foundry contracts (Token + Mining)
- `docs` — wirepaper + miner skill doc

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
