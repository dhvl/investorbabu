import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.LOG_FILE_PATH 
  ? path.dirname(process.env.LOG_FILE_PATH) 
  : '/home/investo/bluecandle';

export function getInstruments() {
  const filePath = path.join(DATA_DIR, 'instruments.json');
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

export function getSignals() {
  const filePath = path.join(DATA_DIR, 'signals.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const rawSignals = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return rawSignals.map((s: any, i: number) => ({
      id: `s-${i}`,
      time: s.candle_time,
      date: s.candle_date,
      stock: s.instrument,
      high: s.high || 0,
      low: s.low || 0,
      spread: `${(s.spread_pct || 0).toFixed(3)}%`,
      confidence: s.confidence ? s.confidence.charAt(0).toUpperCase() + s.confidence.slice(1) : 'Medium',
      status: s.status || 'DETECTED'
    }));
  } catch {
    return [];
  }
}

/**
 * Extracts the latest skip reason for an instrument from the log file
 */
export function getSkipReason(instrument: string): string {
  const logPath = path.join(DATA_DIR, 'bluecandle.log');
  if (!fs.existsSync(logPath)) return "System logs unavailable";
  
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').reverse();
    
    // Look for the most recent entry for this instrument today
    const today = new Date().toISOString().slice(0, 10);
    
    for (const line of lines) {
      if (line.includes(instrument) && line.includes(today)) {
        if (line.includes("Orders placed")) return "Breakout orders placed (Simulation Active)";
        if (line.includes("Spread too wide")) return "Spread exceeded 0.8% limit";
        if (line.includes("stale signal")) return "Signal detected too late (stale)";
        if (line.includes("Already reported")) return "Signal already processed";
        if (line.includes("Price too close to H/L")) return "Price too close to entry levels";
        if (line.includes("Price Rs") && line.includes("INSIDE signal zone")) return "Price inside H/L zone at detection";
        if (line.includes("after 3:00 PM")) return "Cutoff reached (after 3:00 PM)";
        if (line.includes("No Blue Candle found")) return "No pattern detected in last scan";
        if (line.includes("Blank TradingView chart")) return "TradingView data failed to load";
        if (line.includes("Duplicate signal")) return "Duplicate pattern ignored";
      }
    }
    return "Scanning active - No pattern detected yet";
  } catch {
    return "Error parsing logs";
  }
}

export function getTradesForDate(dateStr: string) {
  // dateStr format: YYYYMMDD
  const filePath = path.join(DATA_DIR, `trades_${dateStr}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const rawTrades = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const instruments = getInstruments();
    
    return rawTrades
      .filter((t: any) => t.symbol in instruments) // Filter only active instruments
      .map((t: any, i: number) => {
        const capital = (t.entry_price || 0) * (t.quantity || 0);
        const return_pct = capital > 0 ? ((t.pnl || 0) / capital) * 100 : 0;
        return {
          id: t.order_id || `t-${dateStr}-${i}`,
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          stock: t.symbol,
          side: t.transaction_type,
          entry: t.entry_price || 0,
          exit: t.exit_price || 0,
          qty: t.quantity || 0,
          capital: Math.round(capital),
          pnl: t.pnl || 0,
          return_pct: parseFloat(return_pct.toFixed(2)),
          verified: false
        };
      });
  } catch {
    return [];
  }
}

export async function getKiteReconciliation() {
  try {
    const response = await fetch('http://127.0.0.1:5000/kite/reconcile', { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Failed to fetch Kite reconciliation:", err);
    return null;
  }
}

export async function getAllTrades() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR);
  const tradeFiles = files.filter(f => f.startsWith('trades_') && f.endsWith('.json'));
  const activeInstruments = getInstruments();
  
  let allTrades: any[] = [];
  const todayDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // Fetch Kite data first to use as a primary source for today
  const kiteData = await getKiteReconciliation();
  const kiteSymbols = kiteData?.status === 'ok' ? kiteData.kite_data : [];

  // Track which instruments traded today
  const tradedToday = new Set<string>();

  tradeFiles.sort().reverse().forEach((file: string) => {
    const dateStr = file.replace('trades_', '').replace('.json', '');
    const isToday = dateStr === todayDateStr;
    const trades = getTradesForDate(dateStr);
    
    if (isToday && kiteSymbols.length > 0) {
      // For today, we use Kite aggregate data as the source of truth
      kiteSymbols.forEach((ks: any) => {
        const matchingLog = trades.find((t: any) => t.stock === ks.symbol);
        tradedToday.add(ks.symbol);
        allTrades.push({
          id: `kite-${ks.symbol}-${dateStr}`,
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          stock: ks.symbol,
          side: "TRADED", // Aggregate
          entry: ks.avg_price || matchingLog?.entry || 0,
          exit: ks.last_price || matchingLog?.exit || 0,
          qty: Math.max(
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'BUY' ? t.qty : 0), 0),
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'SELL' ? t.qty : 0), 0)
          ),
          capital: Math.max(Math.round(ks.buy_val), Math.round(ks.sell_val)),
          pnl: ks.pnl,
          return_pct: Math.max(ks.buy_val, ks.sell_val) > 0 
            ? parseFloat(((ks.pnl / Math.max(ks.buy_val, ks.sell_val)) * 100).toFixed(2)) 
            : 0,
          verified: true
        });
      });
    } else {
      // For historical data or if Kite fails, use logs
      trades.forEach((t: any) => {
        if (isToday) tradedToday.add(t.stock);
        allTrades.push({ ...t, verified: false });
      });
    }
  });

  // For the current date (today), add instruments that haven't traded yet
  Object.keys(activeInstruments).forEach((symbol: string) => {
    if (!tradedToday.has(symbol)) {
      const reason = getSkipReason(symbol);
      allTrades.push({
        id: `nt-${symbol}-${todayDateStr}`,
        date: `${todayDateStr.slice(0, 4)}-${todayDateStr.slice(4, 6)}-${todayDateStr.slice(6, 8)}`,
        stock: symbol,
        side: "ZERO_TRADES",
        entry: 0,
        exit: 0,
        qty: 0,
        capital: 0,
        pnl: 0,
        return_pct: 0,
        verified: false,
        reason: reason
      });
    }
  });

  return allTrades;
}

export async function getSummary() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayTrades = getTradesForDate(today);
  
  let totalPnL = todayTrades.reduce((acc: number, t: any) => acc + (t.pnl || 0), 0);
  let totalCapital = todayTrades.reduce((acc: number, t: any) => acc + (t.capital || 0), 0);
  
  const kiteData = await getKiteReconciliation();
  let verified = false;
  if (kiteData && kiteData.status === 'ok') {
    const kiteTrades = kiteData.kite_data;
    const actualPnL = kiteTrades.reduce((acc: number, t: any) => acc + t.pnl, 0);
    const actualCapital = kiteTrades.reduce((acc: number, t: any) => acc + Math.max(t.buy_val, t.sell_val), 0);
    
    // Override with actual broker data if available
    if (kiteTrades.length > 0) {
      totalPnL = actualPnL;
      totalCapital = actualCapital;
      verified = true;
    }
  }

  const wins = todayTrades.filter((t: any) => (t.pnl || 0) > 0).length;
  const total = todayTrades.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  
  const signals = getSignals();
  
  return {
    today_pnl: totalPnL,
    pnl_pct: parseFloat((totalPnL / (totalCapital || 10000) * 100).toFixed(2)),
    total_trades: total,
    win_rate: parseFloat(winRate.toFixed(1)),
    total_signals: signals.length,
    status: "online",
    verified: verified,
    last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
}

export function getSimulatedOrders() {
  const filePath = path.join(DATA_DIR, 'simulated_orders.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

