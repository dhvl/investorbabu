import { NextResponse } from 'next/server';

const KITE_API_URL = 'http://127.0.0.1:5000/kite/instruments';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'in';
    
    const response = await fetch(`${KITE_API_URL}?market=${market}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch instruments');
    const data = await response.json();
    
    // Convert dictionary format to array for UI
    const instruments = Object.keys(data).map((symbol, i) => {
      let exchange = 'NSE';
      if (market === 'us') {
        exchange = 'US';
      } else if (market === 'crypto') {
        exchange = 'CRYPTO';
      } else {
        exchange = data[symbol].split(':')[0] || 'NSE';
      }
      
      return {
        id: i + 1,
        symbol,
        exchange,
        status: 'Active',
        lastSignal: '---',
        isActive: true
      };
    });
    
    return NextResponse.json(instruments);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'in';
    
    const body = await request.json();
    const response = await fetch(`${KITE_API_URL}?market=${market}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) throw new Error('Failed to add instrument');
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'in';
    
    const body = await request.json();
    const response = await fetch(`${KITE_API_URL}?market=${market}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) throw new Error('Failed to remove instrument');
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
