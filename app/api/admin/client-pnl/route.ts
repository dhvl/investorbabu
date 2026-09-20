import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.LOG_FILE_PATH 
  ? path.dirname(process.env.LOG_FILE_PATH) 
  : path.join(process.cwd(), 'data');

const LOCAL_FILE = path.join(process.cwd(), 'data', 'client_daily_pnl.json');
const VPS_FILE = '/home/investo/bluecandle/client_daily_pnl.json';

function getPnLFilePath() {
  if (fs.existsSync(VPS_FILE)) return VPS_FILE;
  if (fs.existsSync(LOCAL_FILE)) return LOCAL_FILE;
  return LOCAL_FILE;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const date = searchParams.get('date');

    const filePath = getPnLFilePath();
    let records: any[] = [];

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      records = JSON.parse(raw);
    } else if (fs.existsSync(LOCAL_FILE)) {
      const raw = fs.readFileSync(LOCAL_FILE, 'utf8');
      records = JSON.parse(raw);
    }

    // Filter by client_id if provided
    if (clientId) {
      records = records.filter(r => String(r.client_id) === String(clientId));
    }

    // Filter by date if provided
    if (date) {
      records = records.filter(r => r.date === date);
    }

    // Calculate aggregated totals
    let totalGrossProfit = 0;
    let totalCommission = 0;
    let totalNetProfit = 0;
    let totalTrades = 0;
    const uniqueClients = new Set();

    records.forEach(r => {
      totalGrossProfit += Number(r.gross_profit || 0);
      totalCommission += Number(r.commission_amount || 0);
      totalNetProfit += Number(r.net_client_profit || 0);
      totalTrades += Number(r.trades_count || (r.trades ? r.trades.length : 0));
      if (r.client_id) uniqueClients.add(r.client_id);
    });

    return NextResponse.json({
      status: 'success',
      data: records,
      summary: {
        totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalNetProfit: Math.round(totalNetProfit * 100) / 100,
        totalTrades,
        activeClientsCount: uniqueClients.size,
        commissionRate: 0.20,
      }
    });
  } catch (error) {
    console.error('Error fetching client PnL:', error);
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, status, tradeRecord } = body;

    const filePath = getPnLFilePath();
    let records: any[] = [];

    if (fs.existsSync(filePath)) {
      records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    if (action === 'update_status') {
      // Update payout/commission status e.g. PENDING -> INVOICED -> PAID
      const idx = records.findIndex(r => r.id === id);
      if (idx !== -1) {
        records[idx].payout_status = status;
        fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
        return NextResponse.json({ status: 'success', record: records[idx] });
      }
      return NextResponse.json({ status: 'error', message: 'Record not found' }, { status: 404 });
    }

    if (action === 'record_trade' && tradeRecord) {
      // Record trade and recompute 20% commission
      const today = tradeRecord.date || new Date().toISOString().slice(0, 10);
      const cId = tradeRecord.client_id || '45644658';
      const cName = tradeRecord.client_name || 'Dhaval Vadgama';
      const broker = tradeRecord.broker || 'Nuvama Wealth';

      let dailyEntry = records.find(r => r.date === today && String(r.client_id) === String(cId));

      if (!dailyEntry) {
        dailyEntry = {
          id: `pnl-${today.replace(/-/g, '')}-${cId}`,
          date: today,
          client_id: cId,
          client_name: cName,
          broker: broker,
          gross_profit: 0,
          commission_rate: 0.20,
          commission_amount: 0,
          net_client_profit: 0,
          trades_count: 0,
          payout_status: 'PENDING',
          trades: []
        };
        records.unshift(dailyEntry);
      }

      dailyEntry.trades.push(tradeRecord);
      dailyEntry.trades_count = dailyEntry.trades.length;

      // Recalculate P&L
      const gross = dailyEntry.trades.reduce((sum: number, t: any) => sum + Number(t.pnl || 0), 0);
      dailyEntry.gross_profit = Math.round(gross * 100) / 100;
      
      // 20% commission on positive gross profits
      if (dailyEntry.gross_profit > 0) {
        dailyEntry.commission_amount = Math.round((dailyEntry.gross_profit * 0.20) * 100) / 100;
        dailyEntry.net_client_profit = Math.round((dailyEntry.gross_profit - dailyEntry.commission_amount) * 100) / 100;
      } else {
        dailyEntry.commission_amount = 0;
        dailyEntry.net_client_profit = dailyEntry.gross_profit;
      }

      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
      return NextResponse.json({ status: 'success', data: dailyEntry });
    }

    return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in client PnL POST:', error);
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
