"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  IconPlus, IconSearch, IconEdit, IconTrash, IconX, IconSend,
  IconGlobe, IconSparkles, IconBot, IconUpload,
  IconMapPin, IconBuilding, IconRefresh, IconCheck, IconAlert,
  IconChevronRight, IconLink, IconFilter,
} from "@/components/icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  websiteUrl: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  message: string | null;
  source: string;
  status: string;
  notes: string | null;
  analysis: DigitalAnalysis | null;
  pitchDraft: string | null;
  pitchSentAt: string | null;
  createdAt: string;
}

interface DigitalAnalysis {
  websiteStatus: string;
  websiteUrl: string;
  websiteQuality: string;
  websiteNotes: string;
  seoScore: string;
  seoNotes: string;
  googleBusinessProfile: string;
  googleReviewCount: number;
  googleRating: number;
  socialMedia: Record<string, string>;
  socialPresence: string;
  socialNotes: string;
  paidAds: string;
  adsNotes: string;
  painPoints: string[];
  opportunities: string[];
  competitorGap: string;
  estimatedMonthlyAdSpend: string;
  overallScore: number;
  overallGrade: string;
  summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"];
const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-green-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showFindLeads, setShowFindLeads] = useState(false);

  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [pitching, setPitching] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (selectedLead) {
      const refreshed = leads.find((l) => l.id === selectedLead.id);
      if (refreshed) setSelectedLead(refreshed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

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
    if (selectedLead?.id === id) setSelectedLead(null);
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    fetchLeads();
  }

  async function handleAnalyze(lead: Lead) {
    setAnalyzing(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await fetchLeads();
        if (selectedLead?.id === lead.id) setSelectedLead(data.lead);
      }
    } finally { setAnalyzing(null); }
  }

  async function handleDraftPitch(lead: Lead) {
    setPitching(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/pitch`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await fetchLeads();
        if (selectedLead?.id === lead.id) setSelectedLead(data.lead);
      }
    } finally { setPitching(null); }
  }

  async function handleSendPitch(lead: Lead, pitchHtml?: string) {
    if (!confirm(`Send pitch to ${lead.email}?`)) return;
    setSending(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pitchHtml ? { pitchHtml } : {}),
      });
      const data = await res.json();
      if (res.ok) { await fetchLeads(); alert(`Pitch sent to ${lead.email}!`); }
      else alert(`Failed: ${data.error}`);
    } finally { setSending(null); }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
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
    setShowAddForm(false);
    setEditingLead(null);
    fetchLeads();
  }

  return (
    <div className="flex gap-0 h-full">
      {/* ── Main Panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between page-header">
          <div>
            <h2 className="page-title">Leads</h2>
            <p className="page-subtitle">Manage, find, and convert prospects</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} className="btn-ghost flex items-center gap-1.5 text-[13px]">
              <IconUpload size={14} /> Import CSV
            </button>
            <button onClick={() => setShowFindLeads(true)} className="btn-ghost flex items-center gap-1.5 text-[13px]">
              <IconSparkles size={14} /> Find Leads
            </button>
            <button onClick={() => { setEditingLead(null); setShowAddForm(true); }} className="btn-primary">
              <IconPlus size={14} /> Add Lead
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text" placeholder="Search leads..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 text-[13px]"
            />
          </div>
          <div className="tab-list">
            {["all", ...STATUS_OPTIONS].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`tab-item ${filter === s ? "active" : ""}`}>{s}</button>
            ))}
          </div>
          <button onClick={fetchLeads} className="btn-ghost p-2" title="Refresh"><IconRefresh size={14} /></button>
        </div>

        <div className="panel">
          {loading ? (
            <p className="px-5 py-12 text-center text-muted text-[13px]">Loading...</p>
          ) : leads.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <IconFilter size={32} className="text-muted mx-auto mb-3 opacity-40" />
              <p className="text-muted text-[13px]">No leads found</p>
              <p className="text-[12px] text-muted opacity-60 mt-1">Import a CSV or use Find Leads to discover prospects</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="brand-table">
                <thead>
                  <tr>
                    <th>Name / Business</th>
                    <th>Email</th>
                    <th>Industry</th>
                    <th>Status</th>
                    <th>Analysis</th>
                    <th>Pitch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`cursor-pointer ${selectedLead?.id === lead.id ? "bg-accent/5" : ""}`}
                      onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    >
                      <td>
                        <div className="font-medium text-foreground text-[13px]">{lead.name}</div>
                        {lead.business && <div className="text-[11px] text-muted">{lead.business}</div>}
                      </td>
                      <td className="text-[12px]">{lead.email}</td>
                      <td className="text-[12px] text-muted">{lead.industry || "—"}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className="bg-background border border-border rounded-md px-2 py-1.5 text-[12px] cursor-pointer focus:outline-none focus:border-accent text-muted-foreground"
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {lead.analysis ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-bold ${GRADE_COLORS[(lead.analysis as DigitalAnalysis).overallGrade] || "text-muted"}`}>
                              {(lead.analysis as DigitalAnalysis).overallGrade}
                            </span>
                            <span className="text-[11px] text-muted">{(lead.analysis as DigitalAnalysis).overallScore}/100</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAnalyze(lead)}
                            disabled={analyzing === lead.id}
                            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 disabled:opacity-50 transition cursor-pointer"
                          >
                            {analyzing === lead.id ? "Scanning…" : <><IconGlobe size={12} /> Analyze</>}
                          </button>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {lead.pitchSentAt ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <IconCheck size={11} /> Sent
                          </span>
                        ) : lead.pitchDraft ? (
                          <button
                            onClick={() => handleSendPitch(lead)}
                            disabled={sending === lead.id}
                            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 disabled:opacity-50 transition cursor-pointer"
                          >
                            {sending === lead.id ? "Sending…" : <><IconSend size={11} /> Send</>}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDraftPitch(lead)}
                            disabled={pitching === lead.id}
                            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-50 transition cursor-pointer"
                          >
                            {pitching === lead.id ? "Writing…" : <><IconBot size={11} /> Draft Pitch</>}
                          </button>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingLead(lead); setShowAddForm(true); }}
                            className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-dim transition cursor-pointer"
                            title="Edit"
                          >
                            <IconEdit size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger-dim transition cursor-pointer"
                            title="Delete"
                          >
                            <IconTrash size={13} />
                          </button>
                          <button
                            onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                            className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-accent-dim transition cursor-pointer"
                            title="View details"
                          >
                            <IconChevronRight size={13} />
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

      {/* ── Detail Drawer ───────────────────────────────────────── */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          analyzing={analyzing === selectedLead.id}
          pitching={pitching === selectedLead.id}
          sending={sending === selectedLead.id}
          onClose={() => setSelectedLead(null)}
          onAnalyze={() => handleAnalyze(selectedLead)}
          onDraftPitch={() => handleDraftPitch(selectedLead)}
          onSendPitch={(html) => handleSendPitch(selectedLead, html)}
          onEdit={() => { setEditingLead(selectedLead); setShowAddForm(true); }}
          onRefresh={fetchLeads}
        />
      )}

      {showAddForm && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => { setShowAddForm(false); setEditingLead(null); }}
          onSubmit={handleFormSubmit}
        />
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={fetchLeads} />}
      {showFindLeads && <FindLeadsModal onClose={() => setShowFindLeads(false)} onImported={fetchLeads} />}
    </div>
  );
}

// ─── Lead Detail Drawer ───────────────────────────────────────────────────────

function LeadDrawer({
  lead, analyzing, pitching, sending,
  onClose, onAnalyze, onDraftPitch, onSendPitch, onEdit, onRefresh,
}: {
  lead: Lead;
  analyzing: boolean;
  pitching: boolean;
  sending: boolean;
  onClose: () => void;
  onAnalyze: () => void;
  onDraftPitch: () => void;
  onSendPitch: (html?: string) => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const analysis = lead.analysis as DigitalAnalysis | null;
  const [activeTab, setActiveTab] = useState<"info" | "analysis" | "pitch">(
    lead.pitchDraft ? "pitch" : lead.analysis ? "analysis" : "info"
  );
  const [editedPitch, setEditedPitch] = useState(lead.pitchDraft || "");

  useEffect(() => { setEditedPitch(lead.pitchDraft || ""); }, [lead.pitchDraft]);

  return (
    <div className="w-[420px] shrink-0 border-l border-border h-full overflow-y-auto flex flex-col bg-background fade-in">
      <div className="flex items-start justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
        <div>
          <h3 className="font-semibold text-[14px] text-foreground">{lead.name}</h3>
          <p className="text-[12px] text-muted mt-0.5">{lead.business || lead.email}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onEdit} className="p-1.5 text-muted hover:text-accent transition cursor-pointer" title="Edit">
            <IconEdit size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 text-muted hover:text-foreground transition cursor-pointer">
            <IconX size={16} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border px-5">
        {(["info", "analysis", "pitch"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 px-3 text-[12px] font-medium capitalize border-b-2 transition -mb-px ${
              activeTab === tab ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab === "analysis" && analysis && (
              <span className={`mr-1 font-bold ${GRADE_COLORS[analysis.overallGrade] || ""}`}>
                {analysis.overallGrade}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "info" && (
          <div className="space-y-4">
            <InfoRow icon={<IconBuilding size={13} />} label="Business" value={lead.business} />
            <InfoRow icon={<IconFilter size={13} />} label="Industry" value={lead.industry} />
            <InfoRow icon={<IconGlobe size={13} />} label="Website" value={lead.websiteUrl} isLink />
            <InfoRow icon={<IconLink size={13} />} label="LinkedIn" value={lead.linkedinUrl} isLink />
            <InfoRow icon={<IconFilter size={13} />} label="Phone" value={lead.phone} />
            <InfoRow icon={<IconFilter size={13} />} label="Source" value={lead.source} />
            {lead.notes && (
              <div className="bg-surface rounded-lg p-3 text-[12px] text-muted leading-relaxed">{lead.notes}</div>
            )}
            {lead.message && (
              <div>
                <p className="text-[11px] text-muted mb-1 uppercase tracking-wide">Message</p>
                <div className="bg-surface rounded-lg p-3 text-[12px] text-muted leading-relaxed">{lead.message}</div>
              </div>
            )}
            <div className="text-[11px] text-muted">
              Added {new Date(lead.createdAt).toLocaleDateString()}
              {lead.pitchSentAt && <> · Pitched {new Date(lead.pitchSentAt).toLocaleDateString()}</>}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {!analysis && (
                <button onClick={onAnalyze} disabled={analyzing} className="btn-ghost w-full flex items-center justify-center gap-2 text-[13px]">
                  {analyzing ? <><IconRefresh size={14} className="animate-spin" /> Scanning digital footprint…</> : <><IconGlobe size={14} /> Analyze Digital Footprint</>}
                </button>
              )}
              {!lead.pitchDraft && (
                <button onClick={onDraftPitch} disabled={pitching} className="btn-primary w-full flex items-center justify-center gap-2 text-[13px]">
                  {pitching ? <><IconRefresh size={14} className="animate-spin" /> Writing pitch…</> : <><IconBot size={14} /> Draft Pitch with AI</>}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-5">
            {!analysis ? (
              <div className="text-center py-10">
                <IconGlobe size={36} className="text-muted mx-auto mb-3 opacity-40" />
                <p className="text-[13px] text-muted mb-4">No digital analysis yet</p>
                <button onClick={onAnalyze} disabled={analyzing} className="btn-primary flex items-center gap-2 mx-auto">
                  {analyzing ? <><IconRefresh size={14} className="animate-spin" /> Analyzing…</> : <><IconGlobe size={14} /> Run Analysis</>}
                </button>
              </div>
            ) : (
              <>
                <div className="bg-surface rounded-xl p-4 text-center">
                  <div className={`text-5xl font-black ${GRADE_COLORS[analysis.overallGrade] || "text-foreground"}`}>
                    {analysis.overallGrade}
                  </div>
                  <div className="text-[13px] text-muted mt-1">Digital Health Score: {analysis.overallScore}/100</div>
                  <p className="text-[12px] text-muted mt-2 leading-relaxed">{analysis.summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <AnalysisCard label="Website" value={analysis.websiteQuality} sub={analysis.websiteNotes} />
                  <AnalysisCard label="SEO" value={analysis.seoScore} sub={analysis.seoNotes} />
                  <AnalysisCard label="Google Business" value={analysis.googleBusinessProfile} sub={`${analysis.googleReviewCount} reviews · ${analysis.googleRating}★`} />
                  <AnalysisCard label="Social Media" value={analysis.socialPresence} sub={analysis.socialNotes} />
                  <AnalysisCard label="Paid Ads" value={analysis.paidAds} sub={analysis.adsNotes} />
                  <AnalysisCard label="Ad Spend Est." value={analysis.estimatedMonthlyAdSpend} sub="" />
                </div>

                {analysis.socialMedia && Object.values(analysis.socialMedia).some(Boolean) && (
                  <div>
                    <p className="text-[11px] text-muted mb-2 uppercase tracking-wide">Social Profiles</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(analysis.socialMedia).filter(([, url]) => url).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline capitalize">{platform}</a>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.painPoints?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      <IconAlert size={12} className="text-orange-400" /> Pain Points
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.painPoints.map((p, i) => (
                        <li key={i} className="text-[12px] text-muted flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.opportunities?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      <IconCheck size={12} className="text-emerald-400" /> Opportunities
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.opportunities.map((o, i) => (
                        <li key={i} className="text-[12px] text-muted flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">✓</span>{o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.competitorGap && (
                  <div className="bg-surface rounded-lg p-3">
                    <p className="text-[11px] text-muted mb-1 uppercase tracking-wide">Competitor Gap</p>
                    <p className="text-[12px] text-muted leading-relaxed">{analysis.competitorGap}</p>
                  </div>
                )}

                <button
                  onClick={() => { onAnalyze(); onRefresh(); }}
                  disabled={analyzing}
                  className="btn-ghost w-full text-[12px] flex items-center justify-center gap-1.5"
                >
                  <IconRefresh size={12} /> Re-analyze
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === "pitch" && (
          <div className="space-y-4">
            {!lead.pitchDraft ? (
              <div className="text-center py-10">
                <IconBot size={36} className="text-muted mx-auto mb-3 opacity-40" />
                <p className="text-[13px] text-muted mb-2">No pitch drafted yet</p>
                <p className="text-[12px] text-muted opacity-70 mb-4">
                  {!analysis ? "Run an analysis first for a stronger pitch, or draft now" : "Ready to draft based on the analysis"}
                </p>
                <button onClick={onDraftPitch} disabled={pitching} className="btn-primary flex items-center gap-2 mx-auto">
                  {pitching ? <><IconRefresh size={14} className="animate-spin" /> Writing…</> : <><IconBot size={14} /> Draft Pitch with AI</>}
                </button>
              </div>
            ) : (
              <>
                {lead.pitchSentAt && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-[12px] text-emerald-400">
                    <IconCheck size={13} /> Sent {new Date(lead.pitchSentAt).toLocaleDateString()}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wide mb-2">
                    Pitch Email (editable)
                  </label>
                  <textarea
                    value={editedPitch}
                    onChange={(e) => setEditedPitch(e.target.value)}
                    className="input-field resize-none font-mono text-[11px] leading-relaxed"
                    rows={16}
                  />
                </div>

                <details className="border border-border rounded-lg overflow-hidden">
                  <summary className="px-4 py-2.5 text-[12px] text-muted cursor-pointer hover:text-foreground transition">
                    Preview rendered email
                  </summary>
                  <div
                    className="p-4 bg-white text-black text-[13px]"
                    dangerouslySetInnerHTML={{ __html: editedPitch }}
                  />
                </details>

                <div className="flex gap-2 pt-1">
                  {!lead.pitchSentAt && (
                    <button
                      onClick={() => onSendPitch(editedPitch)}
                      disabled={sending}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 text-[13px]"
                    >
                      {sending ? <><IconRefresh size={14} className="animate-spin" /> Sending…</> : <><IconSend size={14} /> Send Pitch</>}
                    </button>
                  )}
                  <button
                    onClick={onDraftPitch}
                    disabled={pitching}
                    className="btn-ghost flex items-center gap-1.5 text-[12px]"
                  >
                    {pitching ? <IconRefresh size={13} className="animate-spin" /> : <IconRefresh size={13} />}
                    Re-draft
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add/Edit Lead Form Modal ─────────────────────────────────────────────────

function LeadFormModal({
  lead, onClose, onSubmit,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="panel w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="panel-header">
          <h3 className="text-[15px] font-semibold">{lead ? "Edit Lead" : "Add Lead"}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition cursor-pointer">
            <IconX size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="panel-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Name *</label>
              <input name="name" required defaultValue={lead?.name} className="input-field" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Email *</label>
              <input name="email" type="email" required defaultValue={lead?.email} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Phone</label>
              <input name="phone" defaultValue={lead?.phone || ""} className="input-field" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Business</label>
              <input name="business" defaultValue={lead?.business || ""} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Website</label>
              <input name="websiteUrl" type="url" placeholder="https://" defaultValue={lead?.websiteUrl || ""} className="input-field" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1.5">Industry</label>
              <input name="industry" defaultValue={lead?.industry || ""} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-muted mb-1.5">LinkedIn URL</label>
            <input name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/..." defaultValue={lead?.linkedinUrl || ""} className="input-field" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-muted mb-1.5">Notes</label>
            <textarea name="notes" rows={2} defaultValue={lead?.notes || ""} className="input-field resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">{lead ? "Update" : "Create"} Lead</button>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<"upload" | "parsing" | "preview" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MappedLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleParse() {
    if (!file) return;
    setStep("parsing");
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/leads/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to parse CSV");
      setStep("upload");
      return;
    }
    const leads: MappedLead[] = data.preview ?? [];
    setPreview(leads);
    setSelected(new Set(leads.map((_, i) => i)));
    setStep("preview");
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setSaving(true);
    const toSave = preview.filter((_, i) => selected.has(i)).map((l) => ({ ...l, source: "csv_import" }));
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Save failed"); return; }
    setSavedCount(data.imported ?? toSave.length);
    setStep("done");
    onImported();
  }

  function handleFile(f: File) {
    if (f.name.endsWith(".csv") || f.type === "text/csv") {
      setFile(f);
      setError("");
    } else {
      setError("File must be a .csv");
    }
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in">
        <div className="panel-header">
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><IconUpload size={16} /> Import CSV</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition cursor-pointer"><IconX size={18} /></button>
        </div>
        <div className="panel-body space-y-4">

          {/* ── Step: done ── */}
          {step === "done" && (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl font-black text-emerald-400">{savedCount}</div>
              <p className="text-[13px] text-muted">leads added to your pipeline</p>
              <button onClick={onClose} className="btn-primary mx-auto">Done</button>
            </div>
          )}

          {/* ── Step: upload ── */}
          {step === "upload" && (
            <>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition cursor-pointer ${dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
              >
                <IconUpload size={32} className="mx-auto mb-3 text-muted opacity-40" />
                {file ? (
                  <>
                    <p className="text-[14px] font-medium text-accent">{file.name}</p>
                    <p className="text-[11px] text-muted mt-1 opacity-60">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-muted">Drop your CSV here or click to browse</p>
                    <p className="text-[11px] text-muted mt-1.5 opacity-50">Any column layout — AI will map it automatically</p>
                  </>
                )}
              </div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {error && <p className="text-[12px] text-danger flex items-center gap-1.5"><IconAlert size={13} /> {error}</p>}
              <div className="flex gap-3">
                <button onClick={handleParse} disabled={!file} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <IconSparkles size={14} /> Parse with AI
                </button>
                <button onClick={onClose} className="btn-ghost">Cancel</button>
              </div>
            </>
          )}

          {/* ── Step: parsing ── */}
          {step === "parsing" && (
            <div className="text-center py-12 space-y-4">
              <IconRefresh size={28} className="mx-auto text-accent animate-spin" />
              <p className="text-[14px] font-medium">Reading your CSV…</p>
              <p className="text-[12px] text-muted">AI is mapping columns and extracting lead data</p>
            </div>
          )}

          {/* ── Step: preview ── */}
          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium">{preview.length} leads found in <span className="text-accent">{file?.name}</span></p>
                <div className="flex gap-2">
                  <button onClick={() => setSelected(new Set(preview.map((_, i) => i)))} className="text-[11px] text-accent hover:underline cursor-pointer">Select all</button>
                  <span className="text-muted">·</span>
                  <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:underline cursor-pointer">Deselect all</button>
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {preview.map((lead, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${selected.has(i) ? "border-accent/50 bg-accent/5" : "border-border hover:border-border/80"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(i) : next.delete(i);
                        setSelected(next);
                      }}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[13px]">{lead.business || lead.name || "—"}</span>
                        {lead.name && lead.business && <span className="text-[11px] text-muted">{lead.name}</span>}
                        {lead.industry && <span className="text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded">{lead.industry}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {lead.email && <span className="text-[11px] text-muted">{lead.email}</span>}
                        {lead.phone && <span className="text-[11px] text-muted">{lead.phone}</span>}
                        {lead.websiteUrl && (
                          <a href={lead.websiteUrl.startsWith("http") ? lead.websiteUrl : `https://${lead.websiteUrl}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-accent hover:underline truncate max-w-[180px]"
                            onClick={(e) => e.stopPropagation()}>
                            {lead.websiteUrl}
                          </a>
                        )}
                      </div>
                      {lead.notes && <p className="text-[11px] text-muted mt-0.5 leading-relaxed line-clamp-1">{lead.notes}</p>}
                    </div>
                  </label>
                ))}
              </div>

              {error && <p className="text-[12px] text-danger flex items-center gap-1.5"><IconAlert size={13} /> {error}</p>}

              <div className="flex gap-3 border-t border-border pt-3">
                <button
                  onClick={handleImport}
                  disabled={saving || selected.size === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><IconRefresh size={14} className="animate-spin" /> Saving…</>
                    : <>Import {selected.size} lead{selected.size !== 1 ? "s" : ""}</>}
                </button>
                <button onClick={() => { setStep("upload"); setPreview([]); setSelected(new Set()); }} className="btn-ghost">Back</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Find Leads Modal ─────────────────────────────────────────────────────────

interface MappedLead {
  name: string;
  email: string;
  phone: string;
  business: string;
  websiteUrl: string;
  industry: string;
  linkedinUrl: string;
  notes: string;
}

interface FoundLead {
  name: string;
  email: string;
  phone: string;
  business: string;
  websiteUrl: string;
  industry: string;
  linkedinUrl: string;
  notes: string;
  source: string;
}

function FindLeadsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [form, setForm] = useState({ industry: "", location: "Kootenays, BC", keywords: "", count: "10" });
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  async function handleSearch() {
    setSearching(true);
    setError("");
    setResults([]);
    setSelected(new Set());
    const res = await fetch("/api/leads/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, count: Number(form.count) }),
    });
    const data = await res.json();
    setSearching(false);
    if (!res.ok) { setError(data.error || "Search failed"); return; }
    const leads: FoundLead[] = Array.isArray(data.leads) ? data.leads : [];
    setResults(leads);
    setSelected(new Set(leads.map((_, i) => i)));
  }

  async function handleSaveSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    const toSave = results.filter((_, i) => selected.has(i));
    await Promise.all(
      toSave.map((l) =>
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...l, source: "ai_prospecting" }),
        })
      )
    );
    setSavedCount(toSave.length);
    setSaving(false);
    setDone(true);
    onImported();
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in">
        <div className="panel-header">
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><IconSparkles size={16} /> Find New Leads with AI</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition cursor-pointer"><IconX size={18} /></button>
        </div>
        <div className="panel-body space-y-4">
          {done ? (
            <div className="text-center py-8">
              <div className="text-4xl font-black text-emerald-400">{savedCount}</div>
              <p className="text-[13px] text-muted mt-2">leads saved to your pipeline</p>
              <button onClick={onClose} className="btn-primary mx-auto mt-4">Done</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5 flex items-center gap-1.5">
                    <IconBuilding size={12} /> Industry / Business Type
                  </label>
                  <input
                    placeholder="e.g. restaurants, plumbers, real estate..."
                    value={form.industry}
                    onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5 flex items-center gap-1.5">
                    <IconMapPin size={12} /> Location
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Keywords / Signals</label>
                  <input
                    placeholder="e.g. no website, bad reviews, new business..."
                    value={form.keywords}
                    onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Number of leads</label>
                  <select value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} className="input-field">
                    {["5", "10", "15", "20"].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {error && <p className="text-[12px] text-danger flex items-center gap-1.5"><IconAlert size={13} /> {error}</p>}

              <button
                onClick={handleSearch}
                disabled={searching || (!form.industry && !form.keywords)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {searching
                  ? <><IconRefresh size={14} className="animate-spin" /> Searching the web with Gemini AI…</>
                  : <><IconSparkles size={14} /> Find Leads</>}
              </button>

              {results.length > 0 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium">{results.length} leads found</p>
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(new Set(results.map((_, i) => i)))} className="text-[11px] text-accent hover:underline cursor-pointer">Select all</button>
                      <span className="text-muted">·</span>
                      <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:underline cursor-pointer">Deselect all</button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {results.map((lead, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${selected.has(i) ? "border-accent/50 bg-accent/5" : "border-border hover:border-border/80"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(i) : next.delete(i);
                            setSelected(next);
                          }}
                          className="mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[13px]">{lead.business || lead.name}</span>
                            {lead.industry && <span className="text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded">{lead.industry}</span>}
                          </div>
                          {lead.email && <div className="text-[11px] text-muted mt-0.5">{lead.email}</div>}
                          {lead.websiteUrl && (
                            <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                              {lead.websiteUrl}
                            </a>
                          )}
                          {lead.notes && <p className="text-[11px] text-muted mt-1 leading-relaxed">{lead.notes}</p>}
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveSelected}
                    disabled={saving || selected.size === 0}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {saving
                      ? <><IconRefresh size={14} className="animate-spin" /> Saving…</>
                      : <>Import {selected.size} selected lead{selected.size !== 1 ? "s" : ""}</>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, isLink }: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        {isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent hover:underline break-all">{value}</a>
        ) : (
          <p className="text-[12px] text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

const QUALITY_COLORS: Record<string, string> = {
  strong: "text-emerald-400", verified: "text-emerald-400", active: "text-emerald-400", has_website: "text-emerald-400",
  moderate: "text-yellow-400", unverified: "text-yellow-400",
  weak: "text-orange-400", inactive: "text-orange-400",
  none: "text-red-400", missing: "text-red-400", no_website: "text-red-400", broken: "text-red-400",
  unknown: "text-muted",
};

function AnalysisCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <p className="text-[11px] text-muted mb-1">{label}</p>
      <p className={`text-[12px] font-semibold capitalize ${QUALITY_COLORS[value] || "text-foreground"}`}>
        {value?.replace(/_/g, " ") || "—"}
      </p>
      {sub && <p className="text-[11px] text-muted mt-1 leading-relaxed">{sub}</p>}
    </div>
  );
}
