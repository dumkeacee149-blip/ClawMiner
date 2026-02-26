import { NextResponse } from 'next/server';

import {
  bearerToken,
  buildReceipt,
  getEpochInfo,
  makeChallenge,
  signReceipt,
  verifyArtifact,
  verifyLeaseToken,
} from '../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = bearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'missing_lease' }, { status: 401 });

  const lease = verifyLeaseToken(token);
  if (!lease.ok) return NextResponse.json({ error: 'invalid_lease', reason: lease.reason }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const nonce = typeof (body as { nonce?: unknown })?.nonce === 'string' ? (body as { nonce: string }).nonce : '';
  const artifact = (body as { artifact?: unknown })?.artifact;
  if (!nonce || nonce.length > 80) {
    return NextResponse.json({ error: 'missing_or_invalid_nonce' }, { status: 400 });
  }

  const e = getEpochInfo();
  const miner = lease.payload.miner;
  const ch = makeChallenge({ epochId: e.epochId, miner, nonce });
  const verify = verifyArtifact({ expectedArtifact: ch.expectedArtifact, artifact });
  if (!verify.pass) {
    return NextResponse.json({ epochId: e.epochId, ...verify });
  }

  const receipt = buildReceipt({
    epochId: e.epochId,
    miner,
    challengeSeed: ch.seed,
    nonce,
    expectedArtifact: ch.expectedArtifact,
    creditsAmount: 1,
  });
  const signed = await signReceipt(receipt);

  return NextResponse.json({
    pass: true,
    epochId: e.epochId,
    credits: 1,
    artifact: ch.expectedArtifact,
    receipt,
    signature: signed.signature,
    signer: signed.signer,
    warning: signed.warning,
  });
}
