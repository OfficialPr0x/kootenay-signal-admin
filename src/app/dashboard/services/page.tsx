"use client";

import { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string;
  isActive: boolean;
  isOneOff: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [features, setFeatures] = useState<string[]>([""]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    try {
      const res = await fetch("/api/services");
      const data = await res.json();
      if (!res.ok || data?.error) {
        setSyncResult(`Error loading services: ${data?.error || res.statusText}`);
        setServices([]);
      } else {
        // sort: one-offs first, then by price
        const sorted = (Array.isArray(data) ? data : []).sort((a: Service, b: Service) => {
          if (a.isOneOff !== b.isOneOff) return a.isOneOff ? -1 : 1;
          return a.price - b.price;
        });
        setServices(sorted);
      }
    } catch (e) {
      setSyncResult(`Error: ${e instanceof Error ? e.message : "Network error"}`);
      setServices([]);
    }
    setLoading(false);
  }

  function openForm(service?: Service) {
    if (service) {
      setEditingService(service);
      try {
        setFeatures(JSON.parse(service.features));
      } catch {
        setFeatures([""]);
      }
    } else {
      setEditingService(null);
      setFeatures([""]);
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string),
      features: features.filter(Boolean),
      isActive: formData.get("isActive") === "on",
      isOneOff: formData.get("isOneOff") === "on",
    };

    if (editingService) {
      await fetch(`/api/services/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }

    setShowForm(false);
    setEditingService(null);
    fetchServices();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this service?")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    fetchServices();
  }

  async function handleStripeSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/services/sync-stripe", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (data.error) {
      setSyncResult(`Error: ${data.error}`);
    } else {
      const created = data.results?.filter((r: { status: string }) => r.status === "created").length ?? 0;
      const already = data.results?.filter((r: { status: string }) => r.status === "already_synced").length ?? 0;
      setSyncResult(`✓ ${created} synced to Stripe · ${already} already linked`);
      fetchServices();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between page-header">
        <div>
          <h2 className="page-title">Services</h2>
          <p className="page-subtitle">Manage your service offerings and Stripe products</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStripeSync}
            disabled={syncing}
            className="btn-ghost text-[13px] disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "⚡ Sync to Stripe"}
          </button>
          <button onClick={() => openForm()} className="btn-primary">
            + Add Service
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-[12px] border ${syncResult.startsWith("Error") ? "bg-danger/10 border-danger/30 text-danger" : "bg-success/10 border-success/30 text-success"}`}>
          {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-3 opacity-60 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Service Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingService ? "Edit Service" : "Add Service"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Name *</label>
                <input name="name" required defaultValue={editingService?.name}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Description *</label>
                <textarea name="description" required rows={3} defaultValue={editingService?.description}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Price ($/mo) *</label>
                <input name="price" type="number" step="0.01" required defaultValue={editingService?.price}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Features</label>
                {features.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={f}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[i] = e.target.value;
                        setFeatures(updated);
                      }}
                      placeholder={`Feature ${i + 1}`}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                    />
                    {features.length > 1 && (
                      <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                        className="text-danger text-sm px-2 cursor-pointer">×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setFeatures([...features, ""])}
                  className="text-accent text-xs hover:underline cursor-pointer">+ Add feature</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isActive" id="isActive"
                    defaultChecked={editingService?.isActive !== false}
                    className="rounded accent-accent cursor-pointer" />
                  <label htmlFor="isActive" className="text-sm">Active</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isOneOff" id="isOneOff"
                    defaultChecked={editingService?.isOneOff ?? false}
                    className="rounded accent-accent cursor-pointer" />
                  <label htmlFor="isOneOff" className="text-sm">One-time setup (not monthly)</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer">
                  {editingService ? "Update" : "Create"} Service
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingService(null); }}
                  className="px-4 py-2 border border-border text-muted hover:text-foreground rounded-lg text-sm transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Services Grid */}
      {loading ? (
        <p className="text-center text-muted py-8">Loading...</p>
      ) : services.length === 0 ? (
        <p className="text-center text-muted py-8">No services configured. Add your service offerings.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => {
            let featureList: string[] = [];
            try { featureList = JSON.parse(service.features); } catch { /* empty */ }

            return (
              <div key={service.id} className={`panel p-5 ${!service.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[15px]">{service.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${service.isOneOff ? "text-accent border-accent/30 bg-accent/8" : "text-info border-info/30 bg-info/8"}`}>
                        {service.isOneOff ? "One-time" : "Monthly"}
                      </span>
                      {service.stripePriceId ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border text-success border-success/30 bg-success/8">Stripe ✓</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border text-muted border-border">No Stripe ID</span>
                      )}
                    </div>
                    {!service.isActive && <span className="text-[11px] text-muted">Inactive</span>}
                  </div>
                  <span className="text-accent font-bold font-mono text-[16px] shrink-0 ml-3">
                    ${service.price}{service.isOneOff ? "" : <span className="text-[11px] text-muted font-normal">/mo</span>}
                  </span>
                </div>
                <p className="text-muted text-[12px] mb-3">{service.description}</p>
                {featureList.length > 0 && (
                  <ul className="space-y-1 mb-3">
                    {featureList.map((f, i) => (
                      <li key={i} className="text-[12px] text-muted flex items-center gap-2">
                        <span className="text-accent text-[10px]">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-3 pt-3 border-t border-border">
                  <button onClick={() => openForm(service)}
                    className="text-accent hover:text-accent-hover text-[12px] cursor-pointer">Edit</button>
                  <button onClick={() => handleDelete(service.id)}
                    className="text-danger text-[12px] cursor-pointer">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
