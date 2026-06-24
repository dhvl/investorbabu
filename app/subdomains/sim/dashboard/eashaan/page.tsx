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

export default function EashaanSimulationPage() {
  const [settings, setSettings] = useState<any>({
    indian: { capital: 10000, lot_size: 0 },
    us: { capital: 10000, lot_size: 1 },
    crypto: { capital: 0, lot_size: 0.1 }
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedPlan, setSelectedPlan] = useState<string>("basic");

  useEffect(() => {
    async function fetchSimulationData() {
      try {
        const resp = await fetch("/api/eashaan-simulation");
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

    async function fetchSettings() {
      try {
        const res = await fetch("/api/simulation/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        console.error("Failed to fetch settings:", e);
      }
    }

    fetchSimulationData();
    fetchSettings();
    const interval = setInterval(fetchSimulationData, 5000);
    return () => clearInterval(interval);
  }, []);

  const uniqueDatesSet = new Set(orders.map(o => o.date).filter(Boolean));
  uniqueDatesSet.add(todayStr);
  const uniqueDates = Array.from(uniqueDatesSet) as string[];
  uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Adjust orders dynamically based on category settings
  const adjustedOrders = orders.map(o => {
    const isBtc = o.symbol === "BTCUSD";
    const isUs = ["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD"].includes(o.symbol);
    const categorySettings = isBtc ? settings.crypto : (isUs ? settings.us : settings.indian);
    
    const targetLotSize = categorySettings.lot_size;
    const targetCapital = categorySettings.capital;
    
    const entryPrice = o.entry_price || o.buy_entry || 0;
    if (entryPrice <= 0) return o;
    
    let newQty = 0;
    if (targetLotSize > 0) {
      newQty = targetLotSize;
    } else {
      if (isBtc) {
        newQty = parseFloat((targetCapital / entryPrice).toFixed(4));
      } else {
        newQty = Math.max(Math.floor(targetCapital / entryPrice), 1);
      }
    }
    
    const oldQty = o.buy_qty || o.sell_qty || 1;
    const scalingFactor = newQty / oldQty;
    
    return {
      ...o,
      buy_qty: o.buy_qty ? newQty : o.buy_qty,
      sell_qty: o.sell_qty ? newQty : o.sell_qty,
      pnl: o.pnl ? parseFloat((o.pnl * scalingFactor).toFixed(4)) : 0
    };
  });

  // Filter orders by date AND plan
  const filteredOrders = adjustedOrders.filter(o => 
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
            Eashaan Breakout Sim <Badge variant="warning" className="text-[0.6rem] uppercase tracking-widest px-2 py-0.5">Eashaan Rules</Badge>
          </h1>
          <p className="text-slate-400">Simulation engine tracking breakout trades using Eashaan's original 1% SL/Target & Martingale SAR rules.</p>
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

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border bg-amber-500/10 border-amber-500/20">
            <div className="w-2.5 h-2.5 rounded-full pulse-dot bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-amber-500">
              Eashaan Engine Live
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
                <span>Basic Plan (1% Target/SL)</span>
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
                <span>Growth Plan (Trailing SL)</span>
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-400 bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Martingale SAR (2x Size Reversal) Enabled</span>
            </div>
          </div>

          {/* Strategy Details Explanation Box */}
          <GlassCard className="p-5 mb-8 border-white/5 bg-gradient-to-r from-slate-900/60 to-amber-950/15">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              {selectedPlan === "basic" ? (
                <>
                  <Target className="w-4 h-4 text-blue-400" />
                  <span>Eashaan Basic: 1.0% Profit Target & 1.0% Stop-Loss</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span>Eashaan Growth: Trailing Stop-Loss with 1.0% Risk Limit</span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedPlan === "basic"
                ? "This plan places two bracket orders at (High + tick) and (Low - tick). Once a breakout entries triggers: Target is set to +1.0% of entry price and Stop-Loss is set to -1.0% of entry price. If Stop-Loss gets hit, it immediately triggers a Martingale Stop and Reverse (SAR) order on the opposite side with 2x size."
                : "This plan places the same entries, but implements trailing SL logic to ride trends. If a trade reaches high levels, the SL locks in profit. A Stop-Loss breach triggers the same double-size Martingale SAR reversal order on the opposite side."
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Trades Tracked</p>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight font-display mb-1">
                {filteredOrders.length}
              </h3>
              <p className="text-xs text-slate-500">
                {pendingOrders.length} Pending Bracket Orders
              </p>
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-amber-500/10 blur-3xl pointer-events-none" />
            </GlassCard>
          </div>

          {/* Bracket Orders Table Section */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white font-display">Simulated Orders & Active Brackets</h2>
              <span className="text-xs text-slate-500 font-semibold">{filteredOrders.length} records found</span>
            </div>

            {filteredOrders.length === 0 ? (
              <GlassCard className="p-12 text-center border-white/5 bg-white/2">
                <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No simulated trades found for this day.</p>
                <p className="text-xs text-slate-500 mt-1">If this is a live day, wait for TradingView alerts to trigger brackets.</p>
              </GlassCard>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-slate-400">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Instrument</th>
                      <th className="py-4 px-6">Trigger Time</th>
                      <th className="py-4 px-6">Active Leg</th>
                      <th className="py-4 px-6">Entry Price</th>
                      <th className="py-4 px-6">Target (1.0%)</th>
                      <th className="py-4 px-6">Stop Loss (1.0%)</th>
                      <th className="py-4 px-6">Quantity</th>
                      <th className="py-4 px-6">LTP</th>
                      <th className="py-4 px-6 text-right">PnL</th>
                      <th className="py-4 px-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map((order, idx) => {
                      const pnlColor = order.pnl > 0 ? "text-emerald-400" : order.pnl < 0 ? "text-red-400" : "text-slate-400";
                      const isActive = order.status === "ACTIVE";
                      const isTargetHit = order.status === "TARGET HIT";
                      const isSlHit = ["SL HIT", "TRAILING SL HIT"].includes(order.status);
                      const isPending = order.status === "PENDING";
                      const isPendingSar = order.status === "PENDING_SAR";

                      return (
                        <tr key={idx} className={cn("hover:bg-white/2 transition-colors", order.is_sar && "bg-amber-500/5")}>
                          <td className="py-4 px-6 font-bold text-white flex items-center gap-2">
                            {order.symbol}
                            {order.is_sar && (
                              <span className="text-[0.55rem] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded uppercase tracking-wider">SAR Reversal</span>
                            )}
                          </td>
                          <td className="py-4 px-6 font-medium">{order.time || "N/A"}</td>
                          <td className="py-4 px-6">
                            {order.active_leg ? (
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                order.active_leg === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              )}>
                                {order.active_leg}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-semibold">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6 font-mono font-medium">${(order.entry_price || order.buy_entry || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-4 px-6 font-mono text-slate-500">${(order.active_leg === "BUY" ? order.buy_target : (order.active_leg === "SELL" ? order.sell_target : order.buy_target || 0))?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}</td>
                          <td className="py-4 px-6 font-mono text-slate-500">${(order.active_leg === "BUY" ? order.buy_stop_loss : (order.active_leg === "SELL" ? order.sell_stop_loss : order.buy_stop_loss || 0))?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}</td>
                          <td className="py-4 px-6 font-mono font-medium">{order.active_leg === "BUY" ? order.buy_qty : (order.active_leg === "SELL" ? order.sell_qty : order.buy_qty || 0)}</td>
                          <td className="py-4 px-6 font-mono font-medium text-slate-300">${(order.ltp || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className={cn("py-4 px-6 font-mono font-bold text-right", pnlColor)}>
                            {order.pnl > 0 ? "+" : ""}{order.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isActive && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest animate-pulse">Active</span>
                            )}
                            {isTargetHit && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">Target Hit</span>
                            )}
                            {isSlHit && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">Stop Loss</span>
                            )}
                            {isPending && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20 uppercase tracking-widest">Pending</span>
                            )}
                            {isPendingSar && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest animate-pulse">SAR Pending</span>
                            )}
                            {order.status === "SQ OFF" && (
                              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-slate-800 text-slate-400 uppercase tracking-widest">Sq Off</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
