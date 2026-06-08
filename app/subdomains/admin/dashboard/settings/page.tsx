"use client";

import { GlassCard } from "@/components/GlassCard";
import { 
  Key, 
  Settings as SettingsIcon, 
  Bell, 
  ShieldAlert, 
  RefreshCw, 
  Save,
  Eye,
  EyeOff,
  Mail
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

export default function AdminSettingsPage() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [upstoxKey, setUpstoxKey] = useState("f2c5044c-db22-4f7f-883b-a3b1422a47b4");
  const [upstoxSecret, setUpstoxSecret] = useState("uw627pbzov");
  const [resendKey, setResendKey] = useState("re_XpJEeqvo_DXcRNcU5WQATjKXJhyiebHeq");
  const [geminiKey, setGeminiKey] = useState("AIzaSyBbY_jGxWidh1OO2crQoskJgHlOqIbO5GM");

  const toggleKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    alert("Admin settings updated successfully!");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">System Settings (Super-Admin)</h1>
        <p className="text-text-secondary">Configure live broker integrations, API settings, alert protocols, and system actions.</p>
      </div>

      <div className="space-y-8">
        {/* Live Broker Configuration */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-xl font-bold text-white">Upstox Broker Credentials</h2>
          </div>
          <GlassCard className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Upstox API Key</label>
                <div className="relative">
                  <input 
                    type={showKeys['upstoxKey'] ? "text" : "password"} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white pr-10"
                    value={upstoxKey}
                    onChange={(e) => setUpstoxKey(e.target.value)}
                  />
                  <button onClick={() => toggleKey('upstoxKey')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showKeys['upstoxKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Upstox API Secret</label>
                <div className="relative">
                  <input 
                    type={showKeys['upstoxSecret'] ? "text" : "password"} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white pr-10"
                    value={upstoxSecret}
                    onChange={(e) => setUpstoxSecret(e.target.value)}
                  />
                  <button onClick={() => toggleKey('upstoxSecret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showKeys['upstoxSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Integration Credentials Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-accent-violet" />
            <h2 className="text-xl font-bold text-white">External Integrations</h2>
          </div>
          <GlassCard className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Resend Mail API Key</label>
                <div className="relative">
                  <input 
                    type={showKeys['resend'] ? "text" : "password"} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white pr-10"
                    value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                  />
                  <button onClick={() => toggleKey('resend')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showKeys['resend'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Google Gemini API Key</label>
                <div className="relative">
                  <input 
                    type={showKeys['gemini'] ? "text" : "password"} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white pr-10"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <button onClick={() => toggleKey('gemini')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showKeys['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Trade Configuration */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-accent-violet" />
            <h2 className="text-xl font-bold text-white">Live Trading Limits</h2>
          </div>
          <GlassCard className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Max Active Clients</label>
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" defaultValue="20" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Max Spread Limit</label>
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" defaultValue="0.8%" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Signal Timeout</label>
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" defaultValue="120 mins" />
            </div>
          </GlassCard>
        </section>

        {/* Telegram Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-warning" />
            <h2 className="text-xl font-bold text-white">Telegram Alerts</h2>
          </div>
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-sm font-bold text-white">Admin Channel</p>
                <p className="text-xs text-text-secondary">Scanner status, errors, and system events.</p>
              </div>
              <span className="text-xs font-mono text-white/40">ID: -1004829384</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-sm font-bold text-white">Team Signals</p>
                <p className="text-xs text-text-secondary">Buy/Sell signals and trade execution updates.</p>
              </div>
              <span className="text-xs font-mono text-white/40">ID: -1009283746</span>
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
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={async () => {
                  try {
                    await api.scanner.restart();
                    alert("Scanner restart signal sent.");
                  } catch (err) {
                    alert("Failed to restart scanner.");
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm font-bold hover:bg-danger/20 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Restart Active Scanner
              </button>
            </div>
            <p className="mt-4 text-xs text-danger/60 italic">Note: These actions will interrupt live trading activities.</p>
          </GlassCard>
        </section>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-8 right-8">
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-cyan to-accent-violet text-white font-bold rounded-2xl shadow-xl hover:scale-[1.05] transition-all"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>
    </div>
  );
}
