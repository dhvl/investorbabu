"use client";

import { GlassCard } from "@/components/GlassCard";
import { useState } from "react";
import { TrendingUp, User, Lock } from "lucide-react";
import Link from "next/link";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (email.toLowerCase() === "dhaval@uixstudios.com" && password === "AdmInve$torb@bu") {
      window.location.href = "/client/dashboard";
    } else {
      setError("Invalid email address or password. Please try again.");
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[#0a0a0f]" />
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-accent-violet/10 blur-[120px] rounded-full animate-pulse-soft" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-accent-cyan/10 blur-[120px] rounded-full animate-pulse-soft delay-1000" />

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
           <div className="inline-flex w-14 h-14 bg-gradient-to-br from-accent-violet to-accent-cyan rounded-2xl items-center justify-center mb-4 shadow-xl shadow-accent-violet/20">
              <TrendingUp className="text-white w-8 h-8" />
           </div>
           <h1 className="text-3xl font-bold text-white mb-2">InvestorBabu</h1>
           <p className="text-text-secondary">Sign in to access your trading signals</p>
        </div>

        <GlassCard className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Email Address</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-accent-violet/30 transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-text-secondary">Password</label>
                <button type="button" className="text-xs text-accent-cyan hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-accent-violet/30 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-accent-violet to-accent-cyan text-white font-bold py-3 rounded-xl shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              Sign In
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-text-secondary">
              Don&apos;t have an account? <Link href="/signup" className="text-accent-cyan font-bold hover:underline">Sign Up</Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
