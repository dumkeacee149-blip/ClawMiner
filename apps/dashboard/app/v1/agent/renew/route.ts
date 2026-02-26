import { NextResponse } from 'next/server';

import { issueLeaseToken, TTL, verifyLeaseToken } from '../../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const leaseToken = typeof (body as { leaseToken?: unknown })?.leaseToken === 'string'
    ? (body as { leaseToken: string }).leaseToken
    : null;
  if (!leaseToken) {
    return NextResponse.json({ error: 'missing_leaseToken' }, { status: 400 });
  }

  const lease = verifyLeaseToken(leaseToken);
  if (!lease.ok) {
    return NextResponse.json({ error: 'invalid_lease', reason: lease.reason }, { status: 403 });
  }

  const nextLeaseToken = issueLeaseToken({ miner: lease.payload.miner });
  return NextResponse.json({ ok: true, leaseToken: nextLeaseToken, expiresInSeconds: TTL.lease });
}
