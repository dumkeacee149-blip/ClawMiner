import Fastify from 'fastify';

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT || 8787);
const CHAIN_ID = 56;
const EPOCH_SECONDS = 86400;
const HALVING_EPOCHS = 180;
const CAP = 21_000_000;
const R0 = CAP / (2 * HALVING_EPOCHS); // 58,333.333333...

// UTC-anchored epoch 0 start (YYYY-MM-DD). Pick a genesis date for indexing.
// You can change this later; it only affects displayed epochId until on-chain canonicalized.
const GENESIS_UTC = process.env.GENESIS_UTC || '2026-02-24';

const leases = new Map(); // leaseToken -> { miner, expMs }

function nowMs() { return Date.now(); }
function randToken() { return crypto.randomUUID(); }

function utcMidnightMs(t = new Date()) {
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0);
}

function genesisMs() {
  // interpret as UTC midnight
  const [y, m, d] = GENESIS_UTC.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
}

function getEpochInfo(atMs = nowMs()) {
  const g = genesisMs();
  const day0 = utcMidnightMs(new Date(atMs));
  const epochId = Math.max(0, Math.floor((day0 - g) / (EPOCH_SECONDS * 1000)));
  const epochStartTs = g + epochId * EPOCH_SECONDS * 1000;
  const nextEpochStartTs = epochStartTs + EPOCH_SECONDS * 1000;
  const nowTs = atMs;
  const nextEpochInSeconds = Math.max(0, Math.floor((nextEpochStartTs - nowTs) / 1000));
  const era = Math.floor(epochId / HALVING_EPOCHS);
  const epochMint = R0 / Math.pow(2, era);

  // cumulative minted until current epoch start (approx, UI-only)
  const fullEras = era;
  const epochsIntoEra = epochId - fullEras * HALVING_EPOCHS;
  const mintedFull = CAP * (1 - Math.pow(0.5, fullEras)); // CAP * (1 - 1/2^fullEras)
  const mintedPartial = epochsIntoEra * (R0 / Math.pow(2, fullEras));
  const mintedTotal = Math.min(CAP, mintedFull + mintedPartial);

  return {
    chainId: CHAIN_ID,
    genesisUtc: GENESIS_UTC,
    epochSeconds: EPOCH_SECONDS,
    halvingEpochs: HALVING_EPOCHS,
    cap: CAP,
    epochId,
    era,
    epochStartTs,
    nextEpochStartTs,
    nextEpochInSeconds,
    difficulty: 1,
    epochMint,
    mintedTotal
  };
}

function requireLease(req, reply) {
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return reply.code(401).send({ error: 'missing_lease' });
  const lease = leases.get(token);
  if (!lease) return reply.code(403).send({ error: 'invalid_lease' });
  if (lease.expMs < nowMs()) return reply.code(403).send({ error: 'expired_lease' });
  req.lease = lease;
}

function countActiveAgents() {
  const t = nowMs();
  let n = 0;
  for (const [, lease] of leases) {
    if (lease.expMs >= t) n++;
  }
  return n;
}

app.get('/healthz', async () => ({ ok: true }));

// --- Read-only public endpoints for dashboard ---
app.get('/v1/epoch', async () => {
  const e = getEpochInfo();
  return {
    ...e,
    // UI-friendly formatting (keep numbers too)
    epochMintDisplay: e.epochMint.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    mintedTotalDisplay: e.mintedTotal.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    tier: {
      t1: 21000,
      t2: 52500,
      t3: 105000
    }
  };
});

app.get('/v1/stats', async () => {
  const e = getEpochInfo();
  return {
    epochId: e.epochId,
    activeAgents: countActiveAgents(),
    totalCreditsEpoch: 0,
    mintedTotal: e.mintedTotal
  };
});

// --- Agent auth (stubs for now) ---
app.post('/v1/agent/register', async (req) => {
  const { miner, agentPubKey } = req.body || {};
  if (!miner || !agentPubKey) return { error: 'missing_fields' };
  return { serverNonce: randToken() };
});

app.post('/v1/agent/prove', async (req) => {
  const { miner } = req.body || {};
  if (!miner) return { error: 'missing_miner' };
  const leaseToken = randToken();
  leases.set(leaseToken, { miner, expMs: nowMs() + 24 * 60 * 60 * 1000 });
  return { leaseToken, expiresInSeconds: 86400 };
});

app.post('/v1/agent/renew', async (req) => {
  const { leaseToken } = req.body || {};
  const lease = leases.get(leaseToken);
  if (!lease) return { error: 'invalid_lease' };
  lease.expMs = nowMs() + 24 * 60 * 60 * 1000;
  return { ok: true, expiresInSeconds: 86400 };
});

// --- Mining flow (stubs) ---
app.get('/v1/challenge', { preHandler: requireLease }, async () => {
  const e = getEpochInfo();
  return {
    epochId: e.epochId,
    challengeId: randToken(),
    creditsPerSolve: 1,
    doc: 'TODO: generate deterministic doc',
    questions: ['TODO'],
    constraints: ['TODO'],
    difficulty: e.difficulty
  };
});

app.post('/v1/submit', { preHandler: requireLease }, async () => {
  return { pass: false, reason: 'not_implemented' };
});

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
