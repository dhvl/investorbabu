import { NextResponse } from 'next/server';

const ALLOWED_BOT_PREFIX = 'bot8379355466:AAEYFz85mjff2ns3HU7Z5SVjwRgkrpMyrEM';

async function handleRequest(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path'); // e.g., bot8379355466:AAEYFz85mjff2ns3HU7Z5SVjwRgkrpMyrEM/sendMessage
    
    if (!path || !path.startsWith(ALLOWED_BOT_PREFIX)) {
      return NextResponse.json({ error: 'Unauthorized bot proxy request' }, { status: 403 });
    }
    
    const telegramUrl = `https://api.telegram.org/${path}`;
    
    const fetchOptions: RequestInit = {
      method: request.method,
    };
    
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
      }
    }
    
    const res = await fetch(telegramUrl, fetchOptions);
    const resData = await res.json();
    return NextResponse.json(resData, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}
