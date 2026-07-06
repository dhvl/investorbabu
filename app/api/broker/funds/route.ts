import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VPS_URL = 'https://api.investorbabu.com/api/broker/funds';

export async function GET() {
  try {
    const response = await fetch(VPS_URL, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
    return NextResponse.json({ status: "error", message: `VPS returned status ${response.status}` }, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch funds:", error);
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
