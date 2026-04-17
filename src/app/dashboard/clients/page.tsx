"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconEdit, IconTrash, IconX } from "@/components/icons";

interface Invoice {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business: string;
  website: string | null;
  plan: string;
  status: string;
  monthlyRate: number;
  startDate: string;
  notes: string | null;
  createdAt: string;
  invoices: Invoice[];
}

const PLAN_OPTIONS = ["SignalCore", "SearchVault", "SmartNav", "SearchSync"];
const STATUS_OPTIONS = ["active", "paused", "churned"];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this client and all their invoices?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    fetchClients();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(formData);
    data.monthlyRate = parseFloat(data.monthlyRate as string) || 0;

    if (editingClient) {
      await fetch(`/api/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }

    setShowForm(false);
    setEditingClient(null);
    fetchClients();
  }

  const totalMRR = clients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + c.monthlyRate, 0);

  return (
    <div>
      <div className="flex items-center justify-between page-header">
        <div>
          <h2 className="page-title">Clients</h2>
          <p className="page-subtitle">
            {clients.filter((c) => c.status === "active").length} active · ${totalMRR.toLocaleString()}/mo MRR
          </p>
        </div>
        <button onClick={() => { setEditingClient(null); setShowForm(true); }} className="btn-primary">
          <IconPlus size={16} />
          Add Client
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="tab-list">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`tab-item ${filter === s ? "active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="panel w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
            <div className="panel-header">
              <h3 className="text-[15px] font-semibold">
                {editingClient ? "Edit Client" : "Add New Client"}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingClient(null); }} className="text-muted hover:text-foreground transition cursor-pointer">
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="panel-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Name *</label>
                  <input name="name" required defaultValue={editingClient?.name} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Email *</label>
                  <input name="email" type="email" required defaultValue={editingClient?.email} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Business *</label>
                  <input name="business" required defaultValue={editingClient?.business} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Phone</label>
                  <input name="phone" defaultValue={editingClient?.phone || ""} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Website</label>
                  <input name="website" defaultValue={editingClient?.website || ""} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Plan</label>
                  <select name="plan" defaultValue={editingClient?.plan || "SignalCore"} className="input-field cursor-pointer">
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Monthly Rate ($)</label>
                  <input name="monthlyRate" type="number" step="0.01" defaultValue={editingClient?.monthlyRate || 0} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Status</label>
                  <select name="status" defaultValue={editingClient?.status || "active"} className="input-field cursor-pointer">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Notes</label>
                <textarea name="notes" rows={3} defaultValue={editingClient?.notes || ""} className="input-field resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary">
                  {editingClient ? "Update" : "Create"} Client
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingClient(null); }} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted text-[13px] py-12">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-center text-muted text-[13px] py-12">No clients found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="panel hover:border-border-bright transition group">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/8 flex items-center justify-center text-accent text-[13px] font-semibold shrink-0">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight">{client.name}</h3>
                      <p className="text-[12px] text-muted mt-0.5">{client.business}</p>
                    </div>
                  </div>
                  <span className={`badge ${
                    client.status === "active" ? "badge-success" :
                    client.status === "paused" ? "badge-warning" : "badge-danger"
                  }`}>
                    <span className={`status-dot ${client.status}`} />
                    {client.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-[13px] text-muted-foreground mb-4">
                  <p>{client.email}</p>
                  {client.phone && <p>{client.phone}</p>}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <span className="text-[11px] text-muted uppercase tracking-wider">Plan</span>
                    <p className="text-[13px] font-medium text-accent">{client.plan} · ${client.monthlyRate}/mo</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingClient(client); setShowForm(true); }}
                      className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-dim transition cursor-pointer"
                      title="Edit">
                      <IconEdit size={14} />
                    </button>
                    <button onClick={() => handleDelete(client.id)}
                      className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger-dim transition cursor-pointer"
                      title="Delete">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
