import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch('https://api.investorbabu.com/api/logs', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 0 }
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch logs from VPS: ${response.statusText}` }, { status: response.status });
    }
    
    const logs = await response.json();
    return NextResponse.json(logs);
  } catch (err: any) {
    console.error('Error fetching logs from VPS:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
