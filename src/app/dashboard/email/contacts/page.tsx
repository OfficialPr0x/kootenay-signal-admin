"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconSearch, IconEdit, IconTrash, IconChevronRight,
  IconTag, IconUsers, IconCheck, IconX, IconFilter,
} from "@/components/icons";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  tags: string | null;
  status: string;
  source: string | null;
  pipelineStage: string;
  leadScore: number;
  lastTouchAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  owner: string | null;
  notes: string | null;
  activities: { id: string; type: string; title: string; createdAt: string }[];
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
}

type View = "contacts" | "companies" | "pipeline";

const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "bg-info" },
  { key: "contacted", label: "Contacted", color: "bg-accent" },
  { key: "replied", label: "Replied", color: "bg-warning" },
  { key: "qualified", label: "Qualified", color: "bg-accent" },
  { key: "meeting_booked", label: "Meeting Booked", color: "bg-success" },
  { key: "proposal", label: "Proposal", color: "bg-info" },
  { key: "won", label: "Won", color: "bg-success" },
  { key: "lost", label: "Lost", color: "bg-danger" },
];

const STAGE_STYLES: Record<string, string> = {
  new: "badge-info",
  contacted: "badge-accent",
  replied: "badge-warning",
  qualified: "badge-accent",
  meeting_booked: "badge-success",
  proposal: "badge-info",
  won: "badge-success",
  lost: "badge-danger",
};

function getScoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-muted";
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("contacts");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, coRes] = await Promise.all([
        fetch("/api/email/contacts"),
        fetch("/api/contacts/companies"),
      ]);
      const cData = await cRes.json();
      const coData = await coRes.json();
      setContacts(cData.contacts || []);
      setCompanies(coData.companies || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredContacts = contacts.filter(c => {
    if (stageFilter !== "all" && c.pipelineStage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.email.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q);
    }
    return true;
  });

  async function createContact() {
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail, name: newName || undefined,
          company: newCompany || undefined, phone: newPhone || undefined,
          tags: newTags || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewEmail(""); setNewName(""); setNewCompany(""); setNewPhone(""); setNewTags("");
        fetchData();
      }
    } catch { /* empty */ }
    setSaving(false);
  }

  async function updateStage(id: string, stage: string) {
    await fetch(`/api/email/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage: stage }),
    });
    setContacts(prev => prev.map(c => c.id === id ? { ...c, pipelineStage: stage } : c));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, pipelineStage: stage } : null);
  }

  async function deleteContact(id: string) {
    await fetch(`/api/email/contacts/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    fetchData();
  }

  // Pipeline Kanban view
  if (view === "pipeline") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {(["contacts", "companies", "pipeline"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-[11px] px-3 py-1.5 rounded-md transition cursor-pointer ${view === v ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4" style={{ height: "calc(100vh - 280px)" }}>
          {PIPELINE_STAGES.filter(s => s.key !== "lost").map(stage => {
            const stageContacts = contacts.filter(c => c.pipelineStage === stage.key);
            return (
              <div key={stage.key} className="w-[240px] shrink-0 flex flex-col panel">
                <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-[12px] font-medium text-foreground">{stage.label}</span>
                  <span className="text-[10px] text-muted ml-auto">{stageContacts.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {stageContacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelected(c); setView("contacts"); }}
                      className="w-full text-left p-2.5 rounded-lg bg-card-elevated border border-border hover:border-accent/20 transition cursor-pointer"
                    >
                      <p className="text-[12px] font-medium text-foreground truncate">{c.name || c.email}</p>
                      {c.company && <p className="text-[10px] text-muted truncate mt-0.5">{c.company}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold ${getScoreColor(c.leadScore)}`}>Score: {c.leadScore}</span>
                        {c.lastTouchAt && (
                          <span className="text-[9px] text-muted ml-auto">{new Date(c.lastTouchAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Companies view
  if (view === "companies") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {(["contacts", "companies", "pipeline"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-[11px] px-3 py-1.5 rounded-md transition cursor-pointer ${view === v ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          {companies.length === 0 ? (
            <div className="p-8 text-center text-muted text-[13px]">No companies yet. Companies are auto-created from contact data.</div>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Domain</th>
                  <th>Industry</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(co => (
                  <tr key={co.id}>
                    <td className="font-medium text-foreground">{co.name}</td>
                    <td>{co.domain || "—"}</td>
                    <td>{co.industry || "—"}</td>
                    <td>{co.website || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Contacts list view (default)
  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 240px)" }}>
      {/* Contacts list */}
      <div className={`${selected ? "w-[55%]" : "w-full"} flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {(["contacts", "companies", "pipeline"] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)} className={`text-[11px] px-3 py-1.5 rounded-md transition cursor-pointer ${view === v ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative ml-2">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9 !py-1.5 !text-[11px] w-48" />
            </div>
          </div>
          <div className="flex gap-2">
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="input-field !py-1.5 !text-[11px] !w-auto">
              <option value="all">All Stages</option>
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button onClick={() => setShowCreate(true)} className="btn-primary !text-[11px] !py-1.5 cursor-pointer">
              <IconPlus size={12} /> Add Contact
            </button>
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="panel mb-4 p-4 border-accent/20">
            <h4 className="text-[13px] font-semibold mb-3">New Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email *" className="input-field !text-[12px]" />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="input-field !text-[12px]" />
              <input type="text" value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Company" className="input-field !text-[12px]" />
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" className="input-field !text-[12px]" />
              <input type="text" value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)" className="input-field !text-[12px] col-span-2" />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowCreate(false)} className="btn-ghost !text-[11px] cursor-pointer">Cancel</button>
              <button onClick={createContact} disabled={saving || !newEmail.trim()} className="btn-primary !text-[11px] cursor-pointer">
                {saving ? "..." : "Create"}
              </button>
            </div>
          </div>
        )}

        <div className="panel flex-1 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted text-[13px]">Loading...</div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="brand-table">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Score</th>
                    <th>Last Touch</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(c => (
                    <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer">
                      <td>
                        <p className="font-medium text-foreground">{c.name || c.email}</p>
                        {c.name && <p className="text-[11px] text-muted">{c.email}</p>}
                      </td>
                      <td>{c.company || "—"}</td>
                      <td>
                        <span className={`badge !text-[10px] ${STAGE_STYLES[c.pipelineStage] || "badge-muted"}`}>
                          {c.pipelineStage.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td><span className={`font-semibold ${getScoreColor(c.leadScore)}`}>{c.leadScore}</span></td>
                      <td className="text-muted">{c.lastTouchAt ? new Date(c.lastTouchAt).toLocaleDateString() : "—"}</td>
                      <td className="text-muted">{c.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Contact detail panel */}
      {selected && (
        <div className="w-[45%] panel flex flex-col overflow-y-auto">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">{selected.name || selected.email}</h3>
                {selected.name && <p className="text-[12px] text-muted mt-0.5">{selected.email}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => deleteContact(selected.id)} className="p-1.5 rounded hover:bg-danger/10 cursor-pointer">
                  <IconTrash size={14} className="text-danger" />
                </button>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded hover:bg-card-hover cursor-pointer">
                  <IconX size={14} className="text-muted" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4 flex-1">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider">Phone</span>
                <p className="text-[13px] text-foreground mt-0.5">{selected.phone || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider">Company</span>
                <p className="text-[13px] text-foreground mt-0.5">{selected.company || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider">Source</span>
                <p className="text-[13px] text-foreground mt-0.5">{selected.source || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider">Owner</span>
                <p className="text-[13px] text-foreground mt-0.5">{selected.owner || "Unassigned"}</p>
              </div>
            </div>

            {/* Lead Score */}
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Lead Score</span>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-[24px] font-semibold ${getScoreColor(selected.leadScore)}`}>{selected.leadScore}</span>
                <div className="flex-1 h-2 bg-card-elevated rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${selected.leadScore >= 70 ? "bg-success" : selected.leadScore >= 40 ? "bg-warning" : "bg-muted"}`}
                    style={{ width: `${selected.leadScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Pipeline Stage */}
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Pipeline Stage</span>
              <div className="flex flex-wrap gap-1">
                {PIPELINE_STAGES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => updateStage(selected.id, s.key)}
                    className={`text-[10px] px-2 py-1 rounded-md transition cursor-pointer ${
                      selected.pipelineStage === s.key
                        ? "bg-accent/10 text-accent border border-accent/30"
                        : "text-muted hover:text-foreground border border-border"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {selected.tags && (
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.split(",").map((tag, i) => (
                    <span key={i} className="badge !text-[10px] badge-muted">{tag.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Next Action */}
            {selected.nextAction && (
              <div className="p-3 rounded-lg bg-card-elevated border border-accent/10">
                <span className="text-[10px] text-accent uppercase tracking-wider">Next Action</span>
                <p className="text-[12px] text-foreground mt-1">{selected.nextAction}</p>
                {selected.nextActionAt && (
                  <p className="text-[10px] text-muted mt-0.5">Due: {new Date(selected.nextActionAt).toLocaleDateString()}</p>
                )}
              </div>
            )}

            {/* Notes */}
            {selected.notes && (
              <div>
                <span className="text-[10px] text-muted uppercase tracking-wider block mb-1">Notes</span>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{selected.notes}</p>
              </div>
            )}

            {/* Activity timeline */}
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Activity</span>
              {(!selected.activities || selected.activities.length === 0) ? (
                <p className="text-[12px] text-muted">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {selected.activities.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      <div>
                        <p className="text-[12px] text-foreground">{a.title}</p>
                        <p className="text-[10px] text-muted">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
