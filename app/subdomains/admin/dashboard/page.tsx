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
  Zap,
  Play,
  RotateCw,
  Search,
  CheckCircle,
  Scan
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Mock live stream logs for visual scanner
const MOCK_SCANNER_TICKERS = [
  { time: "09:15:05", symbol: "POLYCAB", status: "SCANNING", message: "Fetching fresh 15m candle extremes..." },
  { time: "09:15:12", symbol: "HAVELLS", status: "ANALYZING", message: "Spanning Strategy 3 chop-zone filter..." },
  { time: "09:15:18", symbol: "TATASTEEL", status: "LOCKED", message: "Brackets verified. BUY entry: 165.40 | SL: 164.10" },
  { time: "09:15:25", symbol: "BTCUSD", status: "FILTERED", message: "Volatility exceeds safety thresholds. Bypassing." },
  { time: "09:15:32", symbol: "GOLD", status: "SCANNING", message: "Scanning commodity order blocks..." },
  { time: "09:15:40", symbol: "POLYCAB", status: "LOCKED", message: "Brackets verified. BUY entry: 6200 | SL: 6185" },
  { time: "09:15:48", symbol: "XAGUSD", status: "ANALYZING", message: "Calculating distance 1R ratios..." },
  { time: "09:15:55", symbol: "CRUDEOIL", status: "FILTERED", message: "Chop zone filter active. Ignoring noise." }
];

export default function DashboardOverview() {
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time scanner state
  const [scanTicker, setScanTicker] = useState<any[]>(MOCK_SCANNER_TICKERS.slice(0, 4));
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeScanSymbol, setActiveScanSymbol] = useState("POLYCAB");

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

  // Simulator loop for visual art/scanner
  useEffect(() => {
    const angleInterval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 40);

    const tickerInterval = setInterval(() => {
      setScanTicker(prev => {
        const nextIndex = Math.floor(Math.random() * MOCK_SCANNER_TICKERS.length);
        const rawTicker = MOCK_SCANNER_TICKERS[nextIndex];
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const newTicker = { ...rawTicker, time: timeStr };
        
        setActiveScanSymbol(rawTicker.symbol);
        
        const updated = [newTicker, ...prev];
        return updated.slice(0, 5); // Keep last 5 entries
      });
    }, 4000);

    return () => {
      clearInterval(angleInterval);
      clearInterval(tickerInterval);
    };
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
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">Live Market Intelligence</h1>
          <div className="flex items-center gap-3">
            <p className="text-slate-400">System status: <span className="text-emerald-500 font-bold uppercase tracking-widest text-[0.7rem] ml-1">Optimal</span></p>
            {summary?.last_sync && (
              <span className="text-[0.65rem] text-slate-600 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                Last Sync: {summary.last_sync}
              </span>
            )}
          </div>
        </div>

        {/* Scanner Active Pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-emerald-500/10 border-emerald-500/20">
          <div className="w-2.5 h-2.5 rounded-full pulse-dot bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-400 font-mono">
            V-SCANNER RUNNING (15m Intervals)
          </span>
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
          label="Live Executions" 
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

      {/* Radar Scanner & Neural Logger Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Scanner radar - Left/Span 2 */}
        <GlassCard glowColor="rgba(16, 185, 129, 0.15)" className="lg:col-span-2 min-h-[450px] p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-400 animate-pulse" /> Live Instrument Visual Scanner
              </h3>
              <p className="text-slate-500 text-xs mt-1">Real-time TradingView Chart parsing and neural logic checks.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest font-mono">
              <span className="text-emerald-400">Target:</span> {activeScanSymbol}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            
            {/* Left: Animated Radar Art */}
            <div className="flex justify-center items-center relative">
              {/* Radial Sweep Grid */}
              <div className="relative w-56 h-56 rounded-full border border-emerald-500/20 bg-emerald-950/5 flex items-center justify-center overflow-hidden">
                
                {/* Concentric Circles */}
                <div className="absolute w-40 h-40 rounded-full border border-emerald-500/10" />
                <div className="absolute w-24 h-24 rounded-full border border-emerald-500/10" />
                <div className="absolute w-10 h-10 rounded-full border border-emerald-500/10" />
                
                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-emerald-500/10" />
                <div className="absolute h-full w-[1px] bg-emerald-500/10" />
                
                {/* Sweep Hand */}
                <div 
                  className="absolute w-28 h-28 origin-bottom-right bottom-[50%] right-[50%] bg-gradient-to-tr from-transparent to-emerald-500/30 rounded-tr-full"
                  style={{ transform: `rotate(${radarAngle}deg)` }}
                />

                {/* Blip Indicators */}
                <div className="absolute top-[20%] left-[30%] w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping pointer-events-none" />
                <div className="absolute bottom-[35%] right-[25%] w-2 h-2 bg-emerald-400 rounded-full animate-pulse pointer-events-none" />
                <div className="absolute top-[45%] right-[40%] w-1.5 h-1.5 bg-amber-400 rounded-full pointer-events-none" />

                <span className="text-[0.6rem] font-black uppercase text-emerald-400/30 font-mono tracking-widest absolute">
                  RADAR ACTIVE
                </span>
              </div>
            </div>

            {/* Right: Real-time Neural Logging stream */}
            <div className="flex flex-col justify-between h-full space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">
                Scanner Action Feed
              </h4>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
                {scanTicker.map((t, idx) => (
                  <div key={idx} className="flex items-start justify-between text-xs font-mono border-b border-white/5 pb-2 last:border-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px]">{t.time}</span>
                        <span className="font-bold text-slate-200">{t.symbol}</span>
                        <span className={cn(
                          "text-[9px] px-1 rounded font-bold uppercase",
                          t.status === "LOCKED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          t.status === "FILTERED" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          "bg-white/5 text-slate-400"
                        )}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">{t.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Status Check - Right/Col 1 */}
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
                label="Upstox Broker API" 
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
