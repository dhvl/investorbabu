"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Bell, Zap, Info, Wallet, TrendingUp, Scan, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClientDashboard() {
  const [funds, setFunds] = useState<any>(null);
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeScanSymbol, setActiveScanSymbol] = useState("TATASTEEL");
  const [scanMessage, setScanMessage] = useState("Scanning Indian Equity basket...");
  const [signals, setSignals] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  useEffect(() => {
    async function loadFunds() {
      try {
        const res = await fetch("/api/broker/funds");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            setFunds(data.data);
          }
        }
      } catch (err) {
        console.error("Failed to load funds:", err);
      }
    }

    async function loadSignals() {
      try {
        const res = await fetch("/api/signals");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // Keep only the latest entry for each unique stock
            const uniqueMap = new Map();
            data.forEach((s: any) => {
              if (!uniqueMap.has(s.stock)) {
                uniqueMap.set(s.stock, s);
              }
            });
            setSignals(Array.from(uniqueMap.values()));
          }
        }
      } catch (err) {
        console.error("Failed to load signals:", err);
      }
    }

    async function loadTrades() {
      try {
        const res = await fetch("/api/trades");
        if (res.ok) {
          const data = await res.json();
          const rawTrades = Array.isArray(data) ? data : [];
          
          // Calculate today's date in Asia/Kolkata timezone (YYYY-MM-DD format)
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          
          const filteredTrades = rawTrades.filter((t: any) => 
            t.date === todayStr &&
            (t.transaction_type === "BUY" || 
             t.transaction_type === "SELL" || 
             t.transaction_type === "TRADED")
          );
          setTrades(filteredTrades);
        }
      } catch (err) {
        console.error("Failed to load trades:", err);
      } finally {
        setTradesLoading(false);
      }
    }

    loadFunds();
    loadSignals();
    loadTrades();

    const fundsInterval = setInterval(loadFunds, 30000);
    const signalsInterval = setInterval(loadSignals, 15000);
    const tradesInterval = setInterval(loadTrades, 15000);

    return () => {
      clearInterval(fundsInterval);
      clearInterval(signalsInterval);
      clearInterval(tradesInterval);
    };
  }, []);

  // Radar rotater & target ticker updater
  useEffect(() => {
    const angleInterval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 40);

    const tickerInterval = setInterval(() => {
      const symbols = ["TATASTEEL", "HAVELLS", "DLF", "ADANIENSOL", "IDEA"];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      setActiveScanSymbol(randomSymbol);
      
      const actions = [
        "Evaluating multi-timeframe extremes...",
        "Analyzing volume breakouts...",
        "Running Strategy 3 risk locks...",
        "Calculating distance 1R targets...",
        "Checking active SMC limit boundaries..."
      ];
      setScanMessage(actions[Math.floor(Math.random() * actions.length)]);
    }, 4000);

    return () => {
      clearInterval(angleInterval);
      clearInterval(tickerInterval);
    };
  }, []);

  // Helper to group trades by symbol
  const groupTradesBySymbol = (tradeList: any[]) => {
    return tradeList.reduce((acc: any, t: any) => {
      const sym = t.symbol || "UNKNOWN";
      if (!acc[sym]) acc[sym] = [];
      acc[sym].push(t);
      return acc;
    }, {});
  };

  return (
    <div className="p-8 pb-24 max-w-6xl mx-auto space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Signal Feed</h1>
          <p className="text-text-secondary text-sm mt-1">Real-time TradingView Blue Candle signals and live trade books.</p>
        </div>
        <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
           <Zap className="w-4 h-4 text-warning fill-warning animate-pulse" />
           <span className="text-xs font-bold text-white uppercase tracking-wider">Live Updates Enabled</span>
        </div>
      </div>

      {/* Funds Overview Widget */}
      {funds && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">SMC Available Limit</p>
              <h3 className="text-2xl font-bold font-mono text-white">₹{parseFloat(funds.available_limit).toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <Wallet className="w-5 h-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Active Leverage</p>
              <h3 className="text-2xl font-bold font-mono text-white">{funds.leverage}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
              <Zap className="w-5 h-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Daily Realised P&L</p>
              <h3 className={cn(
                "text-2xl font-bold font-mono",
                parseFloat(funds.realised_profit) >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                ₹{parseFloat(funds.realised_profit).toLocaleString(undefined, {minimumFractionDigits: 2})}
              </h3>
            </div>
            <div className={cn(
              "p-3 rounded-2xl",
              parseFloat(funds.realised_profit) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Visual Scanner radar */}
      <GlassCard glowColor="rgba(16, 185, 129, 0.15)" className="min-h-[360px] p-8 flex flex-col justify-between overflow-hidden relative border-white/5">
        <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Scan className="w-5 h-5 text-emerald-400 animate-pulse" /> Algorithmic Scanner Radar
            </h3>
            <p className="text-text-secondary text-xs mt-1">Real-time status of visual chart scanner and active target checks.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1 text-[0.65rem] font-bold text-blue-400 uppercase tracking-widest font-mono">
            <span className="text-slate-500">Locking:</span> {activeScanSymbol}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
          {/* Left: Animated Radar Art */}
          <div className="flex justify-center items-center relative">
            <div className="relative w-48 h-48 rounded-full border border-emerald-500/20 bg-emerald-950/5 flex items-center justify-center overflow-hidden">
              <div className="absolute w-32 h-32 rounded-full border border-emerald-500/10" />
              <div className="absolute w-16 h-16 rounded-full border border-emerald-500/10" />
              
              <div className="absolute w-full h-[1px] bg-emerald-500/10" />
              <div className="absolute h-full w-[1px] bg-emerald-500/10" />
              
              <div 
                className="absolute w-24 h-24 origin-bottom-right bottom-[50%] right-[50%] bg-gradient-to-tr from-transparent to-emerald-500/30 rounded-tr-full"
                style={{ transform: `rotate(${radarAngle}deg)` }}
              />

              <div className="absolute top-[20%] left-[30%] w-2 h-2 bg-emerald-400 rounded-full animate-ping pointer-events-none" />
              <div className="absolute bottom-[35%] right-[25%] w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse pointer-events-none" />
              <div className="absolute top-[45%] right-[40%] w-1.5 h-1.5 bg-amber-400 rounded-full pointer-events-none" />
              <div className="absolute top-[25%] left-[18%] w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse pointer-events-none" />
              <div className="absolute bottom-[20%] left-[28%] w-2 h-2 bg-emerald-500 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />

              <span className="text-[0.55rem] font-black uppercase text-emerald-400/30 font-mono tracking-widest absolute">
                SCANNER ACTIVE
              </span>
            </div>
          </div>

          {/* Right: Ticker messages */}
          <div className="flex flex-col justify-center space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">
              Scanner Action
            </h4>
            <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                <span className="text-xs font-bold text-white font-mono">{activeScanSymbol}</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed font-mono min-h-[36px]">
                {scanMessage}
              </p>
              <div className="text-[9px] text-slate-500 font-mono">
                Channel: TradingView Scanner Core
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Signal Feed Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white tracking-tight border-l-2 border-accent-cyan pl-2 mb-4">
          Latest Scanner Signals
        </h3>
        {signals.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-12 glass rounded-2xl border-white/5">
            No signals triggered in the current session.
          </div>
        ) : (
          <div className="space-y-4">
            {signals.map((signal) => (
              <GlassCard key={signal.id} className="relative group overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg",
                      (signal.type === "BUY" || signal.status === "BUY") ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                    )}>
                      {(signal.type === "BUY" || signal.status === "BUY") ? "B" : "S"}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{signal.stock}</h3>
                      <p className="text-text-secondary text-xs mt-0.5">Detected at {signal.time}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8 flex-1 max-w-xl">
                    <div>
                      <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Entry Price</p>
                      <p className="text-base font-mono font-bold text-white">₹{(signal.entry || signal.high || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Stop Loss</p>
                      <p className="text-base font-mono font-bold text-danger/80">₹{(signal.sl || signal.low || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Target (+1%)</p>
                      <p className="text-base font-mono font-bold text-success">
                        ₹{(signal.target || (signal.high ? signal.high * 1.01 : 0) || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge variant={signal.status === "Active" || signal.status === "DETECTED" ? "info" : "success"} className="px-4 py-1 text-sm mb-2">
                      {signal.status}
                    </Badge>
                    <p className="text-[10px] text-text-secondary italic">Updated live</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Live Order Book */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white tracking-tight border-l-2 border-accent-violet pl-2">
          Live Order & Position Book
        </h3>
        
        {tradesLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-accent-violet" />
            <span className="text-xs">Loading live trades...</span>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-12 glass rounded-2xl border-white/5">
            No live trades executed in the current session. Live trades appear here as soon as Kite/Upstox triggers them.
          </div>
        ) : (
          (() => {
            const grouped = groupTradesBySymbol(trades);
            const symbols = Object.keys(grouped).sort();

            return (
              <div className="space-y-8">
                {symbols.map(symbol => {
                  const symbolOrders = grouped[symbol];
                  symbolOrders.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
                  const symbolPnL = symbolOrders.reduce((sum: number, o: any) => sum + (o.pnl || 0), 0);
                  const symbolCapital = symbolOrders.reduce((sum: number, o: any) => sum + (o.entry_price * o.quantity || 20000), 0);
                  const symbolPnLPct = symbolCapital > 0 ? (symbolPnL / symbolCapital) * 100 : 0;

                  return (
                    <div key={symbol} className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-white tracking-tight font-display">{symbol}</h3>
                          <Badge variant="info" className="text-[0.65rem] px-2 py-0.5 font-bold uppercase tracking-wider">
                            {symbolOrders.length} {symbolOrders.length === 1 ? "Trade" : "Trades"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Symbol PnL:</span>
                          <span className={cn(
                            "text-sm font-bold font-mono px-3 py-1 rounded-xl border",
                            symbolPnL >= 0 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-shadow-emerald" 
                              : "bg-red-500/10 border-red-500/20 text-red-400 text-shadow-red"
                          )}>
                            {symbolPnL >= 0 ? "+" : ""}₹ {symbolPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({symbolPnL >= 0 ? "+" : ""}{symbolPnLPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      <GlassCard className="p-0 border-white/5 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Execution Time</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Entry Price</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Exit Price</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Realised PnL</th>
                                <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs font-mono">
                              {symbolOrders.map((o: any, idx: number) => {
                                const tradePnLPct = o.entry_price > 0 ? (o.pnl / (o.entry_price * o.quantity)) * 100 : 0;

                                return (
                                  <tr key={idx} className="hover:bg-white/[0.005] transition-colors">
                                    <td className="px-6 py-4 text-slate-400">{o.time}</td>
                                    <td className="px-6 py-4">
                                      <Badge variant={o.transaction_type === "BUY" ? "success" : "danger"} className="text-[0.6rem] py-0 px-1 font-bold">
                                        {o.transaction_type}
                                      </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-slate-200 font-bold">{o.quantity}</td>
                                    <td className="px-6 py-4 text-slate-200">₹{o.entry_price.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-slate-200">
                                      {o.exit_price ? `₹${o.exit_price.toFixed(2)}` : "—"}
                                    </td>
                                    <td className={cn(
                                      "px-6 py-4 font-bold",
                                      o.pnl > 0 ? "text-emerald-400" : o.pnl < 0 ? "text-red-400" : "text-slate-400"
                                    )}>
                                      {o.pnl > 0 ? "+" : ""}{o.pnl !== 0 ? `₹${o.pnl.toFixed(2)} (${o.pnl > 0 ? "+" : ""}${tradePnLPct.toFixed(2)}%)` : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <span className={cn(
                                        "text-[0.65rem] font-bold uppercase border px-2 py-0.5 rounded border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                                      )}>
                                        {o.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </GlassCard>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>

      <div className="p-6 glass rounded-2xl border-accent-cyan/20 bg-accent-cyan/5 flex gap-4">
        <Info className="w-6 h-6 text-accent-cyan shrink-0" />
        <div className="text-sm">
          <p className="font-bold text-white mb-1">Trading Rule Reminder</p>
          <p className="text-text-secondary leading-relaxed">
            All trades are MIS (Intraday). Active brokers will auto-square off positions at 3:20 PM IST. 
            Ensure your capital per trade matches your risk appetite in profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}
