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
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  name: string;
  type: "chatbot" | "live";
  whitelisted_instruments?: string[];
  broker?: string;
}

interface PendingClient {
  name: string;
  requested_at: string;
}

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [pending, setPending] = useState<Record<string, PendingClient>>({});
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState("");
  
  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    type: "chatbot" as "chatbot" | "live",
    whitelisted: [] as string[],
    broker: "upstox"
  });
  
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
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
      name: name,
      type: "chatbot",
      whitelisted: ["XAUUSD", "XAGUSD", "OILUSD", "BTCUSD"],
      broker: "upstox"
    });
    setTagInput("");
    setShowApproveModal(true);
  };

  // Open Edit Modal
  const openEdit = (chatId: string, client: Client) => {
    setSelectedChatId(chatId);
    setFormData({
      name: client.name,
      type: client.type,
      whitelisted: client.whitelisted_instruments || [],
      broker: client.broker || "upstox"
    });
    setTagInput("");
    setShowEditModal(true);
  };

  // Approve Client Action
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const resp = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          chat_id: selectedChatId,
          name: formData.name,
          type: formData.type,
          whitelisted_instruments: formData.whitelisted,
          broker: formData.broker
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
          broker: formData.broker
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

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Client Management</h1>
          <p className="text-slate-400 text-sm mt-1">Configure bot signal recipients, whitelists, and live trading settings.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "px-4 py-2 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2",
            activeTab === "active" 
              ? "border-blue-500 text-white" 
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
            "px-4 py-2 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 relative",
            activeTab === "pending" 
              ? "border-blue-500 text-white" 
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

      {/* Main Content Pane */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span>Loading client directory...</span>
        </div>
      ) : activeTab === "active" ? (
        /* Active Clients View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(clients).length === 0 ? (
            <div className="col-span-2 text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-slate-500 flex flex-col items-center justify-center gap-2">
              <Users className="w-12 h-12 text-slate-600 mb-2" />
              <p className="font-semibold text-white text-lg">No Active Clients</p>
              <p className="text-sm">New clients can register by sending <code>/start</code> to the Telegram Bot.</p>
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
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Chat ID: {chatId}</p>
                    </div>
                    {client.type === "chatbot" ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat Bot Only
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        Live Trading
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
                      <div>
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Broker Integration:</span>
                        <div className="text-slate-300 font-medium text-sm flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {client.broker ? client.broker.toUpperCase() : "None"} 
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <button
                    onClick={() => openEdit(chatId, client)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 border border-white/5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <button
                    onClick={() => handleDelete(chatId, client.name)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all flex items-center gap-1.5 border border-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke Access
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Pending Approvals View */
        <div className="flex flex-col gap-3">
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
                  className="w-full sm:w-auto px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  Review & Approve
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* APPROVE CLIENT MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f0f16] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-zoom-in">
            {/* Modal Title */}
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="font-bold text-lg text-white font-display">Approve Registration Request</h2>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">User Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all"
                  placeholder="Enter user name"
                />
              </div>

              {/* Onboarding Options */}
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Onboarding Configuration</label>
                <div className="grid grid-cols-2 gap-3">
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
                    <span className="text-xs text-slate-500 leading-normal">Send filtered breakouts signals directly to client Telegram.</span>
                  </label>

                  <label className={cn(
                    "flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5",
                    formData.type === "live" 
                      ? "border-blue-500/50 bg-blue-500/5" 
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
                    <span className="text-xs text-slate-500 leading-normal">Onboard client to execute trades live through their broker app.</span>
                  </label>
                </div>
              </div>

              {/* Type Specific Fields */}
              {formData.type === "chatbot" ? (
                /* Whitelisting tag editor */
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Whitelisted Instruments</label>
                  
                  {/* Enter tag input */}
                  <form onSubmit={handleAddTag} className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Type asset (e.g. BTCUSD) and press Enter"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm"
                    />
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all font-bold text-xs flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>

                  {/* Render Tags */}
                  <div className="flex flex-wrap gap-1.5 p-3 bg-white/5 border border-white/10 rounded-xl min-h-[60px]">
                    {formData.whitelisted.length === 0 ? (
                      <span className="text-xs text-slate-500 italic my-auto">No whitelisted assets. All signals will be blocked.</span>
                    ) : (
                      formData.whitelisted.map(tag => (
                        <span 
                          key={tag} 
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 transition-all"
                        >
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveTag(tag)}
                            className="text-blue-400 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Live Onboarding Setup */
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Select Trading App (Broker)</label>
                    <select
                      value={formData.broker}
                      onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm cursor-pointer"
                    >
                      <option value="upstox" className="bg-[#0f0f16]">Upstox API Gateway</option>
                      <option value="zerodha" className="bg-[#0f0f16]">Zerodha Kite Connect</option>
                    </select>
                  </div>
                  <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-start gap-2.5 text-xs text-yellow-400/90 leading-relaxed">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Credential Provisioning Required</p>
                      <p className="mt-0.5">Live trading requires setting up client credentials in the environment or server properties. Broker connection setup will complete during staging activation.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || !formData.name.trim()}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONFIGURATION MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f0f16] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-zoom-in">
            {/* Modal Title */}
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="font-bold text-lg text-white font-display">Configure Client Properties</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
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

              {/* Onboarding Options */}
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Onboarding Configuration</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={cn(
                    "flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5",
                    formData.type === "chatbot" 
                      ? "border-blue-500/50 bg-blue-500/5" 
                      : "border-white/10 bg-transparent"
                  )}>
                    <input 
                      type="radio" 
                      name="clientTypeEdit" 
                      value="chatbot" 
                      checked={formData.type === "chatbot"}
                      onChange={() => setFormData(prev => ({ ...prev, type: "chatbot" }))}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Chat Bot Only
                    </div>
                    <span className="text-xs text-slate-500 leading-normal">Send filtered breakouts signals directly to client Telegram.</span>
                  </label>

                  <label className={cn(
                    "flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5",
                    formData.type === "live" 
                      ? "border-blue-500/50 bg-blue-500/5" 
                      : "border-white/10 bg-transparent"
                  )}>
                    <input 
                      type="radio" 
                      name="clientTypeEdit" 
                      value="live" 
                      checked={formData.type === "live"}
                      onChange={() => setFormData(prev => ({ ...prev, type: "live" }))}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Live Trading
                    </div>
                    <span className="text-xs text-slate-500 leading-normal">Onboard client to execute trades live through their broker app.</span>
                  </label>
                </div>
              </div>

              {/* Type Specific Fields */}
              {formData.type === "chatbot" ? (
                /* Whitelisting tag editor */
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Whitelisted Instruments</label>
                  
                  {/* Enter tag input */}
                  <form onSubmit={handleAddTag} className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Type asset (e.g. BTCUSD) and press Enter"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm"
                    />
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all font-bold text-xs flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>

                  {/* Render Tags */}
                  <div className="flex flex-wrap gap-1.5 p-3 bg-white/5 border border-white/10 rounded-xl min-h-[60px]">
                    {formData.whitelisted.length === 0 ? (
                      <span className="text-xs text-slate-500 italic my-auto">No whitelisted assets. All signals will be blocked.</span>
                    ) : (
                      formData.whitelisted.map(tag => (
                        <span 
                          key={tag} 
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 transition-all"
                        >
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveTag(tag)}
                            className="text-blue-400 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Live Onboarding Setup */
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Select Trading App (Broker)</label>
                    <select
                      value={formData.broker}
                      onChange={(e) => setFormData(prev => ({ ...prev, broker: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none transition-all text-sm cursor-pointer"
                    >
                      <option value="upstox" className="bg-[#0f0f16]">Upstox API Gateway</option>
                      <option value="zerodha" className="bg-[#0f0f16]">Zerodha Kite Connect</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting || !formData.name.trim()}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
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
