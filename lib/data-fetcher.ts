const VPS_BASE = 'https://api.investorbabu.com';

async function fetchFromVPS(fileKey: string): Promise<any> {
  try {
    const res = await fetch(`${VPS_BASE}/api/vps-data?file=${fileKey}`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      console.error(`VPS responded with status ${res.status} for ${fileKey}`);
      return fileKey.includes('log') ? { content: "" } : (fileKey.includes('list') ? [] : {});
    }
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${fileKey} from VPS:`, err);
    return fileKey.includes('log') ? { content: "" } : (fileKey.includes('list') ? [] : {});
  }
}

export async function getInstruments() {
  const data = await fetchFromVPS('instruments');
  return data || {};
}

export async function getSignals() {
  const rawSignals = await fetchFromVPS('signals');
  if (!Array.isArray(rawSignals)) return [];
  try {
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
 * Extracts the latest skip reason for an instrument from pre-loaded log content
 */
export function getSkipReason(instrument: string, logContent: string): string {
  if (!logContent) return "System logs unavailable";
  
  try {
    const lines = logContent.split('\n').reverse();
    
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

export async function getTradesForDate(dateStr: string) {
  // dateStr format: YYYYMMDD
  const rawTrades = await fetchFromVPS(`trades_${dateStr}`);
  if (!Array.isArray(rawTrades)) return [];
  try {
    const instruments = await getInstruments();
    
    return rawTrades
      .filter((t: any) => t.symbol in instruments) // Filter only active instruments
      .map((t: any, i: number) => {
        const capital = (t.entry_price || 0) * (t.quantity || 0);
        const return_pct = capital > 0 ? ((t.pnl || 0) / capital) * 100 : 0;
        return {
          id: t.order_id || `t-${dateStr}-${i}`,
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          stock: t.symbol,
          symbol: t.symbol,
          side: t.transaction_type,
          transaction_type: t.transaction_type,
          entry: t.entry_price || 0,
          entry_price: t.entry_price || 0,
          exit: t.exit_price || 0,
          exit_price: t.exit_price || 0,
          qty: t.quantity || 0,
          quantity: t.quantity || 0,
          capital: Math.round(capital),
          pnl: t.pnl || 0,
          return_pct: parseFloat(return_pct.toFixed(2)),
          status: t.status || "COMPLETE",
          time: t.time || "09:15 AM IST",
          verified: false
        };
      });
  } catch {
    return [];
  }
}

export async function getKiteReconciliation() {
  try {
    const response = await fetch(`${VPS_BASE}/kite/reconcile`, { cache: 'no-store', next: { revalidate: 0 } });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Failed to fetch Kite reconciliation:", err);
    return null;
  }
}

export async function getAllTrades() {
  const basenames = await fetchFromVPS('list_trade_files');
  if (!Array.isArray(basenames)) return [];
  
  const tradeFiles = basenames.filter(f => f.startsWith('trades_'));
  const activeInstruments = await getInstruments();
  
  let allTrades: any[] = [];
  const todayDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // Fetch Kite data first to use as a primary source for today
  const kiteData = await getKiteReconciliation();
  const kiteSymbols = kiteData?.status === 'ok' ? kiteData.kite_data : [];

  // Track which instruments traded today
  const tradedToday = new Set<string>();

  // Fetch log content once for skip reasons
  const logData = await fetchFromVPS('bluecandle_log');
  const logContent = logData?.content || '';

  // Fetch all trade files concurrently
  const filePromises = tradeFiles.map(async (file: string) => {
    const dateStr = file.replace('trades_', '');
    const isToday = dateStr === todayDateStr;
    const trades = await getTradesForDate(dateStr);
    return { dateStr, isToday, trades };
  });

  const resolvedFiles = await Promise.all(filePromises);
  // Sort files descending by date
  resolvedFiles.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  resolvedFiles.forEach(({ dateStr, isToday, trades }) => {
    if (isToday && kiteSymbols.length > 0) {
      // For today, we use Kite aggregate data as the source of truth
      kiteSymbols.forEach((ks: any) => {
        const matchingLog = trades.find((t: any) => t.stock === ks.symbol);
        tradedToday.add(ks.symbol);
        allTrades.push({
          id: `kite-${ks.symbol}-${dateStr}`,
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          stock: ks.symbol,
          symbol: ks.symbol,
          side: "TRADED", // Aggregate
          transaction_type: "TRADED",
          entry: ks.avg_price || matchingLog?.entry || 0,
          entry_price: ks.avg_price || matchingLog?.entry || 0,
          exit: ks.last_price || matchingLog?.exit || 0,
          exit_price: ks.last_price || matchingLog?.exit || 0,
          qty: Math.max(
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'BUY' ? t.qty : 0), 0),
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'SELL' ? t.qty : 0), 0)
          ),
          quantity: Math.max(
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'BUY' ? t.qty : 0), 0),
            ks.trades.reduce((acc: number, t: any) => acc + (t.type === 'SELL' ? t.qty : 0), 0)
          ),
          capital: Math.max(Math.round(ks.buy_val), Math.round(ks.sell_val)),
          pnl: ks.pnl,
          return_pct: Math.max(ks.buy_val, ks.sell_val) > 0 
            ? parseFloat(((ks.pnl / Math.max(ks.buy_val, ks.sell_val)) * 100).toFixed(2)) 
            : 0,
          status: "COMPLETE",
          time: "03:30 PM IST",
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
      const reason = getSkipReason(symbol, logContent);
      allTrades.push({
        id: `nt-${symbol}-${todayDateStr}`,
        date: `${todayDateStr.slice(0, 4)}-${todayDateStr.slice(4, 6)}-${todayDateStr.slice(6, 8)}`,
        stock: symbol,
        symbol: symbol,
        side: "ZERO_TRADES",
        transaction_type: "ZERO_TRADES",
        entry: 0,
        entry_price: 0,
        exit: 0,
        exit_price: 0,
        qty: 0,
        quantity: 0,
        capital: 0,
        pnl: 0,
        return_pct: 0,
        time: "09:15 AM IST",
        status: "ZERO_TRADES",
        verified: false,
        reason: reason
      });
    }
  });

  return allTrades;
}

export async function getSummary() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayTrades = await getTradesForDate(today);
  
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
  
  const signals = await getSignals();
  
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

export async function getSimulatedOrders() {
  let allOrders: any[] = [];
  const orders = await fetchFromVPS('simulated_orders');
  if (Array.isArray(orders)) {
    allOrders = orders.map((o: any) => ({ ...o, plan: o.plan || "basic" }));
  }

  // Workaround: Pull today's Indian simulated trades from us_simulated_orders where they were misrouted on VPS
  const liveUsOrders = await fetchFromVPS('us_simulated_orders');
  if (Array.isArray(liveUsOrders)) {
    const indianUS = liveUsOrders
      .filter((o: any) => !["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD", "BTCUSD"].includes(o.symbol))
      .map((o: any) => ({ ...o, plan: o.plan || "basic" }));
    allOrders.push(...indianUS);
  }

  return allOrders;
}

export async function getUsSimulatedOrders() {
  let allOrders: any[] = [];
  
  // Active today's simulated orders
  const liveOrders = await fetchFromVPS('us_simulated_orders');
  if (Array.isArray(liveOrders)) {
    allOrders = liveOrders.map((o: any) => ({ ...o, plan: o.plan || "basic" }));
  }
  
  // Historical trades
  const basenames = await fetchFromVPS('list_trade_files');
  if (Array.isArray(basenames)) {
    const tradeFiles = basenames.filter(f => f.startsWith('us_trades_'));
    
    const filePromises = tradeFiles.map(async (file) => {
      try {
        const dateStrRaw = file.replace('us_trades_', '');
        // format to "19 May 2026"
        const year = dateStrRaw.slice(0, 4);
        const monthNum = dateStrRaw.slice(4, 6);
        const day = dateStrRaw.slice(6, 8);
        const dateObj = new Date(`${year}-${monthNum}-${day}`);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
        
        const pastTrades = await fetchFromVPS(file);
        if (Array.isArray(pastTrades)) {
          return pastTrades.map((t: any) => ({
            symbol: t.symbol,
            date: formattedDate,
            time: t.time,
            plan: t.plan || "basic",
            active_leg: t.transaction_type,
            buy_qty: t.quantity,
            sell_qty: t.quantity,
            entry_price: t.entry_price,
            exit_price: t.exit_price,
            pnl: t.pnl,
            status: t.status,
            verified: false,
            buy_entry: t.entry_price || 0,
            buy_target: null,
            buy_stop_loss: t.exit_price || 0,
            sell_entry: t.entry_price || 0,
            sell_target: null,
            sell_stop_loss: t.exit_price || 0,
            ltp: t.exit_price || 0,
            is_sar: false
          }));
        }
      } catch (err) {
        console.error("Error reading US history", file, err);
      }
      return [];
    });
    
    const resolvedOrdersList = await Promise.all(filePromises);
    resolvedOrdersList.forEach(orders => {
      if (orders) allOrders.push(...orders);
    });
  }
  
  // Filter for US commodities only (exclude Indian symbols and BTCUSD)
  return allOrders.filter(o => ["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD"].includes(o.symbol));
}

export async function getEashaanSimulatedOrders() {
  let allOrders: any[] = [];
  
  // Active today's simulated orders
  const liveOrders = await fetchFromVPS('eashaan_simulated_orders');
  if (Array.isArray(liveOrders)) {
    allOrders = liveOrders.map((o: any) => ({ ...o, plan: o.plan || "basic" }));
  }
  
  // Historical trades
  const basenames = await fetchFromVPS('list_trade_files');
  if (Array.isArray(basenames)) {
    const tradeFiles = basenames.filter(f => f.startsWith('eashaan_trades_'));
    
    const filePromises = tradeFiles.map(async (file) => {
      try {
        const dateStrRaw = file.replace('eashaan_trades_', '');
        const year = dateStrRaw.slice(0, 4);
        const monthNum = dateStrRaw.slice(4, 6);
        const day = dateStrRaw.slice(6, 8);
        const dateObj = new Date(`${year}-${monthNum}-${day}`);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
        
        const pastTrades = await fetchFromVPS(file);
        if (Array.isArray(pastTrades)) {
          return pastTrades.map((t: any) => ({
            symbol: t.symbol,
            date: formattedDate,
            time: t.time,
            plan: t.plan || "basic",
            active_leg: t.transaction_type,
            buy_qty: t.quantity,
            sell_qty: t.quantity,
            entry_price: t.entry_price,
            exit_price: t.exit_price,
            pnl: t.pnl,
            status: t.status,
            verified: false,
            buy_entry: t.entry_price || 0,
            buy_target: null,
            buy_stop_loss: t.exit_price || 0,
            sell_entry: t.entry_price || 0,
            sell_target: null,
            sell_stop_loss: t.exit_price || 0,
            ltp: t.exit_price || 0,
            is_sar: false
          }));
        }
      } catch (err) {
        console.error("Error reading Eashaan history", file, err);
      }
      return [];
    });
    
    const resolvedOrdersList = await Promise.all(filePromises);
    resolvedOrdersList.forEach(orders => {
      if (orders) allOrders.push(...orders);
    });
  }
  
  return allOrders;
}

export async function getCryptoSimulatedOrders() {
  let allOrders: any[] = [];
  
  // Active today's simulated orders
  const liveOrders = await fetchFromVPS('us_simulated_orders');
  if (Array.isArray(liveOrders)) {
    allOrders = liveOrders.map((o: any) => ({ ...o, plan: o.plan || "basic" }));
  }
  
  // Historical trades
  const basenames = await fetchFromVPS('list_trade_files');
  if (Array.isArray(basenames)) {
    const tradeFiles = basenames.filter(f => f.startsWith('us_trades_'));
    
    const filePromises = tradeFiles.map(async (file) => {
      try {
        const dateStrRaw = file.replace('us_trades_', '');
        const year = dateStrRaw.slice(0, 4);
        const monthNum = dateStrRaw.slice(4, 6);
        const day = dateStrRaw.slice(6, 8);
        const dateObj = new Date(`${year}-${monthNum}-${day}`);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
        
        const pastTrades = await fetchFromVPS(file);
        if (Array.isArray(pastTrades)) {
          return pastTrades.map((t: any) => ({
            symbol: t.symbol,
            date: formattedDate,
            time: t.time,
            plan: t.plan || "basic",
            active_leg: t.transaction_type,
            buy_qty: t.quantity,
            sell_qty: t.quantity,
            entry_price: t.entry_price,
            exit_price: t.exit_price,
            pnl: t.pnl,
            status: t.status,
            verified: false,
            buy_entry: t.entry_price || 0,
            buy_target: null,
            buy_stop_loss: t.exit_price || 0,
            sell_entry: t.entry_price || 0,
            sell_target: null,
            sell_stop_loss: t.exit_price || 0,
            ltp: t.exit_price || 0,
            is_sar: false
          }));
        }
      } catch (err) {
        console.error("Error reading Crypto history", file, err);
      }
      return [];
    });
    
    const resolvedOrdersList = await Promise.all(filePromises);
    resolvedOrdersList.forEach(orders => {
      if (orders) allOrders.push(...orders);
    });
  }
  
  return allOrders.filter(o => o.symbol === "BTCUSD");
}
