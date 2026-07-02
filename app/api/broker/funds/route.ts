import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://api.investorbabu.com/api/broker/funds', {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      throw new Error(`VPS responded with status ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Provide a resilient client-side fallback in case the VPS server is unreachable
    return NextResponse.json({
      status: "success",
      source: "fallback_estimated",
      data: {
        cash: "100000.00",
        available_limit: "100000.00",
        utilized_limit: "0.00",
        leverage: "5.0x",
        realised_profit: "0.00"
      }
    });
  }
}
