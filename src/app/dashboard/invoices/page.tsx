"use client";

import { useState, useEffect, useCallback } from "react";

interface Client {
  name: string;
  business: string;
  email: string;
}

interface Invoice {
  id: string;
  clientId: string;
  client: Client;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  business: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const fetchInvoices = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchInvoices();
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, [fetchInvoices]);

  async function handleStatusChange(id: string, status: string) {
    const body: Record<string, unknown> = { status };
    if (status === "paid") body.paidAt = new Date().toISOString();
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchInvoices();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    fetchInvoices();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(formData);
    data.amount = parseFloat(data.amount as string);

    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setShowForm(false);
    fetchInvoices();
  }

  const totalPending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-muted text-sm mt-1">
            Paid: ${totalPaid.toLocaleString()} · Pending: ${totalPending.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          + Create Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 mb-6 w-fit">
        {["all", "pending", "paid", "overdue"].map((s) => (
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

      {/* Invoice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Invoice</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Client *</label>
                <select name="clientId" required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent cursor-pointer">
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} – {c.business}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Amount ($) *</label>
                <input name="amount" type="number" step="0.01" required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Due Date *</label>
                <input name="dueDate" type="date" required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer">
                  Create Invoice
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-border text-muted hover:text-foreground rounded-lg text-sm transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="p-8 text-center text-muted">No invoices found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-card-hover transition">
                    <td className="px-6 py-4">
                      <p className="font-medium">{inv.client.name}</p>
                      <p className="text-muted text-xs">{inv.client.business}</p>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium">${inv.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <select
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-accent"
                      >
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="overdue">overdue</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(inv.id)}
                        className="text-danger hover:text-red-300 text-xs cursor-pointer">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
