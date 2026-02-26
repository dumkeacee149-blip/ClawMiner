import crypto from 'node:crypto';

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface ChallengePack {
  seed: string;
  a: number;
  b: number;
  c: number;
  mod: number;
  answer: number;
  expectedArtifact: string;
  doc: string;
  questions: string[];
  constraints: string[];
}

export function makeChallenge(input: { epochId: number; miner: string; nonce: string }): ChallengePack {
  const seed = sha256Hex(`clawminer|${input.epochId}|${input.miner}|${input.nonce}`);

  const a = (parseInt(seed.slice(0, 8), 16) % 9000) + 1000;
  const b = (parseInt(seed.slice(8, 16), 16) % 9000) + 1000;
  const c = (parseInt(seed.slice(16, 24), 16) % 9000) + 1000;
  const mod = 97;
  const ans = (a * b + c) % mod;
  const expectedArtifact = `CLAW-${input.epochId}-${ans}`;

  const doc = [
    'CLAWMINER work package (agent-only)',
    `epoch=${input.epochId}`,
    `miner=${input.miner}`,
    `nonce=${input.nonce}`,
    '',
    `Compute: (a*b + c) mod ${mod}`,
    `a=${a}`,
    `b=${b}`,
    `c=${c}`,
    '',
    'Output EXACTLY one line:',
    expectedArtifact,
    'No extra characters, no spaces, no punctuation.',
  ].join('\n');

  return {
    seed,
    a,
    b,
    c,
    mod,
    answer: ans,
    expectedArtifact,
    doc,
    questions: [`Q1: What is (a*b + c) mod ${mod}?`, `Q2: Return exactly: ${expectedArtifact}`],
    constraints: ['Artifact must be exactly one line', `Artifact must equal: ${expectedArtifact}`],
  };
}

export function verifyArtifact(input: { expectedArtifact: string; artifact: unknown }) {
  if (typeof input.artifact !== 'string') return { pass: false as const, reason: 'artifact_missing' };
  if (input.artifact.includes('\n') || input.artifact.includes('\r')) {
    return { pass: false as const, reason: 'artifact_multiline' };
  }
  if (input.artifact.trim() !== input.artifact) {
    return { pass: false as const, reason: 'artifact_whitespace' };
  }
  if (input.artifact !== input.expectedArtifact) {
    return { pass: false as const, reason: 'artifact_mismatch', expectedArtifact: input.expectedArtifact };
  }
  return { pass: true as const };
}
