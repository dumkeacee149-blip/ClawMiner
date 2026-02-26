import { NextResponse } from 'next/server';

import { getEpochInfo } from '../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const e = getEpochInfo();
  return NextResponse.json({
    epochId: e.epochId,
    activeAgents: 0,
    totalCreditsEpoch: 0,
    mintedTotal: e.mintedTotal,
  });
}
