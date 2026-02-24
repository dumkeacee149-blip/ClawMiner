import Fastify from 'fastify';

const app = Fastify({ logger: true });

// ============ Config ============
const PORT = Number(process.env.PORT || 8787);

// NOTE: Agent-only policy is enforced by requiring a valid lease token
// for challenge + submit. This is a stub implementation.

const leases = new Map(); // leaseToken -> { miner, expMs }

function now() { return Date.now(); }
function randToken() { return crypto.randomUUID(); }

function requireLease(req, reply) {
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return reply.code(401).send({ error: 'missing_lease' });
  const lease = leases.get(token);
  if (!lease) return reply.code(403).send({ error: 'invalid_lease' });
  if (lease.expMs < now()) return reply.code(403).send({ error: 'expired_lease' });
  req.lease = lease;
}

app.get('/healthz', async () => ({ ok: true }));

// ----- Agent auth (stubs) -----
app.post('/v1/agent/register', async (req) => {
  const { miner, agentPubKey } = req.body || {};
  if (!miner || !agentPubKey) return { error: 'missing_fields' };
  return { serverNonce: randToken() };
});

app.post('/v1/agent/prove', async (req) => {
  const { miner } = req.body || {};
  if (!miner) return { error: 'missing_miner' };
  const leaseToken = randToken();
  leases.set(leaseToken, { miner, expMs: now() + 24 * 60 * 60 * 1000 });
  return { leaseToken, expiresInSeconds: 86400 };
});

app.post('/v1/agent/renew', async (req) => {
  const { leaseToken } = req.body || {};
  const lease = leases.get(leaseToken);
  if (!lease) return { error: 'invalid_lease' };
  lease.expMs = now() + 24 * 60 * 60 * 1000;
  return { ok: true, expiresInSeconds: 86400 };
});

// ----- Epoch info (stub) -----
app.get('/v1/epoch', async () => {
  return {
    chainId: 56,
    epochSeconds: 86400,
    halvingEpochs: 180,
    cap: '21000000',
    tier: {
      t1: '21000',
      t2: '52500',
      t3: '105000'
    }
  };
});

// ----- Mining flow (stubs) -----
app.get('/v1/challenge', { preHandler: requireLease }, async (req) => {
  return {
    epochId: 0,
    challengeId: randToken(),
    creditsPerSolve: 1,
    doc: 'TODO: generate deterministic doc',
    questions: ['TODO'],
    constraints: ['TODO']
  };
});

app.post('/v1/submit', { preHandler: requireLease }, async (req) => {
  // TODO: verify artifact deterministically, then issue EIP-712 receipt signature
  return {
    pass: false,
    reason: 'not_implemented'
  };
});

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
