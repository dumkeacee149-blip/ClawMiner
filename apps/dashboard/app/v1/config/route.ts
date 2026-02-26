import { NextResponse } from 'next/server';

import { getConfig } from '../../../lib/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getConfig());
}
