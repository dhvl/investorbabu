import { NextResponse } from 'next/server';

const VPS_BASE = 'https://api.investorbabu.com';

export async function GET() {
  try {
    const res = await fetch(`${VPS_BASE}/api/vps-data?file=instrument_configs`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      return NextResponse.json({});
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${VPS_BASE}/api/instruments/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({ error: errData.error || 'Failed to update VPS config' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

