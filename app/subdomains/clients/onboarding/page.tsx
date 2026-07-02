"use client";

import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Key, 
  ShieldCheck, 
  Settings,
  Target,
  Rocket
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("starter");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [capital, setCapital] = useState("10000");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleVerify = () => {
    setIsVerifying(true);
    // Register the client configurations locally
    localStorage.setItem("client_plan", plan);
    localStorage.setItem("client_api_key", apiKey);
    localStorage.setItem("client_api_secret", apiSecret);
    localStorage.setItem("client_capital", capital);
    setTimeout(() => {
      setIsVerifying(false);
      setVerified(true);
      nextStep();
    }, 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      {/* Progress Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-2 font-display">Client Onboarding Wizard</h1>
        <p className="text-text-secondary text-sm">Configure your trading bot connection and allocate capital in 4 simple steps.</p>
        
        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-4 mt-8 max-w-md mx-auto">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border",
                step === s 
                  ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                  : step > s 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-900 text-slate-500 border-white/5"
              )}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div className={cn(
                  "w-12 h-[2px] mx-2 transition-all duration-300",
                  step > s ? "bg-emerald-500/30" : "bg-white/5"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        {/* STEP 1: Plan Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-blue-500" /> Choose Your Trading Package
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: "starter", name: "Starter Scan", price: "₹999", desc: "Scan up to 3 Indian stocks with basic bracket targets." },
                { id: "growth", name: "Growth Edge", price: "₹2,499", desc: "Includes commodities, US scanner, uncapped trailing stops." },
                { id: "pro", name: "Pro Multi", price: "₹4,999", desc: "Priority order execution, advanced scaling, dedicated bot." }
              ].map((p) => (
                <GlassCard 
                  key={p.id} 
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "cursor-pointer transition-all border p-6 flex flex-col justify-between hover:scale-[1.02]",
                    plan === p.id ? "border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "border-white/5"
                  )}
                >
                  <div>
                    <Badge variant={plan === p.id ? "info" : "secondary"} className="mb-3 uppercase tracking-wider text-[0.6rem]">
                      {p.id}
                    </Badge>
                    <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed mb-4">{p.desc}</p>
                  </div>
                  <p className="text-xl font-bold text-white">{p.price}<span className="text-xs text-text-secondary font-normal"> / month</span></p>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SMC Connection */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-accent-cyan" /> Secure SMC Trade Connection
            </h2>
            <p className="text-xs text-text-secondary">
              We execute trades securely on your behalf. Enter your API key and secret from your SMC Developer Console.
            </p>
            <GlassCard className="space-y-6 max-w-xl mx-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SMC API Key</label>
                <input 
                  type="text" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API Key"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SMC API Secret</label>
                <input 
                  type="password" 
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter API Secret"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </GlassCard>
          </div>
        )}

        {/* STEP 3: Risk Parameters */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent-violet" /> Risk Profile & Capital Allocation
            </h2>
            <p className="text-xs text-text-secondary">
              Define the maximum capital allocated per trade leg. Trade brackets will size automatically to respect these boundaries.
            </p>
            <GlassCard className="space-y-6 max-w-xl mx-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Maximum Margin per Signal leg</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-bold">₹</span>
                  <input 
                    type="number" 
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 text-xs text-text-secondary space-y-1">
                <p className="font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Strategy Bracket sizing preview:
                </p>
                <p>• Basic Order Value: ₹{Number(capital).toLocaleString()}</p>
                <p>• Max Risk allocation (Stop-Loss extreme): ₹{Math.round(Number(capital) * 0.01)} per trade</p>
              </div>
            </GlassCard>
          </div>
        )}

        {/* STEP 4: Activation Status */}
        {step === 4 && (
          <div className="space-y-8 text-center py-10 max-w-md mx-auto">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">Connection Verified!</h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                Your credentials have successfully authenticated. Bot is prepared to trigger automatic order blocks.
              </p>
            </div>
            <GlassCard className="text-left text-xs space-y-2 border-white/5 bg-slate-950">
              <p className="text-slate-500 font-bold">DEPLOYMENT REPORT:</p>
              <p><span className="text-slate-400">Plan:</span> <span className="font-bold text-white uppercase">{plan}</span></p>
              <p><span className="text-slate-400">Broker:</span> <span className="font-bold text-white">SMC TRADE LIVE</span></p>
              <p><span className="text-slate-400">Trading Limits:</span> <span className="font-bold text-white">₹{Number(capital).toLocaleString()} per symbol</span></p>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="mt-12 flex justify-between border-t border-white/5 pt-8">
        <button
          onClick={prevStep}
          disabled={step === 1}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/10 text-sm font-bold transition-all",
            step === 1 ? "opacity-30 cursor-not-allowed" : "text-white hover:bg-white/5"
          )}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 3 ? (
          <button
            onClick={nextStep}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 hover:scale-[1.02] transition-all"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : step === 3 ? (
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-all"
          >
            {isVerifying ? "Verifying..." : "Verify & Complete"} <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:scale-[1.05] transition-all"
          >
            Launch Client Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
