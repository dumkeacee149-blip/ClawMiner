import { NextResponse } from 'next/server';

import { getEpochInfo } from '../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const e = getEpochInfo();
  return NextResponse.json({
    ...e,
    epochMintDisplay: e.epochMint.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    mintedTotalDisplay: e.mintedTotal.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    tier: { t1: 21000, t2: 52500, t3: 105000 },
  });
}
