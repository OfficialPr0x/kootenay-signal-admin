"use client";

import { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string;
  isActive: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [features, setFeatures] = useState<string[]>([""]);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Services</h2>
          <p className="text-muted text-sm mt-1">Manage your service offerings</p>
        </div>
        <button
          onClick={() => openForm()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          + Add Service
        </button>
      </div>

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
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isActive" id="isActive"
                  defaultChecked={editingService?.isActive !== false}
                  className="rounded accent-accent cursor-pointer" />
                <label htmlFor="isActive" className="text-sm">Active</label>
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
              <div key={service.id} className={`bg-card border rounded-xl p-6 ${
                service.isActive ? "border-border" : "border-border opacity-60"
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    {!service.isActive && (
                      <span className="text-xs text-muted bg-muted/10 px-2 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <span className="text-accent text-xl font-bold">${service.price}/mo</span>
                </div>
                <p className="text-muted text-sm mb-4">{service.description}</p>
                {featureList.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {featureList.map((f, i) => (
                      <li key={i} className="text-sm text-muted flex items-center gap-2">
                        <span className="text-accent">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button onClick={() => openForm(service)}
                    className="text-accent hover:text-accent-hover text-xs cursor-pointer">Edit</button>
                  <button onClick={() => handleDelete(service.id)}
                    className="text-danger hover:text-red-300 text-xs cursor-pointer">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
