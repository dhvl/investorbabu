"use client";

import { StatCard } from "@/components/StatCard";
import { GlassCard } from "@/components/GlassCard";
import { 
  TrendingUp, 
  Activity, 
  Bell, 
  Wallet,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Globe,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardOverview() {
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [summaryData, statusData] = await Promise.all([
          api.dashboard.getSummary(),
          api.dashboard.getStatus()
        ]);
        
        setSummary(summaryData);
        setStatus(statusData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (error && !summary) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2 font-display">Neural Link Failed</h2>
        <p className="text-slate-500 mb-6 font-mono text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-50 transition-all">Reconnect</button>
      </div>
    );
  }

  return (
    <div className="px-8 pb-8">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">Market Intelligence</h1>
        <div className="flex items-center gap-3">
          <p className="text-slate-400">System status: <span className="text-emerald-500 font-bold uppercase tracking-widest text-[0.7rem] ml-1">Optimal</span></p>
          {summary?.last_sync && (
            <span className="text-[0.65rem] text-slate-600 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
              Last Sync: {summary.last_sync}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Today's Net P&L" 
          value={summary?.today_pnl || 0} 
          prefix="₹"
          trend={summary?.pnl_pct}
          icon={<Wallet className="w-5 h-5" />}
          verified={summary?.verified}
          glowColor="rgba(16, 185, 129, 0.25)"
        />
        <StatCard 
          label="Total Executions" 
          value={summary?.total_trades || 0} 
          icon={<Activity className="w-5 h-5" />}
          verified={summary?.verified}
          glowColor="rgba(245, 158, 11, 0.25)"
        />
        <StatCard 
          label="Win Rate" 
          value={`${summary?.win_rate || 0}%`} 
          icon={<TrendingUp className="w-5 h-5" />}
          verified={summary?.verified}
          glowColor="rgba(168, 85, 247, 0.25)"
        />
        <StatCard 
          label="Capital Base" 
          value={10000} 
          prefix="₹"
          icon={<Wallet className="w-4 h-4" />}
          glowColor="rgba(59, 130, 246, 0.25)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard glowColor="rgba(16, 185, 129, 0.15)" className="lg:col-span-2 min-h-[400px] flex flex-col p-8 overflow-hidden relative group">
          <div className="absolute top-[10%] right-[6%] opacity-[0.05] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
             <TrendingUp className="w-64 h-64 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 font-display">Performance Analytics</h3>
          <p className="text-slate-500 text-sm mb-8">Visualizing daily capital growth and drawdown.</p>
          <div className="flex-1 border border-white/5 bg-white/[0.02] rounded-2xl flex items-center justify-center border-dashed backdrop-blur-[10px]">
            <span className="text-slate-600 font-mono text-xs uppercase tracking-widest">Real-time Visualization (Phase 2)</span>
          </div>
        </GlassCard>

        <GlassCard glowColor="rgba(168, 85, 247, 0.15)" className="flex flex-col p-8 border-white/5">
          <h3 className="text-xl font-bold text-white mb-2 font-display">Core Infrastructure</h3>
          <p className="text-slate-500 text-sm mb-8">Monitoring active algorithmic modules.</p>
          
          <div className="space-y-4">
             <StatusItem 
                label="Scanner Engine" 
                active={status?.scanner === "active"} 
                icon={<Cpu className="w-4 h-4" />}
             />
             <StatusItem 
                label="Zerodha Kite API" 
                active={status?.status === "online"} 
                icon={<ShieldCheck className="w-4 h-4" />}
             />
             <StatusItem 
                label="Market Data Relay" 
                active={true} 
                icon={<Globe className="w-4 h-4" />}
             />
             <StatusItem 
                label="Exec Node 01" 
                active={true} 
                icon={<Zap className="w-4 h-4" />}
             />
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
             <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest">Server Uptime</span>
                <span className="text-xs font-mono text-emerald-500">99.98%</span>
             </div>
             <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <div className="w-[99.9%] h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatusItem({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-all group">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
        )}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full", 
          active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
        )} />
        <span className={cn(
          "text-[0.6rem] font-black uppercase tracking-widest", 
          active ? "text-emerald-500" : "text-red-500"
        )}>
          {active ? "Live" : "Down"}
        </span>
      </div>
    </div>
  );
}


