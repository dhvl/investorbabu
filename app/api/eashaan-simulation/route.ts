import { NextResponse } from 'next/server';
import { getEashaanSimulatedOrders } from '@/lib/data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orders = await getEashaanSimulatedOrders();
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json([]);
  }
}
