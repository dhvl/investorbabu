"use client";

import { 
  TrendingUp, 
  Bell, 
  CreditCard,
  UserPlus,
  LogOut,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<{ name: string; type: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("client_session");
      if (stored) {
        setSession(JSON.parse(stored));
      } else if (pathname !== "/" && pathname !== "/login" && pathname !== "") {
        window.location.href = "/";
      }
    } catch (e) {
      console.error(e);
    }
  }, [pathname]);

  const navItems = [
    { id: "dashboard", label: "Signal Feed", icon: Bell, href: "/dashboard" },
    { id: "instruments", label: "My Instruments", icon: TrendingUp, href: "/instruments" },
    { id: "learnings", label: "Trade History", icon: History, href: "/learnings" },
    { id: "onboarding", label: "Onboarding Wizard", icon: UserPlus, href: "/onboarding" },
    { id: "subscription", label: "Subscription", icon: CreditCard, href: "/subscription" },
  ];

  // Don't show sidebar on login/root page if we show it as a standalone gate
  if (pathname === "/login" || pathname === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Client Sidebar */}
      <aside className="w-64 border-r border-white/5 p-6 flex flex-col gap-8 bg-black/20 backdrop-blur-xl">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight font-display">InvestorBabu</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1 -mx-6">
          {navItems.map((item) => (
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

        <div className="mt-auto">
          <button
            onClick={() => {
              localStorage.removeItem("client_session");
              window.location.href = "/";
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex justify-between items-center px-8 py-6 sticky top-0 z-10 bg-[#0a0a0f]/60 backdrop-blur-xl border-b border-white/5">
           <div>
             <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest font-display">Client Portal</h2>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-white">{session ? session.name : "Guest Client"}</p>
                <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">{session ? (session.type === "live" ? "Active Trader" : session.type) : "Onboarding"}</p>
              </div>
           </div>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
