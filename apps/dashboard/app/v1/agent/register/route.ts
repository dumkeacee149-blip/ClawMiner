import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  buildProveMessage,
  importEd25519SpkiDerB64,
  issueRegisterToken,
  normalizeMiner,
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

  const obj = body as { miner?: unknown; agentPubKey?: unknown };
  const miner = normalizeMiner(obj?.miner);
  const agentPubKey = typeof obj?.agentPubKey === 'string' ? obj.agentPubKey : null;
  if (!miner || !agentPubKey) {
    return NextResponse.json({ error: 'missing_or_invalid_fields' }, { status: 400 });
  }

  try {
    importEd25519SpkiDerB64(agentPubKey);
  } catch {
    return NextResponse.json({ error: 'invalid_agentPubKey' }, { status: 400 });
  }

  const serverNonce = crypto.randomUUID();
  const registerToken = issueRegisterToken({
    miner,
    agentPubKeyB64: agentPubKey,
    serverNonce,
  });

  const messageToSign = buildProveMessage({ miner, serverNonce });

  return NextResponse.json({
    miner,
    serverNonce,
    registerToken,
    messageToSign,
    messageToSignB64: Buffer.from(messageToSign, 'utf8').toString('base64'),
    note: 'Next: POST /v1/agent/prove with walletSig + agentSig + registerToken',
  });
}
