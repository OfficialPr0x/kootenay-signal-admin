"use client";

import { useState, useEffect, useCallback } from "react";

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Clients</h2>
          <p className="text-muted text-sm mt-1">
            {clients.filter((c) => c.status === "active").length} active clients · ${totalMRR.toLocaleString()}/mo MRR
          </p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setShowForm(true); }}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          + Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
        />
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === s ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingClient ? "Edit Client" : "Add New Client"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Name *</label>
                  <input name="name" required defaultValue={editingClient?.name}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Email *</label>
                  <input name="email" type="email" required defaultValue={editingClient?.email}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Business *</label>
                  <input name="business" required defaultValue={editingClient?.business}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Phone</label>
                  <input name="phone" defaultValue={editingClient?.phone || ""}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Website</label>
                  <input name="website" defaultValue={editingClient?.website || ""}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Plan</label>
                  <select name="plan" defaultValue={editingClient?.plan || "SignalCore"}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent cursor-pointer">
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Monthly Rate ($)</label>
                  <input name="monthlyRate" type="number" step="0.01" defaultValue={editingClient?.monthlyRate || 0}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Status</label>
                  <select name="status" defaultValue={editingClient?.status || "active"}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent cursor-pointer">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Notes</label>
                <textarea name="notes" rows={3} defaultValue={editingClient?.notes || ""}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer">
                  {editingClient ? "Update" : "Create"} Client
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingClient(null); }}
                  className="px-4 py-2 border border-border text-muted hover:text-foreground rounded-lg text-sm transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients Grid */}
      {loading ? (
        <p className="text-center text-muted py-8">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-center text-muted py-8">No clients found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="bg-card border border-border rounded-xl p-6 hover:border-accent/30 transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{client.name}</h3>
                  <p className="text-muted text-sm">{client.business}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  client.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  client.status === "paused" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {client.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted mb-4">
                <p>{client.email}</p>
                {client.phone && <p>{client.phone}</p>}
                <p className="text-accent font-medium">{client.plan} · ${client.monthlyRate}/mo</p>
              </div>
              <div className="flex gap-2 pt-3 border-t border-border">
                <button onClick={() => { setEditingClient(client); setShowForm(true); }}
                  className="text-accent hover:text-accent-hover text-xs cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(client.id)}
                  className="text-danger hover:text-red-300 text-xs cursor-pointer">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
