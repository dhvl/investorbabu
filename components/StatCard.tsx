"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  verified?: boolean;
  glowColor?: string;
}

export function StatCard({ label, value, trend, icon, prefix = "", suffix = "", verified, glowColor }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(value.toString().replace(/[^0-9.-]+/g, ""));
  const count = useSpring(0, { stiffness: 100, damping: 30 });
  
  const displayValue = useTransform(count, (latest): string => {
    const isNegative = latest < 0;
    const absValue = Math.abs(latest);
    const formatted = absValue.toLocaleString('en-IN', {
      minimumFractionDigits: typeof value === "number" && Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2
    });
    
    // For INR, the sign should be before the symbol or after it?
    // User prefers -₹474.80
    const sign = isNegative ? "-" : "";
    return `${sign}${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!isNaN(numericValue)) {
      count.set(numericValue);
    }
  }, [numericValue, count]);

  return (
    <GlassCard glowColor={glowColor} className="group relative overflow-hidden transition-all hover:bg-white/[0.03] border-white/5">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[0.65rem] font-bold tracking-[0.15em] uppercase text-slate-500">
            {label}
          </span>
          {verified && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]" />
              <span className="text-[0.6rem] font-bold text-blue-400 uppercase tracking-tighter">Verified</span>
            </div>
          )}
        </div>
        
        <div className="flex items-end justify-between">
          <motion.h3 className="text-3xl font-bold tracking-tight text-white font-display">
            {typeof value === "number" ? (
              <motion.span>{displayValue}</motion.span>
            ) : (
              value
            )}
          </motion.h3>
          {icon && (
            <div className="p-2.5 rounded-xl bg-white/5 text-slate-400 group-hover:text-blue-400 transition-all duration-300">
              {icon}
            </div>
          )}
        </div>
        
        {trend !== undefined && (
          <div className={cn(
            "mt-4 text-[0.7rem] font-bold font-mono flex items-center gap-1",
            trend >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            <div className={cn(
              "px-1.5 py-0.5 rounded bg-current/10 flex items-center",
              trend >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </div>
            <span className="text-slate-600 font-medium uppercase tracking-widest text-[0.6rem] ml-1">vs yesterday</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
