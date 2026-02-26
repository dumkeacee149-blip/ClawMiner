import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  buildProveMessage,
  importEd25519SpkiDerB64,
  issueLeaseToken,
  normalizeMiner,
  TTL,
  verifyRegisterToken,
  verifyWalletSignature,
} from '../../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const obj = body as {
    miner?: unknown;
    walletSig?: unknown;
    agentSig?: unknown;
    registerToken?: unknown;
  };
  const miner = normalizeMiner(obj?.miner);
  const walletSig = typeof obj?.walletSig === 'string' ? obj.walletSig : null;
  const agentSigB64 = typeof obj?.agentSig === 'string' ? obj.agentSig : null;
  const registerToken = typeof obj?.registerToken === 'string' ? obj.registerToken : null;

  if (!miner || !walletSig || !agentSigB64 || !registerToken) {
    return NextResponse.json({ error: 'missing_or_invalid_fields' }, { status: 400 });
  }

  const register = verifyRegisterToken(registerToken);
  if (!register.ok) {
    return NextResponse.json({ error: 'invalid_register_token', reason: register.reason }, { status: 403 });
  }
  if (register.payload.miner !== miner) {
    return NextResponse.json({ error: 'register_token_miner_mismatch' }, { status: 403 });
  }

  let pub: crypto.KeyObject;
  try {
    pub = importEd25519SpkiDerB64(register.payload.agentPubKeyB64);
  } catch {
    return NextResponse.json({ error: 'invalid_register_key' }, { status: 403 });
  }

  let sig: Buffer;
  try {
    sig = Buffer.from(agentSigB64, 'base64');
  } catch {
    return NextResponse.json({ error: 'invalid_agentSig' }, { status: 400 });
  }

  const okAgent = crypto.verify(null, Buffer.from(register.payload.serverNonce, 'utf8'), pub, sig);
  if (!okAgent) {
    return NextResponse.json({ error: 'agentSig_verify_failed' }, { status: 403 });
  }

  const okWallet = await verifyWalletSignature({
    miner,
    message: buildProveMessage({ miner, serverNonce: register.payload.serverNonce }),
    walletSig,
  });
  if (!okWallet) {
    return NextResponse.json({ error: 'walletSig_not_miner' }, { status: 403 });
  }

  const leaseToken = issueLeaseToken({ miner });
  return NextResponse.json({ leaseToken, expiresInSeconds: TTL.lease, miner });
}
