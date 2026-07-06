"use client";

import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { TrendingUp, AlertTriangle, CheckCircle, RefreshCw, BarChart2, Calendar, ShieldCheck, Compass } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export default function ClientHistoryPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");

  async function fetchTrades() {
    setLoading(true);
    try {
      const res = await fetch("/api/trades");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setTrades(json);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrades();
  }, []);

  // Extract and sort unique dates descending
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(trades.map((o: any) => o.date))) as string[];
    return dates.sort((a, b) => {
      try {
        return new Date(b).getTime() - new Date(a).getTime();
      } catch {
        return b.localeCompare(a);
      }
    });
  }, [trades]);

  // Set default selected date once dates are loaded
  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  // Filter trades matching the selected date
  const filteredTrades = useMemo(() => {
    if (!selectedDate) return [];
    return trades.filter((o: any) => o.date === selectedDate);
  }, [trades, selectedDate]);

  // Compute metrics dynamically for the selected date
  const metrics = useMemo(() => {
    const totalTrades = filteredTrades.length;
    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: "0.0%", profitFactor: "N/A", totalPnL: 0 };
    }

    const wins = filteredTrades.filter((o: any) => (o.pnl || 0) > 0).length;
    const winRate = ((wins / totalTrades) * 100).toFixed(1) + "%";

    let totalProfit = 0;
    let totalLoss = 0;
    filteredTrades.forEach((o: any) => {
      const pnl = o.pnl || 0;
      if (pnl > 0) totalProfit += pnl;
      else totalLoss += Math.abs(pnl);
    });

    const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : "N/A";
    const totalPnL = parseFloat((totalProfit - totalLoss).toFixed(2));

    return { totalTrades, winRate, profitFactor, totalPnL };
  }, [filteredTrades]);

  // Compute instrument performance breakdown for the selected date
  const symbolPerformance = useMemo(() => {
    const symbolPerformanceMap: Record<string, { pnl: number; wins: number; total: number; capital: number }> = {};
    
    filteredTrades.forEach((o: any) => {
      const sym = o.stock || o.symbol;
      if (!sym) return;
      if (!symbolPerformanceMap[sym]) {
        symbolPerformanceMap[sym] = { pnl: 0, wins: 0, total: 0, capital: 0 };
      }
      symbolPerformanceMap[sym].pnl += (o.pnl || 0);
      symbolPerformanceMap[sym].capital += (o.capital || (o.entry_price * o.quantity) || 0);
      symbolPerformanceMap[sym].total += 1;
      if ((o.pnl || 0) > 0) {
        symbolPerformanceMap[sym].wins += 1;
      }
    });

    return Object.entries(symbolPerformanceMap).map(([symbol, stats]) => {
      const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) + "%" : "0%";
      const returnPct = stats.capital > 0 ? ((stats.pnl / stats.capital) * 100).toFixed(2) + "%" : "0.00%";
      return {
        symbol,
        pnl: parseFloat(stats.pnl.toFixed(2)),
        winRate,
        returnPct,
        tradesCount: stats.total
      };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Trade History & Audit</h1>
          <p className="text-text-secondary text-sm">Review your historical live execution logs and daily performance metrics.</p>
        </div>
        
        {/* Date Selector Dropdown */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white shrink-0 self-start md:self-auto">
          <Calendar className="w-4 h-4 text-blue-400" />
          <select 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer pr-4"
          >
            {uniqueDates.length === 0 ? (
              <option value="" disabled className="bg-slate-900 text-slate-400">No dates available</option>
            ) : (
              uniqueDates.map(d => {
                // Parse YYYY-MM-DD
                const parts = d.split('-');
                const formatted = parts.length === 3 ? `${parts[2]} / ${parts[1]} / ${parts[0]}` : d;
                return (
                  <option key={d} value={d} className="bg-slate-900 text-white">
                    {formatted} {d === uniqueDates[0] ? "(Latest)" : ""}
                  </option>
                );
              })
            )}
          </select>
          <button 
            onClick={fetchTrades}
            disabled={loading}
            className="text-slate-400 hover:text-white transition-colors pl-2 border-l border-white/10"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-text-secondary">Loading trade database...</p>
        </div>
      ) : uniqueDates.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No Trades Recorded</h3>
          <p className="text-sm text-text-secondary">Historical logs will appear here once your account records live order fills.</p>
        </GlassCard>
      ) : (
        <>
          {/* Daily Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard className="p-6">
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Total Executed Trades</p>
              <h3 className="text-2xl font-bold font-mono text-white">{metrics.totalTrades}</h3>
              <p className="text-[10px] text-text-secondary mt-1">Leg executions today</p>
            </GlassCard>
            
            <GlassCard className="p-6">
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Win Rate</p>
              <h3 className="text-2xl font-bold font-mono text-blue-400">{metrics.winRate}</h3>
              <p className="text-[10px] text-text-secondary mt-1">Percentage profitable trades</p>
            </GlassCard>

            <GlassCard className="p-6">
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Profit Factor</p>
              <h3 className="text-2xl font-bold font-mono text-white">{metrics.profitFactor}</h3>
              <p className="text-[10px] text-text-secondary mt-1">Ratio gross profit to loss</p>
            </GlassCard>

            <GlassCard className="p-6">
              <p className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Realised P&L</p>
              <h3 className={cn(
                "text-2xl font-bold font-mono",
                metrics.totalPnL > 0 ? "text-emerald-400" : metrics.totalPnL < 0 ? "text-red-400" : "text-white"
              )}>
                ₹{metrics.totalPnL > 0 ? "+" : ""}{metrics.totalPnL.toFixed(2)}
              </h3>
              <p className="text-[10px] text-text-secondary mt-1">Net outcome for the day</p>
            </GlassCard>
          </div>

          {/* Symbol Breakdown Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white font-display">Symbol Performance</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {symbolPerformance.map(p => (
                <GlassCard key={p.symbol} className="p-5 border-white/5 bg-slate-900/40 relative overflow-hidden group">
                  <div className={cn(
                    "absolute top-0 left-0 w-1 h-full",
                    p.pnl > 0 ? "bg-emerald-500" : p.pnl < 0 ? "bg-red-500" : "bg-slate-500"
                  )} />
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-base font-bold text-white tracking-wide">#{p.symbol}</h4>
                      <p className="text-[10px] text-text-secondary">{p.tradesCount} executions</p>
                    </div>
                    <span className={cn(
                      "text-xs font-bold font-mono px-2 py-0.5 rounded",
                      p.pnl > 0 ? "bg-emerald-500/10 text-emerald-400" : p.pnl < 0 ? "bg-red-500/10 text-red-400" : "bg-slate-500/10 text-slate-400"
                    )}>
                      ₹{p.pnl > 0 ? "+" : ""}{p.pnl.toFixed(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs text-text-secondary">
                    <div>
                      <span>Win Rate: </span>
                      <span className="font-bold text-white">{p.winRate}</span>
                    </div>
                    <div className="text-right">
                      <span>Return: </span>
                      <span className={cn("font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{p.returnPct}</span>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Detailed Audit Table */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white font-display">Execution Logs</h3>
            </div>
            
            <GlassCard className="p-0 border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Execution Time</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Entry Price</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Exit Price</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Realised PnL</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-mono">
                    {filteredTrades.map((o: any, idx: number) => {
                      const tradePnLPct = o.entry_price > 0 ? (o.pnl / (o.entry_price * o.quantity)) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.005] transition-colors">
                          <td className="px-6 py-4 text-slate-400">{o.time}</td>
                          <td className="px-6 py-4 text-slate-300 font-bold">#{o.stock || o.symbol}</td>
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
                              "text-[0.65rem] font-bold uppercase border px-2 py-0.5 rounded",
                              o.pnl > 0 
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
                                : o.pnl < 0 
                                  ? "border-red-500/20 bg-red-500/5 text-red-400" 
                                  : "border-slate-500/20 bg-slate-500/5 text-slate-400"
                            )}>
                              {o.status || "COMPLETE"}
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
        </>
      )}
    </div>
  );
}
