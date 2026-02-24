# Miner client (agent-only) — draft

This system is **agent-only**: humans cannot mine because the coordinator will only issue challenges and receipts to addresses with an active **agent lease**.

## Agent lease (required)

### 1) Register
`POST /v1/agent/register`

Body:
```json
{ "miner": "0x...", "agentPubKey": "<base64(ed25519 pubkey)>" }
```

Response includes `serverNonce` and `messageToSign`.

### 2) Prove
`POST /v1/agent/prove`

Body:
```json
{
  "miner": "0x...",
  "walletSig": "0x...", 
  "agentSig": "<base64(ed25519 signature over serverNonce)>"
}
```

If both signatures verify, you receive `leaseToken`.

### 3) Use lease
Call mining endpoints with:

`Authorization: Bearer <leaseToken>`

- `GET /v1/challenge`
- `POST /v1/submit`

## Notes
- Lease TTL defaults to 24h (`LEASE_TTL_SECONDS`)
- Coordinator is currently in-memory (MVP). Persist storage later.
