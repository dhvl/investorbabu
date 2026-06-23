import { NextResponse } from 'next/server';

const VPS_BASE = 'https://api.investorbabu.com';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${VPS_BASE}/api/simulation/settings`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      return NextResponse.json({
        indian: { capital: 10000.0, lot_size: 0.0 },
        us: { capital: 10000.0, lot_size: 1.0 },
        crypto: { capital: 0.0, lot_size: 0.1 },
        spread_limit: 0.8,
        age_limit: 120,
        use_strategy_3: true
      });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      indian: { capital: 10000.0, lot_size: 0.0 },
      us: { capital: 10000.0, lot_size: 1.0 },
      crypto: { capital: 0.0, lot_size: 0.1 },
      spread_limit: 0.8,
      age_limit: 120,
      use_strategy_3: true
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${VPS_BASE}/api/simulation/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({ error: errData.error || 'Failed to update VPS simulation settings' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
