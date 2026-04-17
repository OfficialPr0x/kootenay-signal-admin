"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconSearch, IconPlay, IconPause, IconTrash, IconWorkflow,
  IconCheck, IconX, IconChevronRight, IconClock, IconBrain, IconZap,
} from "@/components/icons";

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: string;
}

interface WorkflowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  condition: string | null;
}

interface WorkflowRun {
  id: string;
  status: string;
  triggeredBy: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trigger: string;
  isActive: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  _count: { runs: number };
  createdAt: string;
}

type View = "list" | "detail" | "create";

const TRIGGER_TYPES = [
  { value: "email_received", label: "Email Received" },
  { value: "reply_received", label: "Reply Received" },
  { value: "no_reply", label: "No Reply After X Days" },
  { value: "link_clicked", label: "Link Clicked" },
  { value: "email_opened", label: "Email Opened" },
  { value: "lead_score_changed", label: "Lead Score Changed" },
  { value: "deal_stage_changed", label: "Deal Stage Changed" },
  { value: "form_submitted", label: "Form Submitted" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Send Email", icon: "mail" },
  { value: "draft_reply", label: "Draft Reply", icon: "edit" },
  { value: "notify_human", label: "Notify Human", icon: "bell" },
  { value: "move_stage", label: "Move Lead Stage", icon: "arrow" },
  { value: "tag_contact", label: "Tag Contact", icon: "tag" },
  { value: "add_to_sequence", label: "Add to Sequence", icon: "list" },
  { value: "stop_campaign", label: "Stop Campaign", icon: "stop" },
  { value: "create_task", label: "Create Task", icon: "check" },
  { value: "ai_classify", label: "AI: Classify Intent", icon: "brain" },
  { value: "ai_summarize", label: "AI: Summarize Thread", icon: "brain" },
  { value: "ai_respond", label: "AI: Write Response", icon: "brain" },
  { value: "ai_score", label: "AI: Score Lead", icon: "brain" },
  { value: "delay", label: "Wait / Delay", icon: "clock" },
  { value: "condition", label: "Condition Branch", icon: "branch" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "badge-muted",
  active: "badge-success",
  paused: "badge-warning",
};

export default function AutomationsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [search, setSearch] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("email_received");
  const [triggerConfig, setTriggerConfig] = useState("{}");
  const [actionNodes, setActionNodes] = useState<{ type: string; label: string; config: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const filtered = workflows.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );

  async function createWorkflow() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const trigger = JSON.stringify({ type: triggerType, config: triggerConfig });
      const nodes = [
        { type: "trigger", label: TRIGGER_TYPES.find(t => t.value === triggerType)?.label || triggerType, config: trigger, posX: 0, posY: 0 },
        ...actionNodes.map((n, i) => ({ ...n, posX: 0, posY: (i + 1) * 120 })),
      ];
      const edges = nodes.slice(1).map((_, i) => ({
        sourceId: `node_${i}`,
        targetId: `node_${i + 1}`,
      }));

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, trigger, nodes, edges }),
      });
      if (res.ok) {
        setView("list");
        setName(""); setDescription(""); setActionNodes([]);
        fetchWorkflows();
      }
    } catch { /* empty */ }
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current, status: !current ? "active" : "paused" }),
    });
    fetchWorkflows();
  }

  async function deleteWorkflow(id: string) {
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    if (selected?.id === id) { setSelected(null); setView("list"); }
    fetchWorkflows();
  }

  function addAction(type: string) {
    const action = ACTION_TYPES.find(a => a.value === type);
    setActionNodes(prev => [...prev, {
      type,
      label: action?.label || type,
      config: "{}",
    }]);
  }

  function removeAction(idx: number) {
    setActionNodes(prev => prev.filter((_, i) => i !== idx));
  }

  // Create view
  if (view === "create") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold">Create Automation</h3>
          <button onClick={() => setView("list")} className="btn-ghost !text-[12px] cursor-pointer"><IconX size={14} /> Cancel</button>
        </div>

        <div className="panel">
          <div className="panel-body space-y-4">
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider block mb-1.5">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="e.g. Auto-reply to leads" />
            </div>
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider block mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field" rows={2} placeholder="What does this workflow do?" />
            </div>

            {/* Trigger */}
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider block mb-1.5">Trigger</label>
              <div className="p-4 bg-card-elevated rounded-lg border border-accent/20">
                <div className="flex items-center gap-2 mb-3">
                  <IconZap size={14} className="text-accent" />
                  <span className="text-[12px] font-medium text-accent">When this happens:</span>
                </div>
                <select
                  value={triggerType}
                  onChange={e => setTriggerType(e.target.value)}
                  className="input-field !text-[12px]"
                >
                  {TRIGGER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-muted uppercase tracking-wider">Actions</label>
              </div>

              {actionNodes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {actionNodes.map((node, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-px h-6 bg-border ml-4" />
                      <div className="flex-1 p-3 bg-card-elevated rounded-lg border border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {node.type.startsWith("ai_") ? (
                            <IconBrain size={14} className="text-accent" />
                          ) : node.type === "delay" ? (
                            <IconClock size={14} className="text-warning" />
                          ) : (
                            <IconCheck size={14} className="text-info" />
                          )}
                          <span className="text-[12px] text-foreground">{node.label}</span>
                        </div>
                        <button onClick={() => removeAction(idx)} className="p-1 rounded hover:bg-danger/10 cursor-pointer">
                          <IconTrash size={12} className="text-danger" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5">
                {ACTION_TYPES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => addAction(a.value)}
                    className="text-left p-2 rounded-md border border-border hover:border-accent/30 hover:bg-card-hover transition text-[11px] text-muted-foreground cursor-pointer"
                  >
                    {a.icon === "brain" && <IconBrain size={12} className="inline mr-1 text-accent" />}
                    {a.icon === "clock" && <IconClock size={12} className="inline mr-1 text-warning" />}
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
            <button onClick={() => setView("list")} className="btn-ghost !text-[12px] cursor-pointer">Cancel</button>
            <button onClick={createWorkflow} disabled={saving || !name.trim()} className="btn-primary !text-[12px] cursor-pointer">
              {saving ? "Creating..." : "Create Automation"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  if (view === "detail" && selected) {
    let parsedTrigger: { type?: string } = {};
    try { parsedTrigger = JSON.parse(selected.trigger); } catch { /* empty */ }

    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setView("list"); setSelected(null); }} className="text-[12px] text-muted hover:text-foreground cursor-pointer">← Back</button>
          <div className="flex gap-2">
            <button
              onClick={() => toggleActive(selected.id, selected.isActive)}
              className={`btn-ghost !text-[12px] cursor-pointer ${selected.isActive ? "!text-warning" : "!text-success"}`}
            >
              {selected.isActive ? <><IconPause size={12} /> Pause</> : <><IconPlay size={12} /> Activate</>}
            </button>
            <button onClick={() => deleteWorkflow(selected.id)} className="btn-danger !text-[12px] cursor-pointer"><IconTrash size={12} /> Delete</button>
          </div>
        </div>

        <div className="panel mb-4">
          <div className="panel-body">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[16px] font-semibold text-foreground">{selected.name}</h3>
              <span className={`badge ${STATUS_STYLES[selected.status] || "badge-muted"}`}>{selected.status}</span>
            </div>
            {selected.description && <p className="text-[13px] text-muted-foreground mb-3">{selected.description}</p>}
            <div className="flex gap-4">
              <div className="p-3 rounded-lg bg-card-elevated flex-1">
                <span className="text-[10px] text-muted uppercase tracking-wider">Trigger</span>
                <p className="text-[13px] text-foreground mt-1">{TRIGGER_TYPES.find(t => t.value === parsedTrigger.type)?.label || parsedTrigger.type || "Unknown"}</p>
              </div>
              <div className="p-3 rounded-lg bg-card-elevated flex-1">
                <span className="text-[10px] text-muted uppercase tracking-wider">Nodes</span>
                <p className="text-[20px] font-semibold text-foreground mt-1">{selected.nodes?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-card-elevated flex-1">
                <span className="text-[10px] text-muted uppercase tracking-wider">Runs</span>
                <p className="text-[20px] font-semibold text-foreground mt-1">{selected._count?.runs || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Visual flow */}
        <div className="panel">
          <div className="panel-header">
            <h4 className="text-[13px] font-semibold">Workflow Flow</h4>
          </div>
          <div className="panel-body">
            {(selected.nodes || []).length === 0 ? (
              <p className="text-[13px] text-muted">No nodes defined</p>
            ) : (
              <div className="space-y-2">
                {selected.nodes.map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                        node.type === "trigger" ? "bg-accent/10 text-accent" :
                        node.type === "ai" ? "bg-info/10 text-info" :
                        node.type === "condition" ? "bg-warning/10 text-warning" :
                        node.type === "delay" ? "bg-muted/20 text-muted-foreground" :
                        "bg-success/10 text-success"
                      }`}>
                        {idx + 1}
                      </div>
                      {idx < selected.nodes.length - 1 && <div className="w-px h-4 bg-border" />}
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-card-elevated border border-border">
                      <div className="flex items-center gap-2">
                        <span className="badge !text-[9px] !px-1.5 badge-muted">{node.type}</span>
                        <span className="text-[12px] font-medium text-foreground">{node.label}</span>
                      </div>
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
          <input type="text" placeholder="Search automations..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 !py-2 !text-[12px] w-64" />
        </div>
        <button onClick={() => setView("create")} className="btn-primary !text-[12px] cursor-pointer">
          <IconPlus size={14} /> New Automation
        </button>
      </div>

      {loading ? (
        <div className="panel p-8 text-center text-muted text-[13px]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <IconWorkflow size={40} className="mx-auto mb-3 text-muted/20" />
          <p className="text-muted text-[13px]">No automations yet</p>
          <p className="text-[11px] text-muted/60 mt-1">Create workflows to automate follow-ups, replies, and CRM actions</p>
          <button onClick={() => setView("create")} className="btn-primary !text-[12px] mt-4 cursor-pointer">
            <IconPlus size={14} /> Create Automation
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => {
            let parsedTrigger: { type?: string } = {};
            try { parsedTrigger = JSON.parse(w.trigger); } catch { /* empty */ }
            return (
              <button
                key={w.id}
                onClick={() => { setSelected(w); setView("detail"); }}
                className="w-full text-left panel p-4 hover:bg-card-hover transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      w.isActive ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                    }`}>
                      <IconWorkflow size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{w.name}</span>
                        <span className={`badge !text-[10px] ${STATUS_STYLES[w.status] || "badge-muted"}`}>{w.status}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        Trigger: {TRIGGER_TYPES.find(t => t.value === parsedTrigger.type)?.label || "Unknown"} · {w.nodes?.length || 0} nodes · {w._count?.runs || 0} runs
                      </p>
                    </div>
                  </div>
                  <IconChevronRight size={14} className="text-muted" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
