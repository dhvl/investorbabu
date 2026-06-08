import { NextResponse } from 'next/server';
import { getCryptoSimulatedOrders } from '@/lib/data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orders = getCryptoSimulatedOrders();
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json([]);
  }
}
