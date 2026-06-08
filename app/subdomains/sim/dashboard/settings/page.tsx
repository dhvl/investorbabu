"use client";

import { GlassCard } from "@/components/GlassCard";
import { 
  Settings as SettingsIcon, 
  ShieldAlert, 
  Save,
  Activity,
  UserCheck
} from "lucide-react";
import { useState } from "react";

export default function SimulationSettingsPage() {
  const [capital, setCapital] = useState("₹10,000");
  const [spread, setSpread] = useState("0.8%");
  const [ageLimit, setAgeLimit] = useState("120 mins");
  const [useStrategy3, setUseStrategy3] = useState(true);

  const handleSave = () => {
    alert("Simulation settings saved successfully!");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-blue-500 uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            SIMULATION MODE ACTIVE
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Simulator Settings</h1>
        <p className="text-text-secondary">Configure risk parameters, dry-run balance levels, and active mock strategies.</p>
      </div>

      <div className="space-y-8">
        {/* Trade Configuration */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-accent-violet" />
            <h2 className="text-xl font-bold text-white">Simulation Trade Parameters</h2>
          </div>
          <GlassCard className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Simulated Capital per Stock</label>
              <input 
                type="text" 
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Mock Max Spread Limit</label>
              <input 
                type="text" 
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Signal Age Limit</label>
              <input 
                type="text" 
                value={ageLimit}
                onChange={(e) => setAgeLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500" 
              />
            </div>
          </GlassCard>
        </section>

        {/* Strategy Engine Controls */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-xl font-bold text-white">Simulation Target Rules</h2>
          </div>
          <GlassCard className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Strategy 2 & 3 Trailing Stop-Loss</p>
                <p className="text-xs text-text-secondary">Breakeven triggers at +0.4% profit. Locks +0.4% at +0.7%.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useStrategy3}
                  onChange={(e) => setUseStrategy3(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs">
              <UserCheck className="w-5 h-5 shrink-0" />
              <span>All simulation execution is isolated inside our paper trading engine databases, running completely separate from any live broker connection.</span>
            </div>
          </GlassCard>
        </section>

        {/* Danger Zone */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-danger" />
            <h2 className="text-xl font-bold text-white">Danger Zone</h2>
          </div>
          <GlassCard className="border-danger/20 bg-danger/5">
            <button 
              onClick={() => {
                if (confirm("Are you sure you want to purge all simulated paper trades? This cannot be undone.")) {
                  alert("Simulation database purged successfully.");
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm font-bold hover:bg-danger/20 transition-all"
            >
              Reset Simulation DB
            </button>
            <p className="mt-4 text-xs text-danger/60 italic">Note: Purging data will remove all simulation order histories from the database.</p>
          </GlassCard>
        </section>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-8 right-8">
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.05] transition-all"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>
    </div>
  );
}
