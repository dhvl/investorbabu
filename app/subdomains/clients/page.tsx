"use client";

import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { TrendingUp, Lock, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        if (data && data.clients) {
          const clients = data.clients;
          let matchedClient: any = null;
          let matchedChatId: string = "";
          for (const chatId in clients) {
            const c = clients[chatId];
            if (c.email && c.email.toLowerCase() === email.toLowerCase() && c.password === password) {
              matchedClient = c;
              matchedChatId = chatId;
              break;
            }
          }
          if (matchedClient) {
            localStorage.setItem("client_session", JSON.stringify({
              name: matchedClient.name,
              email: matchedClient.email,
              chat_id: matchedChatId,
              type: matchedClient.type || "live"
            }));
            window.location.href = "/dashboard";
            return;
          }
        }
      }
      setError("Invalid email address or password.");
    } catch (err) {
      console.error(err);
      setError("An error occurred during sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Background Orbs */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">InvestorBabu</h1>
          <p className="text-text-secondary text-sm">Client Portal & Automated Onboarding</p>
        </div>

        <GlassCard className="p-8 border-white/5 bg-slate-900/40">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-500 text-xs text-center font-medium font-sans">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {isLoading ? "Signing In..." : "Client Sign In"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </GlassCard>

        <div className="text-center mt-6 text-xs text-slate-500">
          Not a member? Reach out to support to set up your account.
        </div>
      </div>
    </main>
  );
}
