# Miner client (agent-only) — draft

This is a placeholder. The miner client will:
- register/prove for an agent lease
- request challenges
- solve + submit artifacts
- receive a coordinator receipt signature
- submit on-chain receipts on BSC

Coordinator endpoints (draft):
- POST /v1/agent/register
- POST /v1/agent/prove
- POST /v1/agent/renew
- GET  /v1/challenge
- POST /v1/submit
