"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Bell, Zap, Info, Wallet, TrendingUp, Scan, Plus, Loader2, X, Trash2, Edit2, Check, HelpCircle } from "lucide-react";
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

  const [stocksIn, setStocksIn] = useState<any[]>([]);
  const [stocksUs, setStocksUs] = useState<any[]>([]);
  const [stocksCrypto, setStocksCrypto] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any>({});
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [stockViewMode, setStockViewMode] = useState<'sim' | 'live'>('live');

  // Inline Editing State
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ capital: 0, lot_size: 0, currency: 'INR' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modal State
  const [addMarket, setAddMarket] = useState<'in' | 'us' | 'crypto' | null>(null);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  async function fetchAllMarkets() {
    setLoadingStocks(true);
    try {
      const [resIn, resUs, resCrypto, resConfigs] = await Promise.all([
        fetch('/api/instruments?market=in'),
        fetch('/api/instruments?market=us'),
        fetch('/api/instruments?market=crypto'),
        fetch('/api/instruments/config')
      ]);
      
      const [dataIn, dataUs, dataCrypto, dataConfigs] = await Promise.all([
        resIn.json(),
        resUs.json(),
        resCrypto.json(),
        resConfigs.json()
      ]);
      
      setStocksIn(Array.isArray(dataIn) ? dataIn : []);
      setStocksUs(Array.isArray(dataUs) ? dataUs : []);
      setStocksCrypto(Array.isArray(dataCrypto) ? dataCrypto : []);
      setConfigs(dataConfigs || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStocks(false);
    }
  }

  useEffect(() => {
    fetchAllMarkets();
  }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStockSymbol || !addMarket) return;

    setIsSubmittingStock(true);
    try {
      const res = await fetch(`/api/instruments?market=${addMarket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newStockSymbol })
      });

      if (res.ok) {
        setNewStockSymbol("");
        setAddMarket(null);
        fetchAllMarkets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  const handleDeleteStock = async (symbol: string, market: 'in' | 'us' | 'crypto') => {
    const marketLabel = market === 'in' ? 'Indian' : market === 'us' ? 'US' : 'Crypto';
    if (!confirm(`Are you sure you want to remove ${symbol} from the ${marketLabel} list?`)) return;

    try {
      const res = await fetch(`/api/instruments?market=${market}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });

      if (res.ok) {
        fetchAllMarkets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (symbol: string) => {
    const itemConfig = configs[symbol] || {
      currency: symbol === 'BTCUSD' ? 'USD' : (symbol.endsWith('USD') ? 'USD' : 'INR'),
      sim: { capital: 10000.0, lot_size: 0.0 },
      live: { capital: 10000.0, lot_size: 0.0 }
    };
    
    const modeConfig = itemConfig[stockViewMode] || { capital: 10000.0, lot_size: 0.0 };
    
    setEditingSymbol(symbol);
    setEditForm({
      capital: modeConfig.capital,
      lot_size: modeConfig.lot_size,
      currency: itemConfig.currency
    });
  };

  const saveConfig = async (symbol: string) => {
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/instruments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          currency: editForm.currency,
          mode: stockViewMode,
          capital: Number(editForm.capital),
          lot_size: Number(editForm.lot_size)
        })
      });

      if (res.ok) {
        const result = await res.json();
        setConfigs((prev: any) => ({
          ...prev,
          [symbol]: result.data
        }));
        setEditingSymbol(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
    }
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

  const renderColumn = (
    title: string, 
    marketType: 'in' | 'us' | 'crypto', 
    list: any[], 
    placeholder: string
  ) => {
    return (
      <GlassCard className="flex flex-col h-[500px] p-0 overflow-hidden border-white/5 bg-white/[0.01]">
        {/* Column Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-white/[0.02]">
          <div>
            <h2 className="text-md font-bold text-white tracking-tight">{title}</h2>
            <span className="text-xs text-text-secondary">{list.length} active monitors</span>
          </div>
          <button
            onClick={() => setAddMarket(marketType)}
            className="p-2 bg-gradient-to-r from-accent-cyan to-accent-violet rounded-lg hover:scale-105 transition-all text-white shadow-md shadow-accent-cyan/10"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Instruments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingStocks ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin mb-2" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-text-secondary text-sm p-4">
              {placeholder}
            </div>
          ) : (
            list.map((stock) => {
              const itemConfig = configs[stock.symbol] || {
                currency: marketType === 'in' ? 'INR' : 'USD',
                sim: { capital: 10000.0, lot_size: 0.0 },
                live: { capital: 50000.0, lot_size: 0.0 }
              };
              const modeConfig = itemConfig[stockViewMode] || { capital: 10000.0, lot_size: 0.0 };
              const isEditing = editingSymbol === stock.symbol;

              return (
                <div 
                  key={stock.id} 
                  className={`flex flex-col p-4 bg-white/[0.02] border ${isEditing ? 'border-accent-cyan/40 bg-accent-cyan/[0.02]' : 'border-white/5'} rounded-xl transition-all`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white tracking-tight">{stock.symbol}</span>
                      <span className="text-[10px] text-text-secondary uppercase">{stock.exchange}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={stock.isActive ? "success" : "outline"} className="text-[10px] px-2 py-0.5">
                        {stock.isActive ? "Active" : "Paused"}
                      </Badge>
                      
                      {!isEditing && (
                        <button 
                          onClick={() => startEdit(stock.symbol)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      <button 
                        onClick={() => handleDeleteStock(stock.symbol, marketType)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-text-secondary hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Config display / editor form */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-text-secondary uppercase font-bold tracking-wider mb-1">Currency</label>
                            <select
                              value={editForm.currency}
                              onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-accent-cyan"
                            >
                              <option value="INR" className="bg-[#0f0f16]">INR (₹)</option>
                              <option value="USD" className="bg-[#0f0f16]">USD ($)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] text-text-secondary uppercase font-bold tracking-wider mb-1">Capital</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={editForm.capital}
                              onChange={(e) => setEditForm(prev => ({ ...prev, capital: Number(e.target.value) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-accent-cyan font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-text-secondary uppercase font-bold tracking-wider mb-1">Lot Size</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="Auto"
                              value={editForm.lot_size}
                              onChange={(e) => setEditForm(prev => ({ ...prev, lot_size: Number(e.target.value) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-accent-cyan font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingSymbol(null)}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveConfig(stock.symbol)}
                            disabled={isSavingConfig}
                            className="flex items-center gap-1 px-3 py-1 bg-accent-cyan hover:bg-accent-cyan/80 rounded-lg text-xs font-bold text-black transition-all disabled:opacity-50"
                          >
                            {isSavingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-black" />}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex gap-4">
                          <div>
                            <span className="text-[9px] text-text-secondary uppercase block font-medium">Capital Sizing</span>
                            <span className="font-mono text-white font-semibold">
                              {modeConfig.capital > 0 
                                ? (itemConfig.currency === 'INR' ? `₹${modeConfig.capital.toLocaleString('en-IN')}` : `$${modeConfig.capital.toLocaleString('en-US')}`)
                                : 'Auto (Lot based)'
                              }
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-text-secondary uppercase block font-medium">Fixed Lot Size</span>
                            <span className="font-mono text-white font-semibold">
                              {modeConfig.lot_size > 0 ? `${modeConfig.lot_size} Lot` : 'Auto (Capital based)'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-accent-cyan font-semibold bg-accent-cyan/5 px-2 py-0.5 rounded border border-accent-cyan/10">
                          {itemConfig.currency}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>
    );
  };

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
      <GlassCard className="mt-8 p-6 border-white/5 bg-slate-950/20 mb-8">
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

      {/* Scanned Stocks Panel (2-way connected with Admin) */}
      <div className="mt-12 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white font-display">Manage Scanned Instruments</h3>
            <p className="text-xs text-text-secondary">Configure trading symbols and capital boundaries across global markets (updates admin & engine).</p>
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => { setEditingSymbol(null); setStockViewMode('sim'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${stockViewMode === 'sim' ? 'bg-accent-cyan text-black shadow-md' : 'text-text-secondary hover:text-white'}`}
            >
              Simulation
            </button>
            <button
              onClick={() => { setEditingSymbol(null); setStockViewMode('live'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${stockViewMode === 'live' ? 'bg-accent-violet text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
            >
              Live Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderColumn(
            "Indian Stocks (NSE)", 
            "in", 
            stocksIn, 
            "No Indian stocks configured. Click '+' to add NSE tickers."
          )}
          {renderColumn(
            "US Commodities", 
            "us", 
            stocksUs, 
            "No US commodities configured. Click '+' to add futures symbols."
          )}
          {renderColumn(
            "Crypto Market", 
            "crypto", 
            stocksCrypto, 
            "No Crypto pairs configured. Click '+' to add Coinbase pairs."
          )}
        </div>
      </div>

      {/* Add Stock Modal */}
      {addMarket !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard className="w-full max-w-md p-6 border-white/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                Add to {addMarket === 'in' ? 'Indian Stocks' : addMarket === 'us' ? 'US Commodities' : 'Crypto Market'}
              </h2>
              <button 
                onClick={() => setAddMarket(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleAddStock}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {addMarket === 'in' && "Trading Symbol (e.g. TATASTEEL, DLF, HAVELLS)"}
                  {addMarket === 'us' && "TradingView Futures Symbol (e.g. USOIL, USCOPPER, XAUUSD)"}
                  {addMarket === 'crypto' && "Coinbase Symbol (e.g. BTCUSD, ETHUSD)"}
                </label>
                <input 
                  type="text"
                  autoFocus
                  placeholder="Enter symbol..."
                  value={newStockSymbol}
                  onChange={(e) => setNewStockSymbol(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-cyan/30 placeholder:text-text-secondary/30"
                  required
                />
                <p className="mt-2 text-xs text-text-secondary">
                  {addMarket === 'in' && "The scanner automatically prefixes NSE: inside the system."}
                  {addMarket === 'us' && "Please input the exact TradingView symbol (e.g. USOIL for Crude Oil)."}
                  {addMarket === 'crypto' && "Please input the exact Coinbase pair (e.g. BTCUSD)."}
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setAddMarket(null)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingStock}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-accent-cyan to-accent-violet rounded-xl text-sm font-bold text-white shadow-lg shadow-accent-cyan/20 hover:shadow-accent-cyan/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmittingStock ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Add Instrument"
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}


