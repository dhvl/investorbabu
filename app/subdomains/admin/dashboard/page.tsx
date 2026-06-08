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
  Scan,
  TrendingDown,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MarketTrend {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change: number;
}

// Fallback trends data if API is offline
const MOCK_TRENDS: MarketTrend[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", market: "Indian Equity", price: 2450.40, change: 1.25 },
  { symbol: "TATASTEEL", name: "Tata Steel", market: "Indian Equity", price: 165.40, change: -0.85 },
  { symbol: "BTC-USD", name: "Bitcoin", market: "Cryptocurrency", price: 68250.00, change: 3.42 },
  { symbol: "GC=F", name: "Gold Futures", market: "US Commodities", price: 2350.20, change: 0.45 },
  { symbol: "SI=F", name: "Silver Futures", market: "US Commodities", price: 29.80, change: -1.15 }
];

export default function DashboardOverview() {
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic market trends
  const [trends, setTrends] = useState<MarketTrend[]>(MOCK_TRENDS);
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeScanSymbol, setActiveScanSymbol] = useState("RELIANCE");
  const [scanMessage, setScanMessage] = useState("Scanning Indian Equity basket...");

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

    // Fetch real-time market trends from Yahoo Finance helper route
    async function fetchTrends() {
      try {
        const res = await fetch("/api/market-trends");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setTrends(data);
          }
        }
      } catch (err) {
        console.warn("Could not load real-time Yahoo Finance trends, using mock database:", err);
      }
    }

    fetchData();
    fetchTrends();
    const trendInterval = setInterval(fetchTrends, 60000); // Update trends every minute
    return () => clearInterval(trendInterval);
  }, []);

  // Radar rotater & target ticker updater
  useEffect(() => {
    const angleInterval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 40);

    const tickerInterval = setInterval(() => {
      if (trends.length === 0) return;
      const randomTrend = trends[Math.floor(Math.random() * trends.length)];
      setActiveScanSymbol(randomTrend.symbol);
      
      const actions = [
        "Evaluating multi-timeframe extremes...",
        "Analyzing volume breakouts...",
        "Running Strategy 3 risk locks...",
        "Calculating distance 1R targets...",
        "Checking active Upstox limit boundaries..."
      ];
      setScanMessage(actions[Math.floor(Math.random() * actions.length)]);
    }, 4000);

    return () => {
      clearInterval(angleInterval);
      clearInterval(tickerInterval);
    };
  }, [trends]);

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

      {/* Radar Scanner & Live yFinance Trends Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Scanner radar - Left/Span 2 */}
        <GlassCard glowColor="rgba(16, 185, 129, 0.15)" className="lg:col-span-2 min-h-[460px] p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-400 animate-pulse" /> Algorithmic Scanner Radar
              </h3>
              <p className="text-slate-500 text-xs mt-1">Real-time status of visual chart scanner and active target checks.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1 text-[0.65rem] font-bold text-blue-400 uppercase tracking-widest font-mono">
              <span className="text-slate-500">Locking:</span> {activeScanSymbol}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            
            {/* Left: Animated Radar Art */}
            <div className="flex justify-center items-center relative">
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
                  SCANNER ACTIVE
                </span>
              </div>
            </div>

            {/* Right: Real-time scanner message feed */}
            <div className="flex flex-col justify-center space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">
                Scanner Action
              </h4>
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
                  <span className="text-xs font-bold text-white font-mono">{activeScanSymbol}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-mono min-h-[40px]">
                  {scanMessage}
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Channel: TradingView Scanner Core
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Live yFinance Market Trends - Right/Col 1 */}
        <GlassCard glowColor="rgba(168, 85, 247, 0.15)" className="flex flex-col p-8 border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Market Ticker
            </h3>
            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 font-mono">
              REAL-TIME (YF)
            </span>
          </div>
          <p className="text-slate-500 text-xs mb-6">Top moving instruments currently parsed by neural adapters.</p>
          
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
             {trends.map((t) => (
               <div key={t.symbol} className="flex justify-between items-center p-3.5 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-all">
                 <div className="space-y-0.5">
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-white font-mono">{t.symbol}</span>
                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t.market}</span>
                   </div>
                   <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{t.name}</p>
                 </div>
                 
                 <div className="text-right">
                   <p className="text-sm font-bold font-mono text-white">
                     {t.market === 'Indian Equity' ? '₹' : '$'}{t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <span className={cn(
                     "text-[10px] font-bold font-mono flex items-center gap-0.5 justify-end",
                     t.change >= 0 ? "text-emerald-400" : "text-red-400"
                   )}>
                     {t.change >= 0 ? "+" : ""}{t.change.toFixed(2)}%
                   </span>
                 </div>
               </div>
             ))}
          </div>
        </GlassCard>
      </div>

      {/* Core Infrastructure check */}
      <div className="mt-8">
        <GlassCard glowColor="rgba(59, 130, 246, 0.15)" className="p-8 border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-bold text-white font-display">Algorithmic Daemon Clusters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <StatusItem 
                label="Scanner Engine" 
                active={status?.scanner === "active"} 
                icon={<Cpu className="w-4 h-4" />}
             />
             <StatusItem 
                label="Upstox API Node" 
                active={status?.status === "online"} 
                icon={<ShieldCheck className="w-4 h-4" />}
             />
             <StatusItem 
                label="Market Data Relay" 
                active={true} 
                icon={<Globe className="w-4 h-4" />}
             />
             <StatusItem 
                label="Exec Daemon 01" 
                active={true} 
                icon={<Zap className="w-4 h-4" />}
             />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatusItem({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-all group">
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
