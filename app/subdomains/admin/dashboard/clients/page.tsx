"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserCheck, 
  Clock, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  Loader2, 
  ShieldAlert, 
  MessageSquare,
  Smartphone,
  ChevronRight,
  ChevronDown,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpRight,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  name: string;
  type: "chatbot" | "live";
  whitelisted_instruments?: string[];
  broker?: string;
  client_id?: string;
  commission_rate?: number;
}

interface PendingClient {
  name: string;
  requested_at: string;
}

interface TradeDetail {
  symbol: string;
  action: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  target_pct?: number;
  status: string;
  exit_reason?: string;
  time?: string;
}

interface ClientPnLEntry {
  id: string;
  date: string;
  client_id: string;
  client_name: string;
  broker: string;
  gross_profit: number;
  commission_rate: number;
  commission_amount: number;
  net_client_profit: number;
  trades_count: number;
  payout_status: "PENDING" | "INVOICED" | "PAID";
  trades: TradeDetail[];
}

interface PnLSummary {
  totalGrossProfit: number;
  totalCommission: number;
  totalNetProfit: number;
  totalTrades: number;
  activeClientsCount: number;
  commissionRate: number;
}

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "pnl">("pnl");
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [pending, setPending] = useState<Record<string, PendingClient>>({});
  const [pnlRecords, setPnlRecords] = useState<ClientPnLEntry[]>([]);
  const [pnlSummary, setPnlSummary] = useState<PnLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(false);
  
  // Expanded rows in PnL ledger
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filter state for PnL
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>("ALL");

  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState("");
  
  // Form fields
  const [formData, setFormData] = useState({
    chatId: "",
    name: "",
    type: "live" as "chatbot" | "live",
    whitelisted: ["TATASTEEL", "POLYCAB", "HAVELLS", "DLF", "ADANIENSOL"] as string[],
    broker: "nuvama",
    clientId: "45644658",
    commissionRate: 20
  });
  
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Open Add Modal
  const openAddClient = () => {
    setSelectedChatId("");
    setFormData({
      chatId: "",
      name: "",
      type: "live",
      whitelisted: ["TATASTEEL", "POLYCAB", "HAVELLS", "DLF", "ADANIENSOL"],
      broker: "nuvama",
      clientId: "45644658",
      commissionRate: 20
    });
    setTagInput("");
    setShowApproveModal(true);
  };

  useEffect(() => {
    fetchClients();
    fetchPnL();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const resp = await fetch("/api/clients");
      if (resp.ok) {
        const data = await resp.json();
        setClients(data.clients || {});
        setPending(data.pending || {});
      }
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPnL() {
    setPnlLoading(true);
    try {
      const resp = await fetch("/api/admin/client-pnl");
      if (resp.ok) {
        const data = await resp.json();
        setPnlRecords(data.data || []);
        setPnlSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch client PnL:", err);
    } finally {
      setPnlLoading(false);
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleUpdatePayoutStatus = async (id: string, newStatus: string) => {
    try {
      const resp = await fetch("/api/admin/client-pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          id,
          status: newStatus
        })
      });
      if (resp.ok) {
        fetchPnL();
      }
    } catch (error) {
      console.error("Failed to update payout status:", error);
    }
  };

  // Tags control
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim().toUpperCase();
    if (cleanTag && !formData.whitelisted.includes(cleanTag)) {
      setFormData(prev => ({
        ...prev,
        whitelisted: [...prev.whitelisted, cleanTag]
      }));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      whitelisted: prev.whitelisted.filter(t => t !== tagToRemove)
    }));
  };

  // Open Approval Modal
  const openApprove = (chatId: string, name: string) => {
    setSelectedChatId(chatId);
    setFormData({
      chatId: chatId,
      name: name,
      type: "live",
      whitelisted: ["TATASTEEL", "POLYCAB", "HAVELLS", "DLF", "ADANIENSOL"],
      broker: "nuvama",
      clientId: "45644658",
      commissionRate: 20
    });
    setTagInput("");
    setShowApproveModal(true);
  };

  // Open Edit Modal
  const openEdit = (chatId: string, client: Client) => {
    setSelectedChatId(chatId);
    setFormData({
      chatId: chatId,
      name: client.name,
      type: client.type,
      whitelisted: client.whitelisted_instruments || [],
      broker: client.broker || "nuvama",
      clientId: client.client_id || "45644658",
      commissionRate: client.commission_rate || 20
    });
    setTagInput("");
    setShowEditModal(true);
  };

  // Approve Client Action
  const handleApprove = async () => {
    const finalChatId = selectedChatId || formData.chatId;
    if (!finalChatId) {
      alert("Chat ID is required");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          chat_id: finalChatId,
          name: formData.name,
          type: formData.type,
          whitelisted_instruments: formData.whitelisted,
          broker: formData.broker,
          client_id: formData.clientId,
          commission_rate: formData.commissionRate
        })
      });
      if (resp.ok) {
        setShowApproveModal(false);
        fetchClients();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Update Client Action
  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      const resp = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          chat_id: selectedChatId,
          name: formData.name,
          type: formData.type,
          whitelisted_instruments: formData.whitelisted,
          broker: formData.broker,
          client_id: formData.clientId,
          commission_rate: formData.commissionRate
        })
      });
      if (resp.ok) {
        setShowEditModal(false);
        fetchClients();
      }
    } catch (error) {
      console.error("Failed to update:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Client Action
  const handleDelete = async (chatId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${name}?`)) return;
    try {
      const resp = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          chat_id: chatId
        })
      });
      if (resp.ok) {
        fetchClients();
      }
    } catch (error) {
      console.error("Failed to delete client:", error);
    }
  };

  // Filtered PnL list
  const filteredPnL = selectedClientFilter === "ALL" 
    ? pnlRecords 
    : pnlRecords.filter(r => r.client_id === selectedClientFilter);

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-white font-display">Client Management & Profit Ledger</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              20% Commission Active
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Track multi-client live accounts (Nuvama / Upstox), daily booked profits, and 20% InvestorBabu revenue cuts.
          </p>
        </div>
        <button 
          onClick={openAddClient}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.02] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Onboard Client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab("pnl")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "pnl" 
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 rounded-t-lg" 
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <Receipt className="w-4 h-4" />
          Daily Profit & 20% Commission Ledger
          {pnlRecords.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
              {pnlRecords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "active" 
              ? "border-blue-500 text-white bg-blue-500/5 rounded-t-lg" 
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <UserCheck className="w-4 h-4" />
          Active Clients
          <span className="ml-1 px-2 py-0.5 text-xs bg-white/5 rounded-full text-slate-300">
            {Object.keys(clients).length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer relative",
            activeTab === "pending" 
              ? "border-blue-500 text-white bg-blue-500/5 rounded-t-lg" 
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <Clock className="w-4 h-4" />
          Pending Approvals
          {Object.keys(pending).length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              {Object.keys(pending).length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DAILY PROFIT & 20% COMMISSION LEDGER */}
      {activeTab === "pnl" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Summary KPI Cards */}
          {pnlSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Client Gross P&L</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold text-white font-display">
                    ₹{pnlSummary.totalGrossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[0.7rem] text-emerald-400 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" /> Across {pnlSummary.totalTrades} completed bracket trades
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/20 rounded-full blur-2xl group-hover:bg-amber-500/30 transition-all" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">InvestorBabu 20% Cut</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-500/30">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold text-amber-400 font-display">
                    ₹{pnlSummary.totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[0.7rem] text-amber-200/80 flex items-center gap-1 mt-1">
                    Strict 20% commission on daily profits
                  </span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Client Payout (80%)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold text-emerald-400 font-display">
                    ₹{pnlSummary.totalNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[0.7rem] text-slate-400 flex items-center gap-1 mt-1">
                    Distributed net to client accounts
                  </span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Live Accounts</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                    <Building className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold text-white font-display">
                    {pnlSummary.activeClientsCount} <span className="text-xs font-normal text-slate-400 font-sans">Nuvama accounts</span>
                  </h3>
                  <span className="text-[0.7rem] text-slate-400 flex items-center gap-1 mt-1">
                    Starting ID: 45644658 (Dhaval)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter Client:</span>
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Clients ({pnlRecords.length} records)</option>
                <option value="45644658">Nuvama ID 45644658 (Dhaval Vadgama)</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real-time bracket sync with VPS execution log</span>
            </div>
          </div>

          {/* PnL Ledger Table */}
          {pnlLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span>Loading daily profit & commission ledgers...</span>
            </div>
          ) : filteredPnL.length === 0 ? (
            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-slate-500 flex flex-col items-center justify-center gap-2">
              <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-2" />
              <p className="font-semibold text-white text-lg">No Daily Profit Records</p>
              <p className="text-sm">Trades executed on Nuvama will automatically log daily profits and calculate commissions here.</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-5">Date</th>
                      <th className="py-4 px-5">Client Account</th>
                      <th className="py-4 px-5">Broker</th>
                      <th className="py-4 px-5 text-right">Gross Profit</th>
                      <th className="py-4 px-5 text-right text-amber-300">20% Commission</th>
                      <th className="py-4 px-5 text-right text-emerald-400">Net Client (80%)</th>
                      <th className="py-4 px-5 text-center">Trades</th>
                      <th className="py-4 px-5 text-center">Payout Status</th>
                      <th className="py-4 px-5 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {filteredPnL.map((record) => {
                      const isExpanded = !!expandedRows[record.id];
                      return (
                        <React.Fragment key={record.id}>
                          <tr className="hover:bg-white/[0.03] transition-all">
                            <td className="py-4 px-5 font-mono text-xs text-white font-semibold">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                {record.date}
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <div className="font-bold text-white">{record.client_name}</div>
                              <div className="text-xs text-slate-400 font-mono">ID: {record.client_id}</div>
                            </td>
                            <td className="py-4 px-5">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {record.broker}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-bold text-white">
                              ₹{record.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-bold text-amber-400 bg-amber-500/[0.02]">
                              ₹{record.commission_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-bold text-emerald-400 bg-emerald-500/[0.02]">
                              ₹{record.net_client_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-4 px-5 text-center font-mono text-xs text-slate-300">
                              {record.trades_count || record.trades.length}
                            </td>
                            <td className="py-4 px-5 text-center">
                              <select
                                value={record.payout_status}
                                onChange={(e) => handleUpdatePayoutStatus(record.id, e.target.value)}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold rounded-lg border focus:outline-none transition-all cursor-pointer font-sans",
                                  record.payout_status === "PAID"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : record.payout_status === "INVOICED"
                                      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                )}
                              >
                                <option value="PENDING" className="bg-[#0f0f16] text-amber-400">PENDING</option>
                                <option value="INVOICED" className="bg-[#0f0f16] text-blue-400">INVOICED</option>
                                <option value="PAID" className="bg-[#0f0f16] text-emerald-400">PAID</option>
                              </select>
                            </td>
                            <td className="py-4 px-5 text-center">
                              <button
                                onClick={() => toggleRow(record.id)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Trade Breakdown */}
                          {isExpanded && (
                            <tr className="bg-black/40 border-b border-white/5">
                              <td colSpan={9} className="p-4 sm:p-6">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                      <Receipt className="w-3.5 h-3.5 text-blue-400" />
                                      Itemized Trade Breakdown for {record.date} ({record.client_name})
                                    </h4>
                                    <span className="text-xs text-slate-400 font-mono">
                                      {record.trades.length} executed bracket orders
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-white/10 text-slate-400 font-mono">
                                          <th className="py-2 px-3">Symbol</th>
                                          <th className="py-2 px-3">Action</th>
                                          <th className="py-2 px-3 text-right">Entry</th>
                                          <th className="py-2 px-3 text-right">Exit</th>
                                          <th className="py-2 px-3 text-right">Qty</th>
                                          <th className="py-2 px-3 text-right">P&L</th>
                                          <th className="py-2 px-3">Status / Exit Reason</th>
                                          <th className="py-2 px-3 text-right">Time</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 font-mono">
                                        {record.trades.map((t, idx) => (
                                          <tr key={idx} className="hover:bg-white/5">
                                            <td className="py-2.5 px-3 font-bold text-white">#{t.symbol}</td>
                                            <td className="py-2.5 px-3">
                                              <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[0.65rem] font-bold",
                                                t.action.includes("BUY") 
                                                  ? "bg-emerald-500/20 text-emerald-400" 
                                                  : "bg-red-500/20 text-red-400"
                                              )}>
                                                {t.action}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-300">₹{t.entry_price.toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-300">₹{t.exit_price.toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-400">{t.quantity}</td>
                                            <td className={cn(
                                              "py-2.5 px-3 text-right font-bold",
                                              t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                              {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toFixed(2)}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span className="text-slate-300">{t.exit_reason || t.status}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-slate-400">{t.time || "Market Close"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE CLIENTS DIRECTORY */}
      {activeTab === "active" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {Object.keys(clients).length === 0 ? (
            <div className="col-span-2 text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-slate-500 flex flex-col items-center justify-center gap-2">
              <Users className="w-12 h-12 text-slate-600 mb-2" />
              <p className="font-semibold text-white text-lg">No Active Clients</p>
              <p className="text-sm">Click "Onboard Client" or approve pending Telegram subscribers.</p>
            </div>
          ) : (
            Object.entries(clients).map(([chatId, client]) => (
              <div 
                key={chatId} 
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all flex flex-col justify-between gap-6 group backdrop-blur-md"
              >
                <div>
                  {/* Title Bar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-white font-display">{client.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 font-mono">Chat ID: {chatId}</p>
                        {client.client_id && (
                          <span className="text-xs text-blue-400 font-mono font-semibold">
                            • Account: {client.client_id}
                          </span>
                        )}
                      </div>
                    </div>
                    {client.type === "chatbot" ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat Bot Only
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        Live Trading ({client.commission_rate || 20}% Cut)
                      </span>
                    )}
                  </div>

                  {/* Instruments / Setup */}
                  <div className="mt-4">
                    {client.type === "chatbot" ? (
                      <div>
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-2">Whitelisted Instruments:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {client.whitelisted_instruments && client.whitelisted_instruments.length > 0 ? (
                            client.whitelisted_instruments.map(inst => (
                              <span 
                                key={inst} 
                                className="px-2 py-0.5 text-xs bg-white/5 hover:bg-white/10 rounded-md border border-white/5 text-slate-300 font-medium"
                              >
                                #{inst}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">No instruments configured</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div>
                          <span className="text-[0.65rem] text-slate-500 font-bold uppercase tracking-wider block">Broker API</span>
                          <div className="text-slate-300 font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {client.broker ? client.broker.toUpperCase() : "NUVAMA WEALTH"} 
                          </div>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-slate-500 font-bold uppercase tracking-wider block">Profit Commission</span>
                          <div className="text-amber-400 font-semibold text-sm mt-0.5">
                            {client.commission_rate || 20}% of Net Gain
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <button
                    onClick={() => openEdit(chatId, client)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 border border-white/5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <button
                    onClick={() => handleDelete(chatId, client.name)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all flex items-center gap-1.5 border border-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke Access
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: PENDING APPROVALS */}
      {activeTab === "pending" && (
        <div className="flex flex-col gap-3 animate-fade-in">
          {Object.keys(pending).length === 0 ? (
            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-slate-500 flex flex-col items-center justify-center gap-2">
              <Clock className="w-12 h-12 text-slate-600 mb-2" />
              <p className="font-semibold text-white text-lg">No Pending Registrations</p>
              <p className="text-sm">New bot users will appear here when they send <code>/start</code>.</p>
            </div>
          ) : (
            Object.entries(pending).map(([chatId, user]) => (
              <div 
                key={chatId} 
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 backdrop-blur-md"
              >
                <div>
                  <h3 className="font-bold text-white text-lg font-display">{user.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                    <span className="font-mono">Chat ID: {chatId}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 hidden sm:inline" />
                    <span>Requested: {new Date(user.requested_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => openApprove(chatId, user.name)}
                  className="w-full sm:w-auto px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Review & Approve
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* APPROVE / ONBOARD MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f0f16] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-zoom-in">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="font-bold text-lg text-white font-display">
                {selectedChatId ? "Approve Registration Request" : "Onboard New Live Client"}
              </h2>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {!selectedChatId && (
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Telegram Chat ID</label>
                  <input 
                    type="text" 
                    value={formData.chatId}
                    onChange={(e) => setFormData(prev => ({ ...prev, chatId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all"
                    placeholder="Enter Telegram Chat ID (e.g. 945073334)"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Client Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. Dhaval Vadgama"
                />
              </div>

              {/* Onboarding Options */}
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Execution Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={cn(
                    "flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5",
                    formData.type === "live" 
                      ? "border-emerald-500/50 bg-emerald-500/5" 
                      : "border-white/10 bg-transparent"
                  )}>
                    <input 
                      type="radio" 
                      name="clientType" 
                      value="live" 
                      checked={formData.type === "live"}
                      onChange={() => setFormData(prev => ({ ...prev, type: "live" }))}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Live Trading
                    </div>
                    <span className="text-xs text-slate-500 leading-normal">Direct broker execution + 20% commission logging.</span>
                  </label>

                  <label className={cn(
                    "flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5",
                    formData.type === "chatbot" 
                      ? "border-blue-500/50 bg-blue-500/5" 
                      : "border-white/10 bg-transparent"
                  )}>
                    <input 
                      type="radio" 
                      name="clientType" 
                      value="chatbot" 
                      checked={formData.type === "chatbot"}
                      onChange={() => setFormData(prev => ({ ...prev, type: "chatbot" }))}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Chat Bot Only
                    </div>
                    <span className="text-xs text-slate-500 leading-normal">Send filtered breakout signals directly to Telegram.</span>
                  </label>
                </div>
              </div>

              {formData.type === "live" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Broker Gateway</label>
                    <select
                      value={formData.broker}
                      onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm cursor-pointer"
                    >
                      <option value="nuvama" className="bg-[#0f0f16]">Nuvama Wealth (API Connect)</option>
                      <option value="upstox" className="bg-[#0f0f16]">Upstox API Gateway</option>
                      <option value="zerodha" className="bg-[#0f0f16]">Zerodha Kite Connect</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Broker Account / Client ID</label>
                    <input 
                      type="text" 
                      value={formData.clientId}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm font-mono"
                      placeholder="e.g. 45644658"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || !formData.name.trim()}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f0f16] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-zoom-in">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="font-bold text-lg text-white font-display">Configure Client Properties</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">User Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all"
                  placeholder="Enter name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Broker Account ID</label>
                  <input 
                    type="text" 
                    value={formData.clientId}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm font-mono"
                    placeholder="e.g. 45644658"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Commission Rate (%)</label>
                  <input 
                    type="number" 
                    value={formData.commissionRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm font-mono"
                    placeholder="20"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting || !formData.name.trim()}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
