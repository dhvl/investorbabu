"use client";

import { GlassCard } from "@/components/GlassCard";
import { Check, Zap, Rocket, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "₹999",
    period: "/month",
    description: "Perfect for beginners following specific stocks.",
    features: ["3 Stocks scanning", "Telegram Alerts only", "Email Support", "Basic Analytics"],
    icon: Zap,
    color: "text-text-secondary",
    button: "Switch to Starter"
  },
  {
    name: "Growth",
    price: "₹2,499",
    period: "/month",
    description: "Ideal for active traders seeking dashboard access.",
    features: ["5 Stocks scanning", "Dashboard Access", "Telegram + Web Alerts", "Priority Support"],
    icon: Rocket,
    color: "text-accent-cyan",
    button: "Current Plan",
    current: true
  },
  {
    name: "Pro",
    price: "₹4,999",
    period: "/month",
    description: "Maximum power with automated execution.",
    features: ["All 15+ Stocks", "Auto-Execution API", "Advanced Analytics", "1-on-1 Support", "Historical Backtests"],
    icon: Crown,
    color: "text-accent-violet",
    button: "Upgrade to Pro",
    featured: true
  }
];

export default function SubscriptionPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-4">Choose Your Plan</h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Scale your trading with automated Blue Candle signals tailored to your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <GlassCard 
            key={plan.name} 
            className={cn(
              "p-8 flex flex-col relative group overflow-hidden",
              plan.featured && "border-blue-500/50 bg-blue-500/5",
              plan.current && "border-blue-400/50"
            )}
          >
            {plan.featured && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent-violet px-4 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
                Most Popular
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-6">
              <plan.icon className={cn("w-8 h-8", plan.color)} />
              <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{plan.price}</span>
              <span className="text-text-secondary">{plan.period}</span>
              <p className="text-sm text-text-secondary mt-2">{plan.description}</p>
            </div>

            <div className="space-y-4 mb-10 flex-1">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-sm text-white/80">{feature}</span>
                </div>
              ))}
            </div>

            <button className={cn(
              "w-full py-3 rounded-xl font-bold transition-all",
              plan.featured 
                ? "bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20" 
                : plan.current
                ? "bg-white/10 text-white cursor-default"
                : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
            )}>
              {plan.button}
            </button>
          </GlassCard>
        ))}
      </div>

      <div className="mt-20 text-center">
        <p className="text-text-secondary text-sm">
          Need a custom plan for large capital? <button className="text-accent-cyan font-bold hover:underline">Contact Sales</button>
        </p>
      </div>
    </div>
  );
}
