import { NextResponse } from 'next/server';
import { getSimulatedOrders } from '@/lib/data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orders = getSimulatedOrders();
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json([]);
  }
}
