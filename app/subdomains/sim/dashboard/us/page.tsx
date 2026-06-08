"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ShieldAlert, 
  Clock, 
  Coins, 
  BarChart3,
  HelpCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function UsSimulationPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedPlan, setSelectedPlan] = useState<string>("basic");

  useEffect(() => {
    async function fetchSimulationData() {
      try {
        const resp = await fetch("/api/us-simulation");
        const data = await resp.json();
        if (Array.isArray(data)) {
          setOrders(data);
        }
      } catch (err) {
        console.error("Failed to fetch simulation data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSimulationData();
    const interval = setInterval(fetchSimulationData, 5000);
    return () => clearInterval(interval);
  }, []);

  const uniqueDatesSet = new Set(orders.map(o => o.date).filter(Boolean));
  uniqueDatesSet.add(todayStr);
  const uniqueDates = Array.from(uniqueDatesSet) as string[];
  uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Filter orders by date AND plan
  const filteredOrders = orders.filter(o => 
    (!selectedDate || o.date === selectedDate) && 
    (o.plan === selectedPlan)
  );

  // Compute stats
  const activePositions = filteredOrders.filter(o => o.status === "ACTIVE");
  const completedPositions = filteredOrders.filter(o => ["TARGET HIT", "SL HIT", "SQ OFF", "TRAILING SL HIT"].includes(o.status));
  const pendingOrders = filteredOrders.filter(o => o.status === "PENDING");
  
  const totalPnL = filteredOrders.reduce((acc, o) => acc + (o.pnl || 0), 0);
  const targetHits = filteredOrders.filter(o => o.status === "TARGET HIT").length;
  const slHits = filteredOrders.filter(o => ["SL HIT", "TRAILING SL HIT"].includes(o.status) && (o.pnl || 0) <= 0).length;
  
  const winRate = completedPositions.length > 0 
    ? (completedPositions.filter(o => (o.pnl || 0) > 0).length / completedPositions.length) * 100 
    : 0;

  // Compute peak capital per symbol
  const capitalBySymbol = filteredOrders.reduce((acc, o) => {
    const qty = o.active_leg === "BUY" ? o.buy_qty : (o.active_leg === "SELL" ? o.sell_qty : Math.max(o.buy_qty || 0, o.sell_qty || 0));
    const price = o.entry_price || o.buy_entry || 0; 
    const cap = price * qty;
    if (!acc[o.symbol] || cap > acc[o.symbol]) {
      acc[o.symbol] = cap;
    }
    return acc;
  }, {} as Record<string, number>);

  const peakTotalCapital = Object.values(capitalBySymbol).reduce((a, b) => a + b, 0);
  const overallRoi = peakTotalCapital > 0 ? (totalPnL / peakTotalCapital) * 100 : 0;

  const totalCapitalUsed = activePositions.reduce((acc, o) => {
    const qty = o.active_leg === "BUY" ? o.buy_qty : o.sell_qty;
    return acc + ((o.entry_price || 0) * qty);
  }, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2 flex items-center gap-3">
            US Commodities Simulation <Badge variant="info" className="text-[0.6rem] uppercase tracking-widest px-2 py-0.5">Paper-Trading</Badge>
          </h1>
          <p className="text-slate-400">Real-time simulated dry-run execution tracker and bracket progress.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date:</span>
            <select 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[150px] appearance-none cursor-pointer"
            >
              <option value="">All History</option>
              {uniqueDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border bg-blue-500/10 border-blue-500/20">
            <div className="w-2.5 h-2.5 rounded-full pulse-dot bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-blue-400">
              Paper Engine Online (LTP 10s)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Plan Selector & Description Row */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-8">
            <div className="flex bg-slate-950/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner">
              <button
                onClick={() => setSelectedPlan("basic")}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2",
                  selectedPlan === "basic"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Target className="w-4 h-4" />
                <span>Basic Plan (1% Lock)</span>
              </button>
              <button
                onClick={() => setSelectedPlan("growth")}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2",
                  selectedPlan === "growth"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_4px_12px_rgba(168,85,247,0.3)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Growth Plan (Pro Trail)</span>
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-400 bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Strategies 2 & 3 Integrated Perfectly</span>
            </div>
          </div>

          {/* Strategy Details Explanation Box */}
          <GlassCard className="p-5 mb-8 border-white/5 bg-gradient-to-r from-slate-900/60 to-purple-950/20">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              {selectedPlan === "basic" ? (
                <>
                  <Target className="w-4 h-4 text-blue-400" />
                  <span>BlueCandle Basic: 1.0% Locked Bracket Simulation</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span>BlueCandle Growth: Uncapped Trend-Riding Simulation</span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedPlan === "basic"
                ? "This plan deploys Strategy 2 (Completed 15m candle-extreme trailing stop-loss) in tandem with Strategy 3 (Progressive Breakeven Locks). Once entry triggers: SL moves to Breakeven at +0.4% gain, locks in +0.4% profit at +0.7% gain, and automatically exits at a hard cap target of +1.0%."
                : "This plan runs the exact same trailing SL logic and progressive risk-free lock-ins, but removes the target cap entirely. At +1.0%, the SL locks +0.7% profit. Beyond that, the SL trails at a maximum distance of 0.3% from the peak price, capturing massive breakouts."
              }
            </p>
          </GlassCard>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <GlassCard className="relative overflow-hidden p-6 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Simulation P&L</p>
                <div className={cn(
                  "p-2 rounded-lg",
                  totalPnL >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}>
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <h3 className={cn(
                "text-3xl font-bold tracking-tight font-display mb-1",
                totalPnL >= 0 ? "text-emerald-400 text-shadow-emerald" : "text-red-400 text-shadow-red"
              )}>
                ${totalPnL >= 0 ? "+" : ""}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Est. ROI: <span className={overallRoi >= 0 ? "text-emerald-400" : "text-red-400"}>{overallRoi.toFixed(2)}%</span> | Capital: ${Math.round(peakTotalCapital).toLocaleString()}
              </p>
              <div className={cn(
                "absolute -bottom-12 -left-12 w-24 h-24 blur-3xl opacity-20 pointer-events-none",
                totalPnL >= 0 ? "bg-emerald-500" : "bg-red-500"
              )} />
            </GlassCard>

            <GlassCard className="relative overflow-hidden p-6 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Positions</p>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight font-display mb-1">
                {activePositions.length} <span className="text-sm font-medium text-slate-500">running</span>
              </h3>
              <p className="text-xs text-slate-500">Est. Margin Allocated: ${totalCapitalUsed.toLocaleString()}</p>
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-blue-500/10 blur-3xl pointer-events-none" />
            </GlassCard>

            <GlassCard className="relative overflow-hidden p-6 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hit/Win Rate</p>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight font-display mb-1">
                {winRate.toFixed(1)}%
              </h3>
              <p className="text-xs text-slate-500">
                {targetHits} Wins | {slHits} Losses ({completedPositions.length} Closed)
              </p>
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-purple-500/10 blur-3xl pointer-events-none" />
            </GlassCard>

            <GlassCard className="relative overflow-hidden p-6 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Breakouts</p>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight font-display mb-1">
                {pendingOrders.length} <span className="text-sm font-medium text-slate-500">waiting</span>
              </h3>
              <p className="text-xs text-slate-500">Monitoring high/low brackets</p>
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-amber-500/10 blur-3xl pointer-events-none" />
            </GlassCard>
          </div>

          {/* Active Positions Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 font-display flex items-center gap-2">
              Active Positions <span className="text-xs text-slate-500 font-normal">({activePositions.length})</span>
            </h2>
            
            {activePositions.length === 0 ? (
              <GlassCard className="py-12 text-center text-slate-500 border-white/5 bg-white/[0.01]">
                <Activity className="w-8 h-8 opacity-20 text-blue-400 mb-2 mx-auto" />
                <p className="text-sm font-medium">No running breakout positions currently.</p>
                <p className="text-xs text-slate-600">Active positions spawn when a pending order crosses its buy or sell trigger.</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activePositions.map((pos) => {
                  const isBuy = pos.active_leg === "BUY";
                  const pnl = pos.pnl || 0;
                  const qty = isBuy ? pos.buy_qty : pos.sell_qty;
                  const entry = pos.entry_price;
                  const ltp = pos.ltp;
                  const target = isBuy ? pos.buy_target : pos.sell_target;
                  const stop = isBuy ? pos.buy_stop_loss : pos.sell_stop_loss;

                  const hasTarget = target !== null && target !== undefined;

                  // Distance bar math
                  // percentage of current price between SL and Target
                  const range = hasTarget ? Math.abs(target - stop) : 0;
                  const dist = isBuy ? (ltp - stop) : (stop - ltp);
                  const pct = hasTarget ? Math.min(Math.max((dist / range) * 100, 0), 100) : (pnl >= 0 ? 100 : 0);

                  return (
                    <GlassCard key={pos.symbol + pos.time} className="p-6 border-white/5 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Time: {pos.time}</span>
                          <h3 className="text-2xl font-bold text-white font-display flex items-center gap-2">
                            {pos.symbol}
                            <Badge variant={isBuy ? "success" : "danger"} className="text-[0.55rem] font-bold px-1.5 py-0">
                              {pos.active_leg} (x{qty})
                            </Badge>
                          </h3>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Live PnL</span>
                          <span className={cn(
                            "text-xl font-bold font-mono tracking-tight",
                            pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            ${pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* LTP vs Entry Price */}
                      <div className="grid grid-cols-3 gap-4 p-3 bg-white/5 rounded-xl mb-4 border border-white/5">
                        <div>
                          <span className="text-[0.6rem] font-bold text-slate-500 uppercase block">Entry Price</span>
                          <span className="text-sm font-bold font-mono text-slate-300">${entry.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[0.6rem] font-bold text-slate-500 uppercase block">Last Price (LTP)</span>
                          <span className="text-sm font-bold font-mono text-white pulse-glow">${ltp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[0.6rem] font-bold text-slate-500 uppercase block">Net Dist</span>
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {pnl >= 0 ? "+" : ""}{((ltp - entry)/entry * 100 * (isBuy ? 1 : -1)).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Target & SL visual tracker */}
                      <div className="mb-2">
                        <div className="flex justify-between text-[0.65rem] font-bold text-slate-400 mb-1">
                          <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="w-3 h-3" /> SL: {stop.toLocaleString()}</span>
                          {hasTarget ? (
                            <span className="flex items-center gap-1 text-emerald-400"><Target className="w-3 h-3" /> Target: {target.toLocaleString()}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-400"><Target className="w-3 h-3" /> Trailing (Peak SL)</span>
                          )}
                        </div>
                        
                        {/* Progress Bar Container */}
                        {hasTarget ? (
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pnl >= 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                              )} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        ) : (
                          <div className="w-full h-2 bg-emerald-500/10 rounded-full overflow-hidden border border-emerald-500/20 relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 w-[200%] animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[0.6rem] text-slate-500">
                        <span>SL distance: {Math.abs(ltp - stop).toFixed(2)} pts</span>
                        <span>{hasTarget ? `Target distance: ${Math.abs(target - ltp).toFixed(2)} pts` : 'Target: Infinity 🚀'}</span>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full Simulated Order Book Section */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 font-display flex items-center gap-2">
              Simulation Order Book <span className="text-xs text-slate-500 font-normal">({filteredOrders.length} orders total)</span>
            </h2>

            <GlassCard className="p-0 border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Det. Time</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Trade Time</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Trigger Leg</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Buy Bracket (Entry/Tgt/SL)</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Sell Bracket (Entry/Tgt/SL)</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">LTP</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Sim P&L</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500 text-sm">
                          No simulated records found for this period. Waiting for TradingView signals...
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o, idx) => {
                        const statusColors: Record<string, string> = {
                          "PENDING": "text-amber-400 border-amber-500/20 bg-amber-500/5",
                          "ACTIVE": "text-blue-400 border-blue-500/20 bg-blue-500/5",
                          "TARGET HIT": "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
                          "SL HIT": "text-red-400 border-red-500/20 bg-red-500/5",
                          "TRAILING SL HIT": "text-orange-400 border-orange-500/20 bg-orange-500/5",
                          "SQ OFF": "text-purple-400 border-purple-500/20 bg-purple-500/5"
                        };

                        return (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors font-mono">
                            <td className="px-6 py-4 font-bold text-white font-display text-sm">{o.symbol}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{o.time}</td>
                            <td className="px-6 py-4 text-xs text-slate-300 font-bold">
                              {o.entry_time ? (
                                o.entry_time.includes("T") 
                                  ? o.entry_time.split("T")[1].slice(0, 5) 
                                  : o.entry_time.slice(0, 5)
                              ) : (
                                <span className="text-slate-600 font-normal">Pending</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs">
                              {o.active_leg ? (
                                <Badge variant={o.active_leg === "BUY" ? "success" : "danger"} className="text-[0.6rem] py-0 px-1">
                                  {o.active_leg} (x{o.active_leg === "BUY" ? o.buy_qty : o.sell_qty})
                                </Badge>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {o.is_sar && o.active_leg === "SELL" ? (
                                <span className="text-slate-600">—</span>
                              ) : (
                                <>
                                  <span className="text-slate-200">{o.buy_entry.toFixed(1)}</span>
                                  <span className="text-slate-500 mx-1">/</span>
                                  <span className="text-emerald-500/80">{o.buy_target !== null && o.buy_target !== undefined ? o.buy_target.toFixed(1) : '∞'}</span>
                                  <span className="text-slate-500 mx-1">/</span>
                                  <span className="text-red-500/80">{o.buy_stop_loss.toFixed(1)}</span>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {o.is_sar && o.active_leg === "BUY" ? (
                                <span className="text-slate-600">—</span>
                              ) : (
                                <>
                                  <span className="text-slate-200">{o.sell_entry.toFixed(1)}</span>
                                  <span className="text-slate-500 mx-1">/</span>
                                  <span className="text-emerald-500/80">{o.sell_target !== null && o.sell_target !== undefined ? o.sell_target.toFixed(1) : '∞'}</span>
                                  <span className="text-slate-500 mx-1">/</span>
                                  <span className="text-red-500/80">{o.sell_stop_loss.toFixed(1)}</span>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-white">${o.ltp.toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                            <td className={cn(
                              "px-6 py-4 text-xs font-bold",
                              o.pnl > 0 ? "text-emerald-400" : o.pnl < 0 ? "text-red-400" : "text-slate-400"
                            )}>
                              {o.pnl > 0 ? "+" : ""}{o.pnl !== 0 ? `$${o.pnl.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={cn(
                                "text-[0.65rem] font-bold uppercase border px-2 py-0.5 rounded",
                                statusColors[o.status] || "text-slate-400 border-white/5"
                              )}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
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
