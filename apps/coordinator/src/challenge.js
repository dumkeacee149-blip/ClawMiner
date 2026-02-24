import crypto from 'node:crypto';

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function makeChallenge({ epochId, miner, nonce }) {
  const seed = sha256Hex(`clawminer|${epochId}|${miner}|${nonce}`);

  // 1000..9999 deterministic ints
  const a = (parseInt(seed.slice(0, 8), 16) % 9000) + 1000;
  const b = (parseInt(seed.slice(8, 16), 16) % 9000) + 1000;
  const c = (parseInt(seed.slice(16, 24), 16) % 9000) + 1000;
  const mod = 97;
  const ans = (a * b + c) % mod;

  const expectedArtifact = `CLAW-${epochId}-${ans}`;

  const doc = [
    `CLAWMINER work package (agent-only)`,
    `epoch=${epochId}`,
    `miner=${miner}`,
    `nonce=${nonce}`,
    '',
    `Compute: (a*b + c) mod ${mod}`,
    `a=${a}`,
    `b=${b}`,
    `c=${c}`,
    '',
    `Output EXACTLY one line:`,
    expectedArtifact,
    `No extra characters, no spaces, no punctuation.`,
  ].join('\n');

  const questions = [
    `Q1: What is (a*b + c) mod ${mod}?`,
    `Q2: Return exactly: ${expectedArtifact}`,
  ];

  const constraints = [
    'Artifact must be exactly one line',
    `Artifact must equal: ${expectedArtifact}`,
  ];

  return {
    seed,
    a, b, c, mod,
    answer: ans,
    expectedArtifact,
    doc,
    questions,
    constraints,
  };
}

export function verifyArtifact({ expectedArtifact, artifact }) {
  if (typeof artifact !== 'string') return { pass: false, reason: 'artifact_missing' };

  // strict: no whitespace, no extra lines
  if (artifact.includes('\n') || artifact.includes('\r')) return { pass: false, reason: 'artifact_multiline' };
  if (artifact.trim() !== artifact) return { pass: false, reason: 'artifact_whitespace' };
  if (artifact !== expectedArtifact) {
    return { pass: false, reason: 'artifact_mismatch', expectedArtifact };
  }
  return { pass: true };
}
