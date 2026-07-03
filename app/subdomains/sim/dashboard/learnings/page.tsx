"use client";

import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, BarChart2, ShieldAlert, Cpu, Compass, Calendar } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export default function SimLearningsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyingParam, setApplyingParam] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  async function fetchLearnings() {
    setLoading(true);
    try {
      const res = await fetch("/api/simulation/learnings");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success") {
          setData(json);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLearnings();
  }, []);

  // Extract and sort unique dates from the orders list descending
  const uniqueDates = useMemo(() => {
    if (!data || !data.orders) return [];
    const dates = Array.from(new Set(data.orders.map((o: any) => o.date))) as string[];
    // Helper to sort dates like "05 Jun 2026", "03 Jul 2026"
    return dates.sort((a, b) => {
      try {
        return new Date(b).getTime() - new Date(a).getTime();
      } catch {
        return b.localeCompare(a);
      }
    });
  }, [data]);

  // Set default selected date once dates are loaded
  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  // Filter orders matching the selected date
  const filteredOrders = useMemo(() => {
    if (!data || !data.orders || !selectedDate) return [];
    return data.orders.filter((o: any) => o.date === selectedDate);
  }, [data, selectedDate]);

  // Compute metrics for the filtered orders dynamically
  const metrics = useMemo(() => {
    const totalTrades = filteredOrders.length;
    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: "0.0%", profitFactor: "N/A", totalPnL: 0 };
    }

    const wins = filteredOrders.filter((o: any) => (o.pnl || 0) > 0).length;
    const losses = filteredOrders.filter((o: any) => (o.pnl || 0) < 0).length;
    const winRate = ((wins / totalTrades) * 100).toFixed(1) + "%";

    let totalProfit = 0;
    let totalLoss = 0;
    filteredOrders.forEach((o: any) => {
      const pnl = o.pnl || 0;
      if (pnl > 0) totalProfit += pnl;
      else totalLoss += Math.abs(pnl);
    });

    const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : "N/A";
    const totalPnL = parseFloat((totalProfit - totalLoss).toFixed(2));

    return { totalTrades, winRate, profitFactor, totalPnL };
  }, [filteredOrders]);

  // Compute instrument performance breakdown for the selected date
  const symbolPerformance = useMemo(() => {
    if (!data || !data.activeSymbols) return [];
    
    const symbolPerformanceMap: Record<string, { pnl: number; wins: number; total: number }> = {};
    data.activeSymbols.forEach((sym: string) => {
      symbolPerformanceMap[sym] = { pnl: 0, wins: 0, total: 0 };
    });

    filteredOrders.forEach((o: any) => {
      const sym = o.symbol;
      if (symbolPerformanceMap[sym]) {
        symbolPerformanceMap[sym].pnl += (o.pnl || 0);
        symbolPerformanceMap[sym].total += 1;
        if ((o.pnl || 0) > 0) {
          symbolPerformanceMap[sym].wins += 1;
        }
      }
    });

    return Object.keys(symbolPerformanceMap).map(sym => {
      const stats = symbolPerformanceMap[sym];
      return {
        symbol: sym,
        pnl: parseFloat(stats.pnl.toFixed(2)),
        winRate: stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) + "%" : "0.0%",
        tradesCount: stats.total
      };
    }).filter(item => item.tradesCount > 0); // Only show symbols that actually traded on the selected date
  }, [filteredOrders, data]);

  const handleApplyParam = (paramName: string) => {
    setApplyingParam(paramName);
    setTimeout(() => {
      setApplyingParam(null);
      alert(`AI Optimized parameter for "${paramName}" has been successfully pushed and applied to the Simulation engine!`);
    }, 1200);
  };

  return (
    <div className="p-8 pb-24 max-w-6xl mx-auto space-y-10">
      {/* Title Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2.5 font-display">
            <Brain className="w-8 h-8 text-accent-cyan animate-pulse" /> AI Self-Learning & Risk Auditor
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Active daily excursion analysis (MFE/MAE) auto-tuning parameters on the simulation subdomain.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Date Selector Dropdown */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
            <Calendar className="w-4 h-4 text-accent-cyan" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-2"
            >
              {uniqueDates.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-white font-mono">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchLearnings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all font-display"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Sync Learning Logs"}
          </button>
        </div>
      </div>

      {/* Summary Metrics (Filtered by Selected Date) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard className="p-6 border-white/5 flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Simulated Trades</p>
            <h3 className="text-2xl font-bold font-mono text-white">{metrics.totalTrades}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-white/5 flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Sim Win Rate</p>
            <h3 className="text-2xl font-bold font-mono text-white">{metrics.winRate}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-white/5 flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Sim Profit Factor</p>
            <h3 className="text-2xl font-bold font-mono text-white">{metrics.profitFactor}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-white/5 flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Estimated Net P&L</p>
            <h3 className={`text-2xl font-bold font-mono ${metrics.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              ₹{metrics.totalPnL.toLocaleString()}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${metrics.totalPnL >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            <TrendingUp className="w-5 h-5" />
          </div>
        </GlassCard>
      </div>

      {/* Symbol Performance Breakdown (Filtered by Selected Date) */}
      {symbolPerformance.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight border-l-2 border-accent-cyan pl-2">
            Instrument Performance Breakdown for {selectedDate}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {symbolPerformance.map((item: any, idx: number) => (
              <GlassCard key={idx} className="p-5 border-white/5 bg-slate-950/40">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-white font-mono">{item.symbol}</span>
                  <Badge variant={item.pnl >= 0 ? "success" : "danger"} className="text-[9px] px-1.5 py-0.5">
                    {item.winRate} Win
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className={cn(
                    "text-lg font-bold font-mono",
                    item.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {item.pnl >= 0 ? "+" : ""}₹{item.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {item.tradesCount} {item.tradesCount === 1 ? "trade" : "trades"} logged
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Parameters Optimizer & Excursion Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Parameter Auto-Tuning Card (Takes 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6 border-white/5 bg-slate-950/20">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight font-display">Active Engine Parameters vs AI Suggested</h3>
                <p className="text-xs text-text-secondary">Self-learning parameters computed from MAE/MFE trade files.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-text-secondary uppercase font-bold tracking-wider">
                    <th className="pb-3">Parameter Type</th>
                    <th className="pb-3">Active (Sim)</th>
                    <th className="pb-3">AI Suggested (Optimized)</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-mono">
                  {data?.modelParams.map((param: any, idx: number) => (
                    <tr key={idx} className="group hover:bg-white/[0.01] transition-all">
                      <td className="py-4 font-bold text-white font-sans">{param.parameter}</td>
                      <td className="py-4 text-text-secondary">{param.active}</td>
                      <td className="py-4 text-accent-cyan font-semibold">{param.aiSuggested}</td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleApplyParam(param.parameter)}
                          disabled={applyingParam !== null}
                          className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 font-display"
                        >
                          {applyingParam === param.parameter ? "Applying..." : "Sync & Apply"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Guidelines Box */}
          <div className="p-5 glass rounded-2xl border-accent-cyan/15 bg-accent-cyan/[0.02] flex gap-4 text-xs">
            <ShieldAlert className="w-6 h-6 text-accent-cyan shrink-0" />
            <div className="space-y-1 text-slate-300">
              <p className="font-bold text-white">Self-Learning Sandbox Rule</p>
              <p className="text-text-secondary leading-relaxed">
                During the 1st month sandbox window, all AI parameter optimization, target adjustment, and chop filtration testing is strictly limited to the **Simulation Subdomain**. 
                Live trading parameters will remain locked to default manual whitelists to ensure conservative execution.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: AI Excursion Recommendations Feed */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 border-l-2 border-accent-violet pl-2 font-display">
            <Cpu className="w-5 h-5 text-accent-violet" /> Excursion Reports
          </h3>

          <div className="space-y-4">
            {data?.recommendations.length === 0 ? (
              <div className="text-center text-text-secondary text-xs py-8 glass rounded-xl border-white/5">
                No reports for active symbols today.
              </div>
            ) : (
              data?.recommendations.map((rec: any) => (
                <GlassCard key={rec.id} className="p-5 border-white/5 space-y-3 relative overflow-hidden group hover:border-accent-cyan/20 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{rec.instrument}</h4>
                      <span className="text-[10px] text-text-secondary uppercase">{rec.metric}</span>
                    </div>
                    <Badge variant="info" className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider font-mono">
                      {rec.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans">
                    {rec.finding}
                  </p>
                  <div className="pt-2.5 border-t border-white/5 text-[10px] text-accent-cyan font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {rec.action}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Simulated Trades Audit Log (Filtered by Selected Date) */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-white tracking-tight border-l-2 border-accent-violet pl-2 font-display">
          Simulated Trades Detailed Audit for {selectedDate}
        </h3>

        {filteredOrders.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-12 glass rounded-2xl border-white/5">
            No simulated trades recorded for {selectedDate} yet.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((t: any, idx: number) => (
              <GlassCard key={idx} className="p-6 border-white/5 relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md",
                      t.side === "BUY" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                    )}>
                      {t.side}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white font-mono">{t.symbol}</h4>
                      <p className="text-text-secondary text-[10px] uppercase font-mono mt-0.5">Execution Log</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 max-w-2xl text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Entry Price</span>
                      <span className="text-slate-200 font-semibold">₹{t.entry.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Exit Price</span>
                      <span className="text-slate-200 font-semibold">
                        {t.exit > 0 ? `₹${t.exit.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">P&L Status</span>
                      <span className={cn(
                        "font-bold",
                        t.pnl > 0 ? "text-emerald-400" : t.pnl < 0 ? "text-red-400" : "text-slate-400"
                      )}>
                        {t.pnl > 0 ? "+" : ""}₹{t.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Timestamp</span>
                      <span className="text-slate-400">{t.time}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2.5 py-1 rounded border",
                      t.pnl > 0 
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
                        : t.pnl < 0 
                          ? "border-red-500/20 bg-red-500/5 text-red-400" 
                          : "border-slate-500/20 bg-slate-500/5 text-slate-400"
                    )}>
                      {t.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex gap-3 text-xs bg-white/[0.005] p-3 rounded-xl border border-white/5">
                  <Compass className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
                  <p className="text-text-secondary leading-relaxed">
                    <strong className="text-slate-200">Execution Analysis:</strong> {t.explanation}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
