"use client";

import React, { useState } from "react";
import { TrendingUp, Lock, Mail, ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@investorbabu.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(),
          password: password.trim() 
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        // Successful login, navigate to dashboard
        window.location.href = "/dashboard";
      } else {
        setError(data.message || "Invalid admin credentials. Access restricted.");
      }
    } catch (err: any) {
      setError("Authentication failed. Please check network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 overflow-hidden bg-[#0a0a0f]">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 blur-[130px] rounded-full" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/10 blur-[130px] rounded-full" />

      <GlassCard className="w-full max-w-md p-8 border border-white/10 shadow-2xl relative z-10 backdrop-blur-2xl">
        {/* Header Badge */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(37,99,235,0.4)] border border-white/20">
            <TrendingUp className="text-white w-7 h-7" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">Investor<span className="text-blue-500">Babu</span></h1>
            <span className="px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
              Restricted Admin
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xs">
            Sign in to access client accounts, Nuvama trade engine & 20% commission ledgers.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block ml-1">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans text-sm"
                placeholder="admin@investorbabu.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block ml-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                placeholder="••••••••"
                autoFocus
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[0.7rem] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-bit Encrypted Session • Nuvama Connect Gateway</span>
        </div>
      </GlassCard>
    </main>
  );
}
