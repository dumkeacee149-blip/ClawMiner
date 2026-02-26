import { NextResponse } from 'next/server';

import { bearerToken, getEpochInfo, makeChallenge, verifyLeaseToken } from '../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = bearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'missing_lease' }, { status: 401 });

  const lease = verifyLeaseToken(token);
  if (!lease.ok) return NextResponse.json({ error: 'invalid_lease', reason: lease.reason }, { status: 403 });

  const url = new URL(req.url);
  const nonce = url.searchParams.get('nonce') || '';
  if (!nonce || nonce.length > 80) {
    return NextResponse.json({ error: 'missing_or_invalid_nonce' }, { status: 400 });
  }

  const e = getEpochInfo();
  const miner = lease.payload.miner;
  const ch = makeChallenge({ epochId: e.epochId, miner, nonce });

  return NextResponse.json({
    epochId: e.epochId,
    miner,
    nonce,
    challengeId: `0x${ch.seed}`,
    creditsPerSolve: 1,
    doc: ch.doc,
    questions: ch.questions,
    constraints: ch.constraints,
    difficulty: e.difficulty,
  });
}
