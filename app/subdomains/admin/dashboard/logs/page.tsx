"use client";

import { GlassCard } from "@/components/GlassCard";
import { Terminal, Search, Trash2, Download, Play, Pause, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let eventSource: EventSource;

    const connect = () => {
      eventSource = new EventSource("/api/logs/stream");

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("Log stream connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const newLog = JSON.parse(JSON.parse(event.data)); // Double parsed because of SSE encoding
          setLogs((prev) => {
            // Prevent duplicates if they happen to come through
            const isDuplicate = prev.some(l => l.timestamp === newLog.timestamp && l.message === newLog.message);
            if (isDuplicate) return prev;
            return [...prev, newLog].slice(-500); // Keep last 500 logs for performance
          });
        } catch (err) {
          console.error("Error parsing log event:", err);
        }
      };

      eventSource.onerror = (err) => {
        setIsConnected(false);
        console.error("Log stream error:", err);
        eventSource.close();
        // Attempt reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => filter === "ALL" || log.level === filter);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-8 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white tracking-tight">System Logs</h1>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[0.6rem] font-bold uppercase tracking-wider",
              isConnected 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                : "bg-amber-500/10 border-amber-500/20 text-amber-500"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              {isConnected ? "Connected" : "Reconnecting..."}
            </div>
          </div>
          <p className="text-text-secondary text-sm">Real-time tail of bluecandle.log and execution events.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-medium transition-all",
              autoScroll ? "text-accent-cyan bg-accent-cyan/10" : "text-white/60"
            )}
          >
            {autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          </button>
          <button 
            onClick={clearLogs}
            className="p-2 glass rounded-xl hover:bg-danger/10 hover:text-danger transition-all group"
            title="Clear view"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button className="p-2 glass rounded-xl hover:bg-white/10 transition-all">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 shrink-0">
        {["ALL", "INFO", "WARNING", "ERROR"].map((lvl) => (
          <button
            key={lvl}
            onClick={() => setFilter(lvl)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all",
              filter === lvl 
                ? "bg-white/20 text-white" 
                : "bg-white/5 text-text-secondary hover:bg-white/10"
            )}
          >
            {lvl}
          </button>
        ))}
      </div>

      <GlassCard className="flex-1 p-0 overflow-hidden bg-black/40 border-white/5 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin-slow" />
              <p className="font-sans text-xs uppercase tracking-widest font-bold">Waiting for log stream...</p>
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-4 group">
                <span className="text-white/20 shrink-0 select-none">{log.timestamp}</span>
                <span className={cn(
                  "font-bold shrink-0 w-16",
                  log.level === "INFO" ? "text-white/40" :
                  log.level === "WARNING" ? "text-warning" : "text-danger"
                )}>
                  [{log.level}]
                </span>
                <span className="text-white/80 group-hover:text-white transition-colors break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </GlassCard>
    </div>
  );
}
