"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconTrash, IconX } from "@/components/icons";

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
      <div className="flex items-center justify-between page-header">
        <div>
          <h2 className="page-title">Invoices</h2>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[13px] text-success">Paid: ${totalPaid.toLocaleString()}</span>
            <span className="text-[13px] text-warning">Pending: ${totalPending.toLocaleString()}</span>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <IconPlus size={16} />
          Create Invoice
        </button>
      </div>

      <div className="tab-list w-fit mb-6">
        {["all", "pending", "paid", "overdue"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`tab-item ${filter === s ? "active" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="panel w-full max-w-md fade-in">
            <div className="panel-header">
              <h3 className="text-[15px] font-semibold">Create Invoice</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground transition cursor-pointer">
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="panel-body space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Client *</label>
                <select name="clientId" required className="input-field cursor-pointer">
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} \u2013 {c.business}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Amount ($) *</label>
                <input name="amount" type="number" step="0.01" required className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Due Date *</label>
                <input name="dueDate" type="date" required className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary">Create Invoice</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        {loading ? (
          <p className="px-5 py-12 text-center text-muted text-[13px]">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted text-[13px]">No invoices found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <p className="font-medium text-foreground">{inv.client.name}</p>
                      <p className="text-[11px] text-muted">{inv.client.business}</p>
                    </td>
                    <td className="font-mono font-medium text-foreground">${inv.amount.toLocaleString()}</td>
                    <td>
                      <select
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        className="bg-background border border-border rounded-md px-2 py-1.5 text-[12px] cursor-pointer focus:outline-none focus:border-accent text-muted-foreground"
                      >
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="overdue">overdue</option>
                      </select>
                    </td>
                    <td className="text-muted text-[12px]">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(inv.id)}
                        className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger-dim transition cursor-pointer"
                        title="Delete">
                        <IconTrash size={14} />
                      </button>
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
