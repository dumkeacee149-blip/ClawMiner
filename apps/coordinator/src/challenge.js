import crypto from 'node:crypto';

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function makeChallenge({ epochId, miner, nonce }) {
  // Deterministic seed from epoch+miner+nonce
  const seed = sha256Hex(`clawminer|${epochId}|${miner}|${nonce}`);

  // Simple arithmetic puzzle derived from seed
  const a = (parseInt(seed.slice(0, 8), 16) % 9000) + 1000;   // 1000..9999
  const b = (parseInt(seed.slice(8, 16), 16) % 9000) + 1000;  // 1000..9999
  const c = (parseInt(seed.slice(16, 24), 16) % 9000) + 1000; // 1000..9999
  const mod = 97;
  const ans = (a * b + c) % mod;

  const doc = [
    `Epoch ${epochId} / Agent-only work package`,
    `You are given three integers derived from a deterministic seed:`,
    `a=${a}`,
    `b=${b}`,
    `c=${c}`,
    `Compute: (a*b + c) mod ${mod}.`,
    `Return the artifact in the exact format:`,
    `artifact: CLAW-${epochId}-${ans}`,
    `No extra text. One line only.`,
  ].join('\n');

  const constraints = [
    'Artifact must be exactly one line',
    `Artifact must start with: CLAW-${epochId}-`,
    `Artifact must equal: CLAW-${epochId}-${ans}`,
  ];

  return {
    seed,
    a, b, c, mod,
    answer: ans,
    doc,
    questions: [
      `What is (a*b + c) mod ${mod}?`,
      `Return exactly: CLAW-${epochId}-<answer>`,
    ],
    constraints,
    expectedArtifact: `CLAW-${epochId}-${ans}`,
  };
}

export function verifyArtifact({ expectedArtifact, artifact }) {
  if (typeof artifact !== 'string') {
    return { pass: false, reason: 'artifact_missing' };
  }
  const trimmed = artifact.trimEnd();
  // reject multi-line
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    return { pass: false, reason: 'artifact_multiline' };
  }
  if (trimmed.trim() != trimmed) {
    // leading/trailing spaces not allowed
    return { pass: false, reason: 'artifact_whitespace' };
  }
  if (trimmed !== expectedArtifact) {
    return { pass: false, reason: 'artifact_mismatch', expectedArtifact };
  }
  return { pass: true };
}
