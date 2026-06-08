import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TICKERS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', market: 'Indian Equity' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', market: 'Indian Equity' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', market: 'Indian Equity' },
  { symbol: 'INFY.NS', name: 'Infosys', market: 'Indian Equity' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel', market: 'Indian Equity' },
  { symbol: 'GC=F', name: 'Gold Futures', market: 'US Commodities' },
  { symbol: 'SI=F', name: 'Silver Futures', market: 'US Commodities' },
  { symbol: 'CL=F', name: 'Crude Oil', market: 'US Commodities' },
  { symbol: 'BTC-USD', name: 'Bitcoin', market: 'Cryptocurrency' },
  { symbol: 'ETH-USD', name: 'Ethereum', market: 'Cryptocurrency' }
];

export async function GET() {
  try {
    const promises = TICKERS.map(async (t) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=1d`, {
          next: { revalidate: 60 } // Cache for 60 seconds
        });
        if (!res.ok) return null;
        const json = await res.json();
        const meta = json.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.previousClose;
        const changePct = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

        return {
          symbol: t.symbol.replace('.NS', ''),
          name: t.name,
          market: t.market,
          price: currentPrice,
          change: changePct
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

    // Sort by absolute change percentage to display top moving assets (gainers/losers)
    validResults.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return NextResponse.json(validResults);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
