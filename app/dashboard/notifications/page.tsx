"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { 
  Bell, 
  Calendar, 
  Search, 
  Info, 
  AlertTriangle, 
  Activity, 
  ShoppingBag,
  Clock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_NAMES: Record<string, string> = {
  "945073334": "Dhaval (Admin)",
  "1488710204": "Suchit (Team)",
  "929350198": "Eashaan (Team)",
  "8208852056": "Ganesh (Client)"
};

interface Notification {
  timestamp: string;
  chat_ids: string[];
  text: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, [selectedDate]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/notifications?date=${selectedDate}`);
      const data = await resp.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (text: string) => {
    if (text.includes("SIGNAL")) return <Activity className="w-4 h-4 text-accent-cyan" />;
    if (text.includes("ORDERS PLACED") || text.includes("ORDER FILLED")) return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
    if (text.includes("ERROR") || text.includes("FAILED")) return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (text.includes("STARTED") || text.includes("connected")) return <Info className="w-4 h-4 text-blue-400" />;
    return <Bell className="w-4 h-4 text-slate-400" />;
  };

  const formatText = (text: string) => {
    // Basic formatting for the Telegram HTML style
    return text
      .replace(/<b>(.*?)<\/b>/g, '<strong class="text-white">$1</strong>')
      .replace(/<code>(.*?)<\/code>/g, '<code class="bg-white/10 px-1 rounded text-accent-cyan">$1</code>')
      .replace(/\n/g, '<br />');
  };

  const filtered = notifications.filter(n => 
    n.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2 font-display">Notification Logs</h1>
          <p className="text-slate-400 text-sm">Historical archive of all Telegram alerts and system broadcasts.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center glass rounded-xl overflow-hidden border-white/5">
            <button 
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 border-x border-white/5 flex items-center gap-2 text-sm font-bold text-white min-w-[140px] justify-center">
              <Calendar className="w-4 h-4 text-accent-cyan" />
              {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <button 
              onClick={() => changeDate(1)}
              disabled={selectedDate === new Date().toISOString().split('T')[0]}
              className="p-2 hover:bg-white/5 transition-colors text-slate-400 hover:text-white disabled:opacity-20"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-accent-cyan transition-colors" />
            <input 
              type="text"
              placeholder="Filter messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-cyan/50 transition-all min-w-[240px]"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center border-dashed border-white/10">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No notifications found</h3>
          <p className="text-slate-500 text-sm max-w-xs">
            {searchTerm ? "No messages match your search filter." : "There were no broadcasts recorded for this date."}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {filtered.map((notif, idx) => (
            <GlassCard key={idx} className="p-0 overflow-hidden border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col sm:flex-row">
                {/* Meta Sidebar */}
                <div className="sm:w-48 p-6 bg-white/[0.02] border-b sm:border-b-0 sm:border-r border-white/5 flex sm:flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(notif.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                    <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-wider">
                      {new Date(notif.timestamp).toLocaleDateString('en-IN', { weekday: 'long' })}
                    </span>
                  </div>
                  
                  {/* Active Tooltip Map of Chat IDs to Names */}
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-white/5">
                      {getIcon(notif.text)}
                    </div>
                    <div className="flex flex-col relative">
                      <span className="flex items-center gap-1 text-[0.6rem] font-bold text-slate-500 uppercase tracking-tight">
                        Recipients
                        <div className="relative inline-block group">
                          <Info 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTooltip(activeTooltip === idx ? null : idx);
                            }}
                            className="w-3 h-3 text-slate-400 hover:text-white cursor-pointer transition-colors" 
                          />
                          {/* Tooltip Card */}
                          <div className={cn(
                            "absolute bottom-full left-0 mb-2 bg-slate-950/90 backdrop-blur-md border border-white/10 text-[0.65rem] text-slate-200 px-3 py-2 rounded-xl whitespace-nowrap shadow-2xl z-50 transition-all duration-200 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto",
                            activeTooltip === idx ? "opacity-100 pointer-events-auto scale-100" : "opacity-0 scale-95 origin-bottom-left"
                          )}>
                            <div className="font-bold text-slate-400 mb-1 border-b border-white/5 pb-1">Broadcast List</div>
                            <ul className="space-y-1">
                              {notif.chat_ids.map((id) => (
                                <li key={id} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                                  {CHAT_NAMES[id] || `User (${id})`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </span>
                      <span className="text-[0.6rem] text-slate-400">
                        {notif.chat_ids.length === 1 ? "Admin Only" : `Broadcast (${notif.chat_ids.length})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Content */}
                <div className="flex-1 p-6">
                  <div 
                    className="text-slate-300 text-sm font-mono leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: formatText(notif.text) }}
                  />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
