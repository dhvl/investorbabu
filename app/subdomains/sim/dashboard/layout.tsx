"use client";

import { 
  TrendingUp, 
  Activity, 
  Bell, 
  Wallet,
  LayoutDashboard,
  History,
  Settings,
  Package,
  LogOut,
  MessageSquare,
  Terminal,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [scannerStatus, setScannerStatus] = useState<"active" | "inactive" | "loading">("loading");

  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await api.dashboard.getStatus();
        setScannerStatus(data.scanner || "inactive");

        // Check for new notifications
        const resp = await fetch('/api/notifications');
        const notifs = await resp.json();
        if (Array.isArray(notifs) && notifs.length > 0) {
          const lastSeen = localStorage.getItem('lastSeenNotification');
          const latest = notifs[0].timestamp;
          if (!lastSeen || new Date(latest) > new Date(lastSeen)) {
            setHasNew(true);
          }
        }
      } catch (err) {
        setScannerStatus("inactive");
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pathname === '/dashboard/notifications') {
      setHasNew(false);
      // Mark as seen
      fetch('/api/notifications').then(r => r.json()).then(data => {
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('lastSeenNotification', data[0].timestamp);
        }
      });
    }
  }, [pathname]);

  const sidebarItems = [
    { id: "overview", label: "Indian Equity Sim", icon: LayoutDashboard, href: "/dashboard" },
    { id: "us-simulation", label: "US Market Sim", icon: Activity, href: "/dashboard/us" },
    { id: "crypto-simulation", label: "Crypto Sim", icon: Activity, href: "/dashboard/crypto" },
    { id: "eashaan-simulation", label: "Eashaan Sim", icon: Activity, href: "/dashboard/eashaan" },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 p-6 flex flex-col gap-8 sticky top-0 h-screen bg-black/20 backdrop-blur-xl">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-white tracking-tight font-display">Investor<span className="text-blue-500">Babu</span></span>
            <span className="text-[0.55rem] font-bold text-blue-400 uppercase tracking-widest -mt-1">Simulator</span>
          </div>
        </Link>

        <nav className="flex-1 flex flex-col gap-1 -mx-6">
          {sidebarItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-6 py-2.5 transition-all duration-200 group",
                pathname === item.href 
                  ? "nav-item-active" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-blue-400" : "group-hover:text-blue-400")} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <Link href="/dashboard/settings" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl transition-all", pathname === "/dashboard/settings" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5")}>
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Sim Settings</span>
          </Link>
          <Link href="/login" className="flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all">
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex justify-between items-center px-8 py-6 sticky top-0 z-10 bg-[#0a0a0f]/60 backdrop-blur-xl border-b border-white/5">
          <div>
            <h2 className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-[0.15em] font-display">
              {pathname === "/dashboard" ? "Market Intelligence" : (pathname ? pathname.split("/").pop()?.replace("-", " ") : "")}
            </h2>
          </div>
          <div className="flex gap-4">
             <div className={cn(
                "flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-500",
                scannerStatus === "active" 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : scannerStatus === "loading"
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-slate-500/10 border-slate-500/20"
             )}>
                <div className={cn(
                  "w-2 h-2 rounded-full transition-all duration-500",
                  scannerStatus === "active" 
                    ? "pulse-dot bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    : scannerStatus === "loading"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-slate-600"
                )} />
                <span className={cn(
                  "text-[0.7rem] font-bold uppercase tracking-wider",
                  scannerStatus === "active" 
                    ? "text-emerald-500" 
                    : scannerStatus === "loading"
                      ? "text-amber-500"
                      : "text-slate-500"
                )}>
                  Scanner {scannerStatus === "active" ? "Active" : scannerStatus === "loading" ? "Syncing" : "Offline"}
                </span>
             </div>
              <Link 
                href="/dashboard/notifications"
                className={cn(
                  "p-2 rounded-xl transition-all relative group overflow-hidden",
                  hasNew 
                    ? "bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse-gentle" 
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                )}
              >
                <Bell className={cn("w-5 h-5", hasNew ? "text-blue-400" : "text-slate-400")} />
                {hasNew && (
                  <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#0a0a0f] shadow-[0_0_8px_rgba(59,130,246,1)]" />
                )}
              </Link>
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
