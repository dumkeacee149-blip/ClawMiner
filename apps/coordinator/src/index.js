import Fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'node:crypto';
import { recoverMessageAddress } from 'viem';
import { loadState, saveState } from './state.js';
import { makeChallenge, verifyArtifact } from './challenge.js';

const app = Fastify({ logger: true });

// CORS for local dashboard dev (and optional public dashboard if needed)
await app.register(cors, {
  origin: (origin, cb) => {
    // allow curl/no-origin
    if (!origin) return cb(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: false,
});

const PORT = Number(process.env.PORT || 8787);
const CHAIN_ID = 56;
const EPOCH_SECONDS = 86400;
const HALVING_EPOCHS = 180;
const CAP = 21_000_000;
const R0 = CAP / (2 * HALVING_EPOCHS);
const GENESIS_UTC = process.env.GENESIS_UTC || '2026-02-24';
const LEASE_TTL_SECONDS = Number(process.env.LEASE_TTL_SECONDS || 86400);

// Persist to JSON file by default (MVP)
const STATE_PATH = process.env.STATE_PATH || './state.local.json';

function nowMs() { return Date.now(); }
function randToken() { return crypto.randomUUID(); }

function utcMidnightMs(t = new Date()) {
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0);
}

function genesisMs() {
  const [y, m, d] = GENESIS_UTC.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
}

function getEpochInfo(atMs = nowMs()) {
  const g = genesisMs();
  const day0 = utcMidnightMs(new Date(atMs));
  const epochId = Math.max(0, Math.floor((day0 - g) / (EPOCH_SECONDS * 1000)));
  const epochStartTs = g + epochId * EPOCH_SECONDS * 1000;
  const nextEpochStartTs = epochStartTs + EPOCH_SECONDS * 1000;
  const nextEpochInSeconds = Math.max(0, Math.floor((nextEpochStartTs - atMs) / 1000));
  const era = Math.floor(epochId / HALVING_EPOCHS);
  const epochMint = R0 / Math.pow(2, era);

  const fullEras = era;
  const epochsIntoEra = epochId - fullEras * HALVING_EPOCHS;
  const mintedFull = CAP * (1 - Math.pow(0.5, fullEras));
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

function normalizeMiner(miner) {
  if (typeof miner !== 'string') return null;
  const m = miner.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(m)) return null;
  return m;
}

function buildProveMessage({ miner, serverNonce }) {
  return `ClawMiner Agent Lease Proof\n\nminer: ${miner}\nchainId: ${CHAIN_ID}\nnonce: ${serverNonce}`;
}

function importEd25519SpkiDerB64(b64) {
  const der = Buffer.from(b64, 'base64');
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

// --- load persisted state into in-memory objects ---
const disk = loadState(STATE_PATH);
const registrations = new Map(Object.entries(disk.registrations || {}));
const leases = new Map(Object.entries(disk.leases || {}));

function persist() {
  const registrationsObj = Object.fromEntries(registrations);
  const leasesObj = Object.fromEntries(leases);
  saveState(STATE_PATH, { registrations: registrationsObj, leases: leasesObj });
}

function pruneExpiredLeases() {
  const t = nowMs();
  let changed = false;
  for (const [token, lease] of leases) {
    if (!lease || lease.expMs < t) {
      leases.delete(token);
      changed = true;
    }
  }
  if (changed) persist();
}

async function requireLease(req, reply) {
  pruneExpiredLeases();
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) {
    reply.code(401).send({ error: 'missing_lease' });
    return;
  }
  const lease = leases.get(token);
  if (!lease) {
    reply.code(403).send({ error: 'invalid_lease' });
    return;
  }
  if (lease.expMs < nowMs()) {
    reply.code(403).send({ error: 'expired_lease' });
    return;
  }
  req.lease = lease;
}

function countActiveAgents() {
  pruneExpiredLeases();
  const t = nowMs();
  let n = 0;
  for (const [, lease] of leases) {
    if (lease.expMs >= t) n++;
  }
  return n;
}

app.get('/healthz', async () => ({ ok: true }));

app.get('/v1/epoch', async () => {
  const e = getEpochInfo();
  return {
    ...e,
    epochMintDisplay: e.epochMint.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    mintedTotalDisplay: e.mintedTotal.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    tier: { t1: 21000, t2: 52500, t3: 105000 }
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

// Register: agentPubKey is base64(SPKI DER) ed25519 public key
app.post('/v1/agent/register', async (req, reply) => {
  const miner = normalizeMiner(req.body?.miner);
  const agentPubKey = req.body?.agentPubKey;

  if (!miner || typeof agentPubKey !== 'string') {
    return reply.code(400).send({ error: 'missing_or_invalid_fields' });
  }

  try {
    importEd25519SpkiDerB64(agentPubKey);
  } catch {
    return reply.code(400).send({ error: 'invalid_agentPubKey' });
  }

  const serverNonce = randToken();
  registrations.set(miner, { agentPubKeyB64: agentPubKey, serverNonce, registeredAtMs: nowMs() });
  persist();

  return {
    miner,
    serverNonce,
    messageToSign: buildProveMessage({ miner, serverNonce }),
    note: 'Next: POST /v1/agent/prove with walletSig + agentSig over serverNonce',
  };
});

app.post('/v1/agent/prove', async (req, reply) => {
  const miner = normalizeMiner(req.body?.miner);
  const walletSig = req.body?.walletSig;
  const agentSigB64 = req.body?.agentSig;

  if (!miner || typeof walletSig !== 'string' || typeof agentSigB64 !== 'string') {
    return reply.code(400).send({ error: 'missing_or_invalid_fields' });
  }

  const reg = registrations.get(miner);
  if (!reg) return reply.code(404).send({ error: 'not_registered' });

  const pub = importEd25519SpkiDerB64(reg.agentPubKeyB64);
  const sig = Buffer.from(agentSigB64, 'base64');
  const msg = Buffer.from(reg.serverNonce, 'utf8');

  const okAgent = crypto.verify(null, msg, pub, sig);
  if (!okAgent) return reply.code(403).send({ error: 'agentSig_verify_failed' });

  const proveMsg = buildProveMessage({ miner, serverNonce: reg.serverNonce });
  let recovered;
  try {
    recovered = await recoverMessageAddress({ message: proveMsg, signature: walletSig });
  } catch {
    return reply.code(400).send({ error: 'walletSig_recover_failed' });
  }
  if (normalizeMiner(recovered) !== miner) {
    return reply.code(403).send({ error: 'walletSig_not_miner' });
  }

  const leaseToken = randToken();
  leases.set(leaseToken, { miner, expMs: nowMs() + LEASE_TTL_SECONDS * 1000 });
  persist();

  return { leaseToken, expiresInSeconds: LEASE_TTL_SECONDS, miner };
});

app.post('/v1/agent/renew', async (req, reply) => {
  const leaseToken = req.body?.leaseToken;
  if (typeof leaseToken !== 'string') return reply.code(400).send({ error: 'missing_leaseToken' });
  const lease = leases.get(leaseToken);
  if (!lease) return reply.code(403).send({ error: 'invalid_lease' });
  lease.expMs = nowMs() + LEASE_TTL_SECONDS * 1000;
  leases.set(leaseToken, lease);
  persist();
  return { ok: true, expiresInSeconds: LEASE_TTL_SECONDS };
});

app.get('/v1/challenge', { preHandler: requireLease }, async (req, reply) => {
  const e = getEpochInfo();
  const nonce = (req.query && req.query.nonce) ? String(req.query.nonce) : '';
  if (!nonce || nonce.length > 80) {
    reply.code(400).send({ error: 'missing_or_invalid_nonce' });
    return;
  }
  const miner = req.lease.miner;
  const ch = makeChallenge({ epochId: e.epochId, miner, nonce });
  reply.send({
    epochId: e.epochId,
    miner,
    nonce,
    challengeId: `ch_${ch.seed.slice(0,16)}`,
    creditsPerSolve: 1,
    doc: ch.doc,
    questions: ch.questions,
    constraints: ch.constraints,
    difficulty: e.difficulty
  });
});

app.post('/v1/submit', { preHandler: requireLease }, async (req, reply) => {
  const e = getEpochInfo();
  const miner = req.lease.miner;
  const { nonce, artifact } = req.body || {};
  const nstr = typeof nonce === 'string' ? nonce : '';
  if (!nstr || nstr.length > 80) {
    reply.code(400).send({ error: 'missing_or_invalid_nonce' });
    return;
  }
  const ch = makeChallenge({ epochId: e.epochId, miner, nonce: nstr });
  const v = verifyArtifact({ expectedArtifact: ch.expectedArtifact, artifact });
  if (!v.pass) {
    reply.send({ pass: false, ...v, epochId: e.epochId });
    return;
  }
  reply.send({ pass: true, epochId: e.epochId, credits: 1, artifact: ch.expectedArtifact });
});

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
