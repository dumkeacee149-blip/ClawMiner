import crypto from 'node:crypto';
import { recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { makeChallenge, sha256Hex, verifyArtifact } from './challenge';

const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 56);
const EPOCH_SECONDS = 86400;
const HALVING_EPOCHS = 180;
const CAP = 21_000_000;
const R0 = CAP / (2 * HALVING_EPOCHS);
const GENESIS_UTC = process.env.GENESIS_UTC || '2026-02-24';
const LEASE_TTL_SECONDS = Number(process.env.LEASE_TTL_SECONDS || 86400);
const REGISTER_TTL_SECONDS = Number(process.env.REGISTER_TTL_SECONDS || 900);

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

type TokenKind = 'register' | 'lease';

interface TokenEnvelope<T> {
  v: 1;
  kind: TokenKind;
  iat: number;
  exp: number;
  payload: T;
}

export interface RegisterClaims {
  miner: `0x${string}`;
  agentPubKeyB64: string;
  serverNonce: string;
}

export interface LeaseClaims {
  miner: `0x${string}`;
}

export interface ReceiptPayload {
  chainId: number;
  epochId: number;
  miner: `0x${string}`;
  challengeId: `0x${string}`;
  nonceHash: `0x${string}`;
  creditsAmount: number;
  artifactHash: `0x${string}`;
  issuedAt: number;
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64');
}

function secret(): string {
  return (
    process.env.COORDINATOR_HMAC_SECRET ||
    process.env.COORDINATOR_SIGNER_PRIVATE_KEY ||
    'clawminer-dev-secret'
  );
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function signEnvelope<T>(kind: TokenKind, payload: T, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const env: TokenEnvelope<T> = {
    v: 1,
    kind,
    iat: now,
    exp: now + ttlSeconds,
    payload,
  };
  const body = base64UrlEncode(Buffer.from(JSON.stringify(env), 'utf8'));
  const sig = base64UrlEncode(crypto.createHmac('sha256', secret()).update(body, 'utf8').digest());
  return `${body}.${sig}`;
}

function verifyEnvelope<T>(
  token: string,
  expectedKind: TokenKind
): { ok: true; payload: T; iat: number; exp: number } | { ok: false; reason: string } {
  if (typeof token !== 'string' || token.length < 10 || !token.includes('.')) {
    return { ok: false, reason: 'invalid_format' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'invalid_format' };

  const expectSig = base64UrlEncode(
    crypto.createHmac('sha256', secret()).update(body, 'utf8').digest()
  );
  if (!safeEq(sig, expectSig)) return { ok: false, reason: 'invalid_signature' };

  let parsed: TokenEnvelope<T>;
  try {
    parsed = JSON.parse(base64UrlDecode(body).toString('utf8')) as TokenEnvelope<T>;
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  if (parsed.v !== 1 || parsed.kind !== expectedKind) return { ok: false, reason: 'wrong_kind' };
  const now = Math.floor(Date.now() / 1000);
  if (typeof parsed.exp !== 'number' || parsed.exp < now) return { ok: false, reason: 'expired' };
  return { ok: true, payload: parsed.payload, iat: parsed.iat, exp: parsed.exp };
}

export function normalizeMiner(miner: unknown): `0x${string}` | null {
  if (typeof miner !== 'string') return null;
  const m = miner.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(m)) return null;
  return m as `0x${string}`;
}

export function importEd25519SpkiDerB64(b64: string): crypto.KeyObject {
  const der = Buffer.from(b64, 'base64');
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

export function buildProveMessage(input: { miner: string; serverNonce: string }): string {
  return `ClawMiner Agent Lease Proof\n\nminer: ${input.miner}\nchainId: ${CHAIN_ID}\nnonce: ${input.serverNonce}`;
}

export function issueRegisterToken(claims: RegisterClaims): string {
  return signEnvelope('register', claims, REGISTER_TTL_SECONDS);
}

export function verifyRegisterToken(token: string) {
  return verifyEnvelope<RegisterClaims>(token, 'register');
}

export function issueLeaseToken(claims: LeaseClaims): string {
  return signEnvelope('lease', claims, LEASE_TTL_SECONDS);
}

export function verifyLeaseToken(token: string) {
  return verifyEnvelope<LeaseClaims>(token, 'lease');
}

export function getEpochInfo(atMs = Date.now()) {
  const [y, m, d] = GENESIS_UTC.split('-').map((x) => parseInt(x, 10));
  const g = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const day0 = Date.UTC(
    new Date(atMs).getUTCFullYear(),
    new Date(atMs).getUTCMonth(),
    new Date(atMs).getUTCDate(),
    0,
    0,
    0,
    0
  );

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
    mintedTotal,
  };
}

export function getConfig() {
  const signerKey = process.env.COORDINATOR_SIGNER_PRIVATE_KEY || '';
  let signerAddress: `0x${string}` | null = null;
  if (PRIVATE_KEY_RE.test(signerKey)) {
    signerAddress = privateKeyToAccount(signerKey as `0x${string}`).address;
  }

  const miningContract = process.env.MINING_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_MINING_ADDRESS || null;

  return {
    chainId: CHAIN_ID,
    miningContract,
    coordinatorSigner: signerAddress,
    tokenMode: 'hmac-stateless',
  };
}

export async function verifyWalletSignature(input: {
  miner: `0x${string}`;
  message: string;
  walletSig: string;
}): Promise<boolean> {
  try {
    const recovered = await recoverMessageAddress({
      message: input.message,
      signature: input.walletSig as `0x${string}`,
    });
    return normalizeMiner(recovered) === input.miner;
  } catch {
    return false;
  }
}

export function buildReceipt(input: {
  epochId: number;
  miner: `0x${string}`;
  challengeSeed: string;
  nonce: string;
  expectedArtifact: string;
  creditsAmount: number;
}): ReceiptPayload {
  return {
    chainId: CHAIN_ID,
    epochId: input.epochId,
    miner: input.miner,
    challengeId: `0x${input.challengeSeed}` as `0x${string}`,
    nonceHash: `0x${sha256Hex(input.nonce)}` as `0x${string}`,
    creditsAmount: input.creditsAmount,
    artifactHash: `0x${sha256Hex(input.expectedArtifact)}` as `0x${string}`,
    issuedAt: Math.floor(Date.now() / 1000),
  };
}

export async function signReceipt(
  receipt: ReceiptPayload
): Promise<{ signature: `0x${string}` | null; signer: `0x${string}` | null; warning?: string }> {
  const signerKey = process.env.COORDINATOR_SIGNER_PRIVATE_KEY || '';
  if (!PRIVATE_KEY_RE.test(signerKey)) {
    return { signature: null, signer: null, warning: 'missing_or_invalid_signer' };
  }

  const miningContractRaw =
    process.env.MINING_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_MINING_ADDRESS || '';
  if (!ADDRESS_RE.test(miningContractRaw)) {
    return { signature: null, signer: null, warning: 'missing_or_invalid_mining_contract' };
  }

  const account = privateKeyToAccount(signerKey as `0x${string}`);
  const signMessage = {
    chainId: BigInt(receipt.chainId),
    epochId: BigInt(receipt.epochId),
    miner: receipt.miner,
    challengeId: receipt.challengeId,
    nonceHash: receipt.nonceHash,
    creditsAmount: BigInt(receipt.creditsAmount),
    artifactHash: receipt.artifactHash,
    issuedAt: BigInt(receipt.issuedAt),
  };
  const signature = await account.signTypedData({
    domain: {
      name: 'ClawMiner',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: miningContractRaw as `0x${string}`,
    },
    types: {
      Receipt: [
        { name: 'chainId', type: 'uint256' },
        { name: 'epochId', type: 'uint256' },
        { name: 'miner', type: 'address' },
        { name: 'challengeId', type: 'bytes32' },
        { name: 'nonceHash', type: 'bytes32' },
        { name: 'creditsAmount', type: 'uint256' },
        { name: 'artifactHash', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
      ],
    },
    primaryType: 'Receipt',
    message: signMessage,
  });

  return { signature, signer: account.address };
}

export function bearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export const TTL = {
  lease: LEASE_TTL_SECONDS,
  register: REGISTER_TTL_SECONDS,
};

export { makeChallenge, sha256Hex, verifyArtifact };
