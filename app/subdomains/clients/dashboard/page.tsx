"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Bell, Zap, Info, Wallet, TrendingUp, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_SIGNALS = [
  { id: 1, time: "11:45 AM", stock: "POLYCAB", entry: 6200.00, sl: 6185.00, target: 6262.00, type: "BUY", status: "Active" },
  { id: 2, time: "10:30 AM", stock: "HAVELLS", entry: 1535.00, sl: 1540.20, target: 1519.65, type: "SELL", status: "Target Hit" },
  { id: 3, time: "09:15 AM", stock: "TATASTEEL", entry: 165.40, sl: 164.10, target: 167.05, type: "BUY", status: "Target Hit" },
];

export default function ClientDashboard() {
  const [funds, setFunds] = useState<any>(null);
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeScanSymbol, setActiveScanSymbol] = useState("TATASTEEL");
  const [scanMessage, setScanMessage] = useState("Scanning Indian Equity basket...");

  const [clientData, setClientData] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [chatId, setChatId] = useState("");

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

  useEffect(() => {
    const savedChatId = localStorage.getItem("client_chat_id") || "8208852056";
    setChatId(savedChatId);

    async function loadClientData() {
      try {
        const res = await fetch("/api/clients");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok" && data.clients && data.clients[savedChatId]) {
            setClientData(data.clients[savedChatId]);
            setWatchlist(data.clients[savedChatId].whitelisted_instruments || []);
          }
        }
      } catch (err) {
        console.error("Failed to load client data:", err);
      }
    }
    loadClientData();
  }, []);

  const handleSaveWatchlist = async () => {
    setSavingWatchlist(true);
    try {
      const resp = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          chat_id: chatId,
          name: clientData?.name || "Live Subscriber",
          type: clientData?.type || "live",
          whitelisted_instruments: watchlist,
          broker: clientData?.broker || "smc"
        })
      });
      if (resp.ok) {
        alert("Watchlist updated successfully!");
      } else {
        alert("Failed to update watchlist.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving watchlist.");
    } finally {
      setSavingWatchlist(false);
    }
  };

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSymbol.trim().toUpperCase();
    if (clean && !watchlist.includes(clean)) {
      setWatchlist(prev => [...prev, clean]);
    }
    setNewSymbol("");
  };

  const handleRemoveSymbol = (sym: string) => {
    setWatchlist(prev => prev.filter(s => s !== sym));
  };

  // Radar rotater & target ticker updater
  useEffect(() => {
    const angleInterval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 40);

    const tickerInterval = setInterval(() => {
      const symbols = ["TATASTEEL", "POLYCAB", "HAVELLS", "DLF", "ADANIENSOL"];
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

      {/* Visual Scanner radar */}
      <GlassCard glowColor="rgba(16, 185, 129, 0.15)" className="min-h-[380px] p-8 flex flex-col justify-between overflow-hidden relative mb-10 border-white/5">
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
            All trades are MIS (Intraday). Active brokers will auto-square off positions at 3:20 PM IST. 
            Ensure your capital per trade matches your risk appetite in profile settings.
          </p>
        </div>
      </div>

      {/* Watchlist Settings Card */}
      <GlassCard className="mt-8 p-6 border-white/5 bg-slate-950/20">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
          <div>
            <h4 className="text-md font-bold text-white font-display">My Monitored Instruments</h4>
            <p className="text-xs text-text-secondary">Select custom stock symbols you want the bot to trade for your account.</p>
          </div>
          <button 
            onClick={handleSaveWatchlist}
            disabled={savingWatchlist}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)] hover:scale-[1.02]"
          >
            {savingWatchlist ? "Saving..." : "Save My Instruments"}
          </button>
        </div>

        <form onSubmit={handleAddSymbol} className="flex gap-3 mb-4">
          <input 
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Type symbol (e.g. INFOSYS, RELIANCE, TCS) and press Enter"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button 
            type="submit" 
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
          >
            Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-black/20 border border-white/5 rounded-xl">
          {watchlist.length === 0 ? (
            <span className="text-xs text-slate-500 italic my-auto">No custom stocks selected. Add some symbols above.</span>
          ) : (
            watchlist.map(sym => (
              <span key={sym} className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-lg flex items-center gap-1.5">
                {sym}
                <button 
                  type="button" 
                  onClick={() => handleRemoveSymbol(sym)}
                  className="text-blue-400 hover:text-red-400 text-xs font-bold"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}


