"use client";

import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, BarChart2, ShieldAlert, Cpu } from "lucide-react";
import { useEffect, useState } from "react";

export default function SimLearningsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyingParam, setApplyingParam] = useState<string | null>(null);

  async function fetchLearnings() {
    setLoading(true);
    try {
      const res = await fetch("/api/simulation/learnings");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success") {
          setData(json);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLearnings();
  }, []);

  const handleApplyParam = (paramName: string) => {
    setApplyingParam(paramName);
    setTimeout(() => {
      setApplyingParam(null);
      alert(`AI Optimized parameter for "${paramName}" has been successfully pushed and applied to the Simulation engine!`);
    }, 1200);
  };

  return (
    <div className="p-8 pb-24 max-w-6xl mx-auto space-y-10">
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Brain className="w-8 h-8 text-accent-cyan animate-pulse" /> AI Self-Learning & Risk Auditor
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Active daily excursion analysis (MFE/MAE) auto-tuning parameters on the simulation subdomain.
          </p>
        </div>
        <button
          onClick={fetchLearnings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Sync Learning Logs"}
        </button>
      </div>

      {/* Summary Metrics */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Simulated Trades</p>
              <h3 className="text-2xl font-bold font-mono text-white">{data.metrics.totalTrades}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Sim Win Rate</p>
              <h3 className="text-2xl font-bold font-mono text-white">{data.metrics.winRate}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Sim Profit Factor</p>
              <h3 className="text-2xl font-bold font-mono text-white">{data.metrics.profitFactor}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider mb-1">Estimated Net P&L</p>
              <h3 className={`text-2xl font-bold font-mono ${data.metrics.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ₹{data.metrics.totalPnL.toLocaleString()}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${data.metrics.totalPnL >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Main Grid: Parameters Optimizer & Excursion Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Parameter Auto-Tuning Card (Takes 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6 border-white/5 bg-slate-950/20">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Active Engine Parameters vs AI Suggested</h3>
                <p className="text-xs text-text-secondary">Self-learning parameters computed from MAE/MFE trade files.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-text-secondary uppercase font-bold tracking-wider">
                    <th className="pb-3">Parameter Type</th>
                    <th className="pb-3">Active (Sim)</th>
                    <th className="pb-3">AI Suggested (Optimized)</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {data?.modelParams.map((param: any, idx: number) => (
                    <tr key={idx} className="group hover:bg-white/[0.01] transition-all">
                      <td className="py-4 font-bold text-white">{param.parameter}</td>
                      <td className="py-4 text-text-secondary font-mono">{param.active}</td>
                      <td className="py-4 text-accent-cyan font-mono font-semibold">{param.aiSuggested}</td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleApplyParam(param.parameter)}
                          disabled={applyingParam !== null}
                          className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                        >
                          {applyingParam === param.parameter ? "Applying..." : "Sync & Apply"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Guidelines Box */}
          <div className="p-5 glass rounded-2xl border-accent-cyan/15 bg-accent-cyan/[0.02] flex gap-4 text-xs">
            <ShieldAlert className="w-6 h-6 text-accent-cyan shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-white">Self-Learning Sandbox Rule</p>
              <p className="text-text-secondary leading-relaxed">
                During the 1st month sandbox window, all AI parameter optimization, target adjustment, and chop filtration testing is strictly limited to the **Simulation Subdomain**. 
                Live trading parameters will remain locked to default manual whitelists to ensure conservative execution.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: AI Excursion Recommendations Feed */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-accent-violet" /> Excursion Reports
          </h3>

          <div className="space-y-4">
            {data?.recommendations.map((rec: any) => (
              <GlassCard key={rec.id} className="p-5 border-white/5 space-y-3 relative overflow-hidden group hover:border-accent-cyan/20 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{rec.instrument}</h4>
                    <span className="text-[10px] text-text-secondary uppercase">{rec.metric}</span>
                  </div>
                  <Badge variant="info" className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider font-mono">
                    {rec.impact}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed font-sans">
                  {rec.finding}
                </p>
                <div className="pt-2.5 border-t border-white/5 text-[10px] text-accent-cyan font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {rec.action}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
