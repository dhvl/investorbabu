"use client";

import { GlassCard } from "@/components/GlassCard";
import Badge from "@/components/ui/Badge";
import { Search, Filter, MoreHorizontal, Radar, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SignalsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchSignals() {
      try {
        const data = await api.signals.list();
        setSignals(data);
        
        // Find today's date in "DD MMM YYYY" format
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = now.toLocaleString('default', { month: 'short' });
        const year = now.getFullYear();
        const todayStr = `${day} ${month} ${year}`;
        
        const dates = Array.from(new Set(data.map((s: any) => s.date))) as string[];
        if (dates.includes(todayStr)) {
          setSelectedDate(todayStr);
        } else if (dates.length > 0) {
          // Fallback to most recent date if today has no signals
          dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          setSelectedDate(dates[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSignals();
  }, []);

  const uniqueDates = Array.from(new Set(signals.map((s: any) => s.date))) as string[];
  uniqueDates.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());

  const filteredSignals = signals.filter((s: any) => {
    const matchesDate = !selectedDate || s.date === selectedDate;
    const matchesSearch = !search || s.stock.toLowerCase().includes(search.toLowerCase());
    return matchesDate && matchesSearch;
  });

  // Group signals by instrument
  const groupedSignals = filteredSignals.reduce((acc: Record<string, any[]>, signal: any) => {
    if (!acc[signal.stock]) {
      acc[signal.stock] = [];
    }
    acc[signal.stock].push(signal);
    return acc;
  }, {} as Record<string, any[]>);

  const instrumentNames = Object.keys(groupedSignals);

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">Live Detection</h1>
          <p className="text-slate-400">Algorithmic Blue Candle detection engine (Live Feed).</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date:</span>
            <select 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[150px] appearance-none cursor-pointer"
            >
              {uniqueDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : instrumentNames.length === 0 ? (
        <GlassCard className="py-20 text-center text-slate-500">
          <div className="flex flex-col items-center gap-3">
            <Radar className="w-10 h-10 opacity-20 animate-spin-slow text-blue-400" />
            <p className="text-sm font-medium">No signals found for {selectedDate || 'this filter'}.</p>
            <p className="text-xs text-slate-600">The scanner is active and monitoring market activity.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {instrumentNames.map((name) => {
            const group = groupedSignals[name];
            // Sort detections by time (descending)
            group.sort((a: any, b: any) => b.time.localeCompare(a.time));
            const latest = group[0];

            return (
              <GlassCard key={name} className="relative p-0 flex flex-col overflow-hidden group hover:scale-[1.01] transition-all duration-300 border-white/5">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-2xl font-bold text-white tracking-tight font-display">{name}</h3>
                    <Badge variant="outline" className="text-[0.6rem] border-blue-500/30 text-blue-400">
                      {group.length} {group.length === 1 ? 'Detection' : 'Detections'}
                    </Badge>
                  </div>
                  <p className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.15em]">Last: {latest.time}</p>
                </div>

                {/* List of detections */}
                <div className="flex flex-col">
                  {group.map((signal: any, idx: number) => (
                    <div 
                      key={signal.id} 
                      className={cn(
                        "p-4 flex flex-col gap-3 transition-colors",
                        idx !== group.length - 1 && "border-b border-white/5",
                        idx === 0 ? "bg-blue-500/5" : "bg-transparent opacity-70"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="text-xs font-bold text-white">{signal.time}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <div className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[0.6rem] font-mono font-bold text-emerald-400">
                            H {signal.high.toLocaleString()}
                          </div>
                          <div className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[0.6rem] font-mono font-bold text-red-400">
                            L {signal.low.toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[0.6rem] font-bold text-slate-500 uppercase">Spread:</span>
                          <span className="text-xs font-mono text-slate-300">{signal.spread}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-1">
                         <Badge variant={signal.confidence?.toLowerCase() === "high" ? "success" : "info"} className="text-[0.55rem] px-1.5 py-0">
                            {signal.confidence} Confidence
                         </Badge>
                         <span className="text-[0.55rem] font-bold text-slate-600 uppercase italic">{signal.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Visual glow */}
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/10 blur-3xl pointer-events-none" />
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
