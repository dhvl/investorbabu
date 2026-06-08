"use client";

import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Plus, Loader2, X, Trash2, Edit2, Check, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function StocksPage() {
  const [stocksIn, setStocksIn] = useState<any[]>([]);
  const [stocksUs, setStocksUs] = useState<any[]>([]);
  const [stocksCrypto, setStocksCrypto] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // Settings View Mode (Simulation vs Live settings)
  const [viewMode, setViewMode] = useState<'sim' | 'live'>('sim');

  // Inline Editing State
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ capital: 0, lot_size: 0, currency: 'INR' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modal State
  const [addMarket, setAddMarket] = useState<'in' | 'us' | 'crypto' | null>(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchAllMarkets() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllMarkets();
  }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !addMarket) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/instruments?market=${addMarket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol })
      });

      if (res.ok) {
        setNewSymbol("");
        setAddMarket(null);
        fetchAllMarkets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
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
    
    const modeConfig = itemConfig[viewMode] || { capital: 10000.0, lot_size: 0.0 };
    
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
          mode: viewMode,
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

  const renderColumn = (
    title: string, 
    marketType: 'in' | 'us' | 'crypto', 
    list: any[], 
    placeholder: string
  ) => {
    return (
      <GlassCard className="flex flex-col h-[650px] p-0 overflow-hidden border-white/5 bg-white/[0.01]">
        {/* Column Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-white/[0.02]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
            <span className="text-xs text-text-secondary">{list.length} active monitors</span>
          </div>
          <button
            onClick={() => setAddMarket(marketType)}
            className="p-2 bg-gradient-to-r from-accent-cyan to-accent-violet rounded-lg hover:scale-105 transition-all text-white shadow-md shadow-accent-cyan/10"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Instruments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
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
              const modeConfig = itemConfig[viewMode] || { capital: 10000.0, lot_size: 0.0 };
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
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button 
                        onClick={() => handleDeleteStock(stock.symbol, marketType)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-text-secondary hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                            {isSavingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
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
    <div className="p-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Manage Instruments</h1>
          <p className="text-text-secondary">Configure pricing, capital, and lot sizing across India, US, and Crypto markets.</p>
        </div>

        {/* Live/Sim view mode toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => { setEditingSymbol(null); setViewMode('sim'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'sim' ? 'bg-accent-cyan text-black shadow-md' : 'text-text-secondary hover:text-white'}`}
          >
            Simulation Settings
          </button>
          <button
            onClick={() => { setEditingSymbol(null); setViewMode('live'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${viewMode === 'live' ? 'bg-accent-violet text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
          >
            Live Settings
          </button>
        </div>
      </div>

      {/* Info notice about config priority */}
      <div className="mb-6 p-4 glass rounded-xl border-accent-cyan/10 bg-accent-cyan/[0.02] flex gap-3 text-xs">
        <HelpCircle className="w-5 h-5 text-accent-cyan shrink-0" />
        <div className="text-text-secondary leading-relaxed">
          <span className="font-bold text-white block mb-0.5">Sizing Calculation Hierarchy:</span>
          If a <strong className="text-white">Fixed Lot Size</strong> is configured (greater than 0), it will be used directly as the trading size. 
          If set to <strong className="text-white">0</strong>, the trade engine will automatically calculate the quantity using the configured <strong className="text-white">Capital Sizing</strong> divided by the breakout high price.
        </div>
      </div>

      {/* Grid of Columns */}
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

      {/* Add Instrument Modal */}
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
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
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
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-accent-cyan to-accent-violet rounded-xl text-sm font-bold text-white shadow-lg shadow-accent-cyan/20 hover:shadow-accent-cyan/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? (
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
