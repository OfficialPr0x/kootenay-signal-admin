"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconSearch, IconPlay, IconPause, IconCheck, IconX,
  IconEdit, IconTrash, IconChevronRight, IconClock, IconUsers,
} from "@/components/icons";

interface CampaignStep {
  id: string;
  stepOrder: number;
  subject: string;
  bodyHtml: string;
  delayDays: number;
  sendCondition: string | null;
  aiPersonalize: boolean;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  subject: string | null;
  bodyHtml: string | null;
  tags: string | null;
  sendWindow: string | null;
  throttle: number | null;
  stopOnReply: boolean;
  stopOnBounce: boolean;
  steps: CampaignStep[];
  _count: { messages: number; contacts: number };
  createdAt: string;
}

type View = "list" | "detail" | "create";

const STATUS_STYLES: Record<string, string> = {
  draft: "badge-muted",
  active: "badge-success",
  paused: "badge-warning",
  completed: "badge-info",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnBounce, setStopOnBounce] = useState(true);
  const [steps, setSteps] = useState<{ subject: string; bodyHtml: string; delayDays: number }[]>([
    { subject: "", bodyHtml: "", delayDays: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const filtered = campaigns.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function createCampaign() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, stopOnReply, stopOnBounce,
          steps: steps.filter(s => s.subject.trim()),
        }),
      });
      if (res.ok) {
        setView("list");
        setName(""); setDescription(""); setSteps([{ subject: "", bodyHtml: "", delayDays: 0 }]);
        fetchCampaigns();
      }
    } catch { /* empty */ }
    setSaving(false);
  }

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === "active" ? "paused" : "active";
    await fetch(`/api/email/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchCampaigns();
  }

  async function deleteCampaign(id: string) {
    await fetch(`/api/email/campaigns/${id}`, { method: "DELETE" });
    if (selected?.id === id) { setSelected(null); setView("list"); }
    fetchCampaigns();
  }

  function addStep() {
    setSteps(prev => [...prev, { subject: "", bodyHtml: "", delayDays: prev.length * 2 }]);
  }

  function updateStep(idx: number, field: string, value: string | number) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function removeStep(idx: number) {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
  }

  // Create view
  if (view === "create") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold">Create Campaign</h3>
          <button onClick={() => setView("list")} className="btn-ghost !text-[12px] cursor-pointer"><IconX size={14} /> Cancel</button>
        </div>

        <div className="panel">
          <div className="panel-body space-y-4">
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider block mb-1.5">Campaign Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="e.g. Q2 Outreach" />
            </div>
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider block mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field" rows={2} placeholder="Campaign goals..." />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={stopOnReply} onChange={e => setStopOnReply(e.target.checked)} className="accent-accent" />
                Stop on reply
              </label>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={stopOnBounce} onChange={e => setStopOnBounce(e.target.checked)} className="accent-accent" />
                Stop on bounce
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] text-muted uppercase tracking-wider">Sequence Steps</label>
                <button onClick={addStep} className="btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer"><IconPlus size={12} /> Add Step</button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="p-4 bg-card-elevated rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] font-medium text-foreground">Step {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {idx > 0 && (
                          <div className="flex items-center gap-1">
                            <IconClock size={12} className="text-muted" />
                            <span className="text-[11px] text-muted">Delay:</span>
                            <input
                              type="number"
                              value={step.delayDays}
                              onChange={e => updateStep(idx, "delayDays", parseInt(e.target.value) || 0)}
                              className="input-field !w-14 !py-1 !px-2 !text-[11px] text-center"
                              min={0}
                            />
                            <span className="text-[11px] text-muted">days</span>
                          </div>
                        )}
                        {steps.length > 1 && (
                          <button onClick={() => removeStep(idx)} className="p-1 rounded hover:bg-danger/10 cursor-pointer">
                            <IconTrash size={12} className="text-danger" />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={step.subject}
                      onChange={e => updateStep(idx, "subject", e.target.value)}
                      placeholder="Subject line"
                      className="input-field !text-[12px] mb-2"
                    />
                    <textarea
                      value={step.bodyHtml}
                      onChange={e => updateStep(idx, "bodyHtml", e.target.value)}
                      placeholder="Email body..."
                      className="input-field !text-[12px]"
                      rows={4}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
            <button onClick={() => setView("list")} className="btn-ghost !text-[12px] cursor-pointer">Cancel</button>
            <button onClick={createCampaign} disabled={saving || !name.trim()} className="btn-primary !text-[12px] cursor-pointer">
              {saving ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  if (view === "detail" && selected) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setView("list"); setSelected(null); }} className="text-[12px] text-muted hover:text-foreground cursor-pointer">← Back to Campaigns</button>
          <div className="flex gap-2">
            <button onClick={() => toggleStatus(selected.id, selected.status)}
              className={`btn-ghost !text-[12px] cursor-pointer ${selected.status === "active" ? "!text-warning" : "!text-success"}`}>
              {selected.status === "active" ? <><IconPause size={12} /> Pause</> : <><IconPlay size={12} /> Activate</>}
            </button>
            <button onClick={() => deleteCampaign(selected.id)} className="btn-danger !text-[12px] cursor-pointer"><IconTrash size={12} /> Delete</button>
          </div>
        </div>

        <div className="panel mb-4">
          <div className="panel-body">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-[16px] font-semibold text-foreground">{selected.name}</h3>
              <span className={`badge ${STATUS_STYLES[selected.status] || "badge-muted"}`}>{selected.status}</span>
            </div>
            {selected.description && <p className="text-[13px] text-muted-foreground mb-4">{selected.description}</p>}

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-card-elevated">
                <span className="text-[10px] text-muted uppercase tracking-wider">Contacts</span>
                <p className="text-[20px] font-semibold text-foreground mt-1">{selected._count?.contacts || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-card-elevated">
                <span className="text-[10px] text-muted uppercase tracking-wider">Emails Sent</span>
                <p className="text-[20px] font-semibold text-foreground mt-1">{selected._count?.messages || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-card-elevated">
                <span className="text-[10px] text-muted uppercase tracking-wider">Steps</span>
                <p className="text-[20px] font-semibold text-foreground mt-1">{selected.steps?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sequence Timeline */}
        <div className="panel">
          <div className="panel-header">
            <h4 className="text-[13px] font-semibold">Sequence Steps</h4>
          </div>
          <div className="panel-body">
            {(selected.steps || []).length === 0 ? (
              <p className="text-[13px] text-muted">No steps defined</p>
            ) : (
              <div className="space-y-3">
                {selected.steps.map((step, idx) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {idx + 1}
                      </div>
                      {idx < selected.steps.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-card-elevated border border-border mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{step.subject}</span>
                        {step.delayDays > 0 && (
                          <span className="badge !text-[10px] badge-muted"><IconClock size={10} /> {step.delayDays}d delay</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {step.bodyHtml.replace(/<[^>]+>/g, "").slice(0, 120)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 !py-2 !text-[12px] w-64"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {["all", "draft", "active", "paused", "completed"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === s ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setView("create")} className="btn-primary !text-[12px] cursor-pointer">
            <IconPlus size={14} /> New Campaign
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel p-8 text-center text-muted text-[13px]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-muted text-[13px]">No campaigns yet</p>
          <button onClick={() => setView("create")} className="btn-primary !text-[12px] mt-3 cursor-pointer">
            <IconPlus size={14} /> Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelected(c); setView("detail"); }}
              className="w-full text-left panel p-4 hover:bg-card-hover transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <IconCampaign size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{c.name}</span>
                      <span className={`badge !text-[10px] ${STATUS_STYLES[c.status] || "badge-muted"}`}>{c.status}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      {c.steps?.length || 0} steps · {c._count?.contacts || 0} contacts · {c._count?.messages || 0} sent
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">{new Date(c.createdAt).toLocaleDateString()}</span>
                  <IconChevronRight size={14} className="text-muted" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconCampaign({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
