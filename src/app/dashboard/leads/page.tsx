"use client";

import { useState, useEffect, useCallback } from "react";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  message: string | null;
  source: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    fetchLeads();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    if (editingLead) {
      await fetch(`/api/leads/${editingLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }

    setShowForm(false);
    setEditingLead(null);
    fetchLeads();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Leads</h2>
          <p className="text-muted text-sm mt-1">Manage incoming leads and inquiries</p>
        </div>
        <button
          onClick={() => { setEditingLead(null); setShowForm(true); }}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          + Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search leads..."
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
                filter === s
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Lead Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingLead ? "Edit Lead" : "Add New Lead"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Name *</label>
                  <input name="name" required defaultValue={editingLead?.name}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Email *</label>
                  <input name="email" type="email" required defaultValue={editingLead?.email}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">Phone</label>
                  <input name="phone" defaultValue={editingLead?.phone || ""}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Business</label>
                  <input name="business" defaultValue={editingLead?.business || ""}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Message</label>
                <textarea name="message" rows={3} defaultValue={editingLead?.message || ""}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Notes</label>
                <textarea name="notes" rows={2} defaultValue={editingLead?.notes || ""}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer">
                  {editingLead ? "Update" : "Create"} Lead
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingLead(null); }}
                  className="px-4 py-2 border border-border text-muted hover:text-foreground rounded-lg text-sm transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted">Loading...</p>
        ) : leads.length === 0 ? (
          <p className="p-8 text-center text-muted">No leads found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Business</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-card-hover transition">
                    <td className="px-6 py-4 font-medium">{lead.name}</td>
                    <td className="px-6 py-4 text-muted">{lead.email}</td>
                    <td className="px-6 py-4 text-muted">{lead.business || "—"}</td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-accent"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingLead(lead); setShowForm(true); }}
                          className="text-accent hover:text-accent-hover text-xs cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="text-danger hover:text-red-300 text-xs cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
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
