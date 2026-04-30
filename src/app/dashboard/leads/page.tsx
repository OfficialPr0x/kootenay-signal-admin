"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconEdit, IconTrash, IconX } from "@/components/icons";

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
const STATUS_STYLES: Record<string, string> = {
  new: "badge-info",
  contacted: "badge-warning",
  qualified: "badge-accent",
  converted: "badge-success",
  lost: "badge-danger",
};

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
    setLeads(Array.isArray(data) ? data : []);
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
      <div className="flex items-center justify-between page-header">
        <div>
          <h2 className="page-title">Leads</h2>
          <p className="page-subtitle">Manage incoming leads and inquiries</p>
        </div>
        <button onClick={() => { setEditingLead(null); setShowForm(true); }} className="btn-primary">
          <IconPlus size={16} />
          Add Lead
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search leads..."
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
                {editingLead ? "Edit Lead" : "Add New Lead"}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingLead(null); }} className="text-muted hover:text-foreground transition cursor-pointer">
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="panel-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Name *</label>
                  <input name="name" required defaultValue={editingLead?.name} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Email *</label>
                  <input name="email" type="email" required defaultValue={editingLead?.email} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Phone</label>
                  <input name="phone" defaultValue={editingLead?.phone || ""} className="input-field" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Business</label>
                  <input name="business" defaultValue={editingLead?.business || ""} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Message</label>
                <textarea name="message" rows={3} defaultValue={editingLead?.message || ""} className="input-field resize-none" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted mb-1.5">Notes</label>
                <textarea name="notes" rows={2} defaultValue={editingLead?.notes || ""} className="input-field resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary">
                  {editingLead ? "Update" : "Create"} Lead
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingLead(null); }} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        {loading ? (
          <p className="px-5 py-12 text-center text-muted text-[13px]">Loading...</p>
        ) : leads.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted text-[13px]">No leads found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="font-medium text-foreground">{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>{lead.business || "\u2014"}</td>
                    <td>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="bg-background border border-border rounded-md px-2 py-1.5 text-[12px] cursor-pointer focus:outline-none focus:border-accent text-muted-foreground"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-muted text-[12px]">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingLead(lead); setShowForm(true); }}
                          className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-dim transition cursor-pointer"
                          title="Edit"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger-dim transition cursor-pointer"
                          title="Delete"
                        >
                          <IconTrash size={14} />
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
