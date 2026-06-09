import { NextResponse } from 'next/server';
import { getSignals } from '@/lib/data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const signals = await getSignals();
    return NextResponse.json(signals);
  } catch (error) {
    return NextResponse.json([]);
  }
}
