"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import Badge from "@/components/ui/Badge";
import { Download, Calendar, ArrowUpRight, ArrowDownRight, Filter, Search, TrendingUp, TrendingDown, Receipt, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export default function TradesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const data = await api.trades.list();
        setTrades(data);
        
        // Find most recent date
        const dates = Array.from(new Set(data.map((t: any) => t.date))) as string[];
        if (dates.length > 0) {
          dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          setSelectedDate(dates[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrades();
  }, []);

  const uniqueDates = Array.from(new Set(trades.map(t => t.date))) as string[];
  uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const filteredTrades = trades.filter(t => {
    const matchesDate = !selectedDate || t.date === selectedDate;
    const matchesSearch = !search || t.stock.toLowerCase().includes(search.toLowerCase());
    return matchesDate && matchesSearch;
  });

  // Group trades by instrument
  const groupedTrades = filteredTrades.reduce((acc, trade) => {
    if (!acc[trade.stock]) {
      acc[trade.stock] = {
        name: trade.stock,
        trades: [],
        totalPnL: 0,
        totalCapital: 0,
        isVerified: false
      };
    }
    acc[trade.stock].trades.push(trade);
    acc[trade.stock].totalPnL += trade.pnl;
    acc[trade.stock].totalCapital = Math.max(acc[trade.stock].totalCapital, trade.capital);
    if (trade.verified) acc[trade.stock].isVerified = true;
    return acc;
  }, {} as Record<string, any>);

  const instrumentNames = Object.keys(groupedTrades);
  
  const totalPnL: number = (filteredTrades as any[]).reduce((acc: number, t: any) => acc + (t.pnl || 0), 0);
  const totalCapital: number = (Object.values(groupedTrades) as any[]).reduce((acc: number, g: any) => acc + (g.totalCapital || 0), 0);
  const winRate: number = filteredTrades.length > 0 
    ? ((filteredTrades as any[]).filter((t: any) => t.pnl > 0).length / filteredTrades.length) * 100 
    : 0;

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">Trade History</h1>
          <p className="text-slate-400">Broker-reconciled logs for active instruments.</p>
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter stock..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
            />
          </div>
          
          <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:bg-white/10 transition-all">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Net P&L" 
          value={totalPnL} 
          prefix="₹" 
          suffix=""
        />
        <StatCard 
          label="Win Rate" 
          value={winRate} 
          suffix="%"
        />
        <StatCard 
          label="Utilized Capital" 
          value={totalCapital} 
          prefix="₹"
        />
        <StatCard 
          label="Trades / ROI" 
          value={`${filteredTrades.length} / ${totalCapital > 0 ? ((totalPnL / totalCapital) * 100).toFixed(2) : "0.00"}%`} 
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : instrumentNames.length === 0 ? (
        <GlassCard className="py-20 text-center text-slate-500">
          <div className="flex flex-col items-center gap-3">
            <Receipt className="w-10 h-10 opacity-20 text-blue-400" />
            <p className="text-sm font-medium">No reconciled trades for this period.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instrumentNames.map((name) => {
            const group = groupedTrades[name];
            const isZeroTrade = group.trades.every((t: any) => t.side === "ZERO_TRADES");
            const pnlColor = isZeroTrade ? "text-slate-400" : group.totalPnL >= 0 ? "text-emerald-400" : "text-red-400";
            const pnlBg = isZeroTrade ? "bg-slate-500/10" : group.totalPnL >= 0 ? "bg-emerald-500/10" : "bg-red-500/10";

            return (
              <GlassCard key={name} className="p-0 flex flex-col overflow-hidden group hover:scale-[1.01] transition-all duration-300 border-white/5">
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight font-display">{name}</h3>
                        {group.isVerified && (
                           <div className="group/v relative">
                              <ShieldCheck className="w-4 h-4 text-blue-400" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-blue-600 text-[0.6rem] text-white rounded opacity-0 group-hover/v:opacity-100 transition-opacity whitespace-nowrap z-20">
                                Verified by Zerodha
                              </div>
                           </div>
                        )}
                      </div>
                      <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-wider">
                        {isZeroTrade ? "Monitoring Active" : `${group.trades.length} Executions`}
                      </span>
                    </div>
                    
                    <div className={cn("px-3 py-1.5 rounded-xl flex flex-col items-end", pnlBg)}>
                      <span className={cn("text-lg font-bold font-mono", pnlColor)}>
                        {isZeroTrade ? "0.00" : (group.totalPnL >= 0 ? "+" : "-") + "₹" + Math.abs(group.totalPnL).toLocaleString()}
                      </span>
                      <span className="text-[0.5rem] font-bold text-slate-500 uppercase">{isZeroTrade ? "No Trades" : "Total P&L"}</span>
                    </div>
                  </div>

                  {!isZeroTrade ? (
                    <div className="flex justify-between items-center text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.1em]">
                      <span>Capital: ₹{group.totalCapital.toLocaleString()}</span>
                      <span className={pnlColor}>
                        {((group.totalPnL / (group.totalCapital || 1)) * 100).toFixed(2)}% ROI
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                       <span className="text-[0.55rem] font-bold text-slate-600 uppercase tracking-wider">Analysis Result</span>
                       <p className="text-xs text-slate-400 font-medium italic">
                         {group.trades[0]?.reason || "Scanning for pattern..."}
                       </p>
                    </div>
                  )}
                </div>

                {/* List of executions - only show if not zero trade */}
                {!isZeroTrade && (
                  <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                    {group.trades.map((t: any, idx: number) => (
                      <div 
                        key={t.id} 
                        className={cn(
                          "p-4 flex flex-col gap-2 transition-colors",
                          idx !== group.trades.length - 1 && "border-b border-white/5",
                          "hover:bg-white/5"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Badge variant={t.side.includes("BUY") ? "buy" : "sell"} className="text-[0.6rem] px-1.5 py-0">
                            {t.side}
                          </Badge>
                          <span className="text-[0.6rem] font-mono text-slate-500">{t.date}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <span className="text-[0.55rem] font-bold text-slate-600 uppercase">Entry</span>
                            <span className="text-xs font-mono text-slate-300">₹{t.entry.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[0.55rem] font-bold text-slate-600 uppercase">Exit</span>
                            <span className="text-xs font-mono text-slate-300">₹{t.exit.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <div className="flex items-center gap-1.5">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              t.pnl >= 0 ? "bg-emerald-500" : "bg-red-500"
                            )} />
                            <span className="text-[0.6rem] font-bold text-slate-400">Qty: {t.qty}</span>
                          </div>
                          <span className={cn(
                            "text-xs font-bold font-mono",
                            t.pnl >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {t.pnl >= 0 ? "+" : "-"}₹{Math.abs(t.pnl).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
