"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Bell, Zap, Info, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_SIGNALS = [
  { id: 1, time: "11:45 AM", stock: "POLYCAB", entry: 6200.00, sl: 6185.00, target: 6262.00, type: "BUY", status: "Active" },
  { id: 2, time: "10:30 AM", stock: "HAVELLS", entry: 1535.00, sl: 1540.20, target: 1519.65, type: "SELL", status: "Target Hit" },
  { id: 3, time: "09:15 AM", stock: "TATASTEEL", entry: 165.40, sl: 164.10, target: 167.05, type: "BUY", status: "Target Hit" },
];

export default function ClientDashboard() {
  const [funds, setFunds] = useState<any>(null);

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
    loadFunds();
    const interval = setInterval(loadFunds, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Signal Feed</h1>
          <p className="text-text-secondary">Real-time TradingView Blue Candle signals.</p>
        </div>
        <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
           <Zap className="w-4 h-4 text-warning fill-warning" />
           <span className="text-xs font-bold text-white uppercase tracking-wider">Live Updates Enabled</span>
        </div>
      </div>

      {/* Funds Overview Widget */}
      {funds && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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

      <div className="space-y-6">
        {MOCK_SIGNALS.map((signal) => (
          <GlassCard key={signal.id} className="relative group overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg",
                  signal.type === "BUY" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                )}>
                  {signal.type === "BUY" ? "B" : "S"}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{signal.stock}</h3>
                  <p className="text-text-secondary text-sm">Detected at {signal.time}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 flex-1 max-w-xl">
                <div>
                  <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Entry Price</p>
                  <p className="text-lg font-mono font-bold text-white">₹{signal.entry.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Stop Loss</p>
                  <p className="text-lg font-mono font-bold text-danger/80">₹{signal.sl.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Target (+1%)</p>
                  <p className="text-lg font-mono font-bold text-success">₹{signal.target.toFixed(2)}</p>
                </div>
              </div>

              <div className="text-right">
                <Badge variant={signal.status === "Active" ? "info" : "success"} className="px-4 py-1 text-sm mb-2">
                  {signal.status}
                </Badge>
                <p className="text-[10px] text-text-secondary italic">Updated 2 mins ago</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-12 p-6 glass rounded-2xl border-accent-cyan/20 bg-accent-cyan/5 flex gap-4">
        <Info className="w-6 h-6 text-accent-cyan shrink-0" />
        <div className="text-sm">
          <p className="font-bold text-white mb-1">Trading Rule Reminder</p>
          <p className="text-text-secondary leading-relaxed">
            All trades are MIS (Intraday). Active brokers (such as Upstox) will auto-square off positions at 3:20 PM IST. 
            Ensure your capital per trade matches your risk appetite in profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}


