"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  IconPlus, IconSearch, IconEdit, IconTrash, IconX, IconSend,
  IconGlobe, IconSparkles, IconBot, IconUpload,
  IconMapPin, IconBuilding, IconRefresh, IconCheck, IconAlert,
  IconLink, IconFilter, IconEye, IconZap, IconClock,
  IconChevronDown, IconMail, IconPhone,
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

const STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  new:       { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/25",         dot: "bg-blue-400",     label: "New" },
  contacted: { badge: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25",   dot: "bg-yellow-400",   label: "Contacted" },
  qualified: { badge: "bg-accent/15 text-accent border border-accent/25",               dot: "bg-accent",       label: "Qualified" },
  converted: { badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", dot: "bg-emerald-400", label: "Converted" },
  lost:      { badge: "bg-red-500/15 text-red-400 border border-red-500/25",            dot: "bg-red-400",      label: "Lost" },
};

const GRADE_CONFIG: Record<string, { color: string; bg: string; ring: string }> = {
  A: { color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  B: { color: "text-green-400",   bg: "bg-green-500/10",   ring: "ring-green-500/30" },
  C: { color: "text-yellow-400",  bg: "bg-yellow-500/10",  ring: "ring-yellow-500/30" },
  D: { color: "text-orange-400",  bg: "bg-orange-500/10",  ring: "ring-orange-500/30" },
  F: { color: "text-red-400",     bg: "bg-red-500/10",     ring: "ring-red-500/30" },
};

const AVATAR_GRADIENTS = [
  "from-accent to-orange-600",
  "from-blue-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-purple-500 to-purple-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-700",
];

function getGradient(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initials(name: string, business: string | null) {
  const s = business || name;
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

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

  // Pipeline counts
  const allLeads = leads;
  const counts = allLeads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      {/* ── Main Panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
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
            <button
              onClick={() => { setEditingLead(null); setShowAddForm(true); }}
              className="btn-primary flex items-center gap-1.5"
            >
              <IconPlus size={14} /> Add Lead
            </button>
          </div>
        </div>

        {/* Pipeline Stats Bar */}
        <div className="grid grid-cols-5 gap-3 mb-5 shrink-0">
          {STATUS_OPTIONS.map((s) => {
            const st = STATUS_STYLE[s];
            const cnt = counts[s] || 0;
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(isActive ? "all" : s)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  isActive
                    ? "bg-accent/10 border-accent/40"
                    : "bg-surface/50 border-border hover:border-border/80 hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? "text-accent" : "text-muted"}`}>
                    {s}
                  </span>
                </div>
                <div className={`text-2xl font-black ${isActive ? "text-accent" : "text-foreground"}`}>{cnt}</div>
              </button>
            );
          })}
        </div>

        {/* Search + filter row */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search leads, businesses, emails…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 text-[13px]"
            />
          </div>
          <button
            onClick={() => setFilter("all")}
            className={`text-[12px] px-3 py-2 rounded-lg border transition ${
              filter === "all" ? "bg-foreground/10 border-border text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            All ({allLeads.length})
          </button>
          <button onClick={fetchLeads} className="p-2 text-muted hover:text-foreground transition" title="Refresh">
            <IconRefresh size={14} />
          </button>
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <IconRefresh size={20} className="text-muted animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 panel rounded-2xl">
              <IconFilter size={36} className="text-muted mb-3 opacity-25" />
              <p className="text-[14px] font-medium text-muted">No leads found</p>
              <p className="text-[12px] text-muted opacity-60 mt-1">Import a CSV or use Find Leads to discover prospects</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowImport(true)} className="btn-ghost text-[13px] flex items-center gap-1.5">
                  <IconUpload size={13} /> Import CSV
                </button>
                <button onClick={() => setShowFindLeads(true)} className="btn-primary text-[13px] flex items-center gap-1.5">
                  <IconSparkles size={13} /> Find Leads
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedLead?.id === lead.id}
                  isAnalyzing={analyzing === lead.id}
                  isPitching={pitching === lead.id}
                  isSending={sending === lead.id}
                  onSelect={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                  onStatusChange={(s) => handleStatusChange(lead.id, s)}
                  onAnalyze={() => handleAnalyze(lead)}
                  onDraftPitch={() => handleDraftPitch(lead)}
                  onSendPitch={() => handleSendPitch(lead)}
                  onEdit={() => { setEditingLead(lead); setShowAddForm(true); }}
                  onDelete={() => handleDelete(lead.id)}
                />
              ))}
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

// ─── Lead Row ────────────────────────────────────────────────────────────────

function LeadRow({
  lead, isSelected, isAnalyzing, isPitching, isSending,
  onSelect, onStatusChange, onAnalyze, onDraftPitch, onSendPitch, onEdit, onDelete,
}: {
  lead: Lead;
  isSelected: boolean;
  isAnalyzing: boolean;
  isPitching: boolean;
  isSending: boolean;
  onSelect: () => void;
  onStatusChange: (s: string) => void;
  onAnalyze: () => void;
  onDraftPitch: () => void;
  onSendPitch: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const analysis = lead.analysis as DigitalAnalysis | null;
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const st = STATUS_STYLE[lead.status] || STATUS_STYLE.new;
  const grade = analysis ? GRADE_CONFIG[analysis.overallGrade] : null;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
    }
    if (showStatusMenu) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showStatusMenu]);

  return (
    <div
      className={`group relative rounded-xl border transition cursor-pointer ${
        isSelected
          ? "border-accent/50 bg-accent/5 shadow-sm shadow-accent/10"
          : "border-border bg-surface/30 hover:border-border/80 hover:bg-surface/60"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradient(lead.business || lead.name)} flex items-center justify-center shrink-0`}>
          <span className="text-white font-bold text-[13px]">{initials(lead.name, lead.business)}</span>
        </div>

        {/* Name + details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-foreground leading-tight">
              {lead.business || lead.name}
            </span>
            {lead.business && lead.name !== lead.business && (
              <span className="text-[12px] text-muted">{lead.name}</span>
            )}
            {lead.industry && (
              <span className="text-[11px] text-muted bg-background/60 border border-border px-1.5 py-0.5 rounded-md">
                {lead.industry}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {lead.email && (
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <IconMail size={10} /> {lead.email}
              </span>
            )}
            {lead.phone && (
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <IconPhone size={10} /> {lead.phone}
              </span>
            )}
            {lead.websiteUrl && (
              <a
                href={lead.websiteUrl.startsWith("http") ? lead.websiteUrl : `https://${lead.websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <IconGlobe size={10} /> {lead.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            )}
            <span className="text-[10px] text-muted/60">{timeAgo(lead.createdAt)}</span>
          </div>
        </div>

        {/* Grade badge */}
        {grade && analysis ? (
          <div className={`w-9 h-9 rounded-lg ring-1 ${grade.bg} ${grade.ring} flex flex-col items-center justify-center shrink-0`}>
            <span className={`text-[14px] font-black ${grade.color}`}>{analysis.overallGrade}</span>
            <span className="text-[8px] text-muted leading-none">{analysis.overallScore}</span>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
            disabled={isAnalyzing}
            className="w-9 h-9 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0 text-muted hover:border-accent/50 hover:text-accent transition"
            title="Analyze digital footprint"
          >
            {isAnalyzing ? <IconRefresh size={13} className="animate-spin" /> : <IconGlobe size={13} />}
          </button>
        )}

        {/* Pitch status */}
        <div className="shrink-0 w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
          {lead.pitchSentAt ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <IconCheck size={11} /> Sent
            </span>
          ) : lead.pitchDraft ? (
            <button
              onClick={onSendPitch}
              disabled={isSending}
              className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 font-medium transition"
            >
              {isSending
                ? <><IconRefresh size={11} className="animate-spin" /> Sending…</>
                : <><IconSend size={11} /> Send</>}
            </button>
          ) : (
            <button
              onClick={onDraftPitch}
              disabled={isPitching}
              className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium transition"
            >
              {isPitching
                ? <><IconRefresh size={11} className="animate-spin" /> Writing…</>
                : <><IconBot size={11} /> Draft</>}
            </button>
          )}
        </div>

        {/* Status badge with dropdown */}
        <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowStatusMenu((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${st.badge}`}
          >
            {st.label} <IconChevronDown size={10} />
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-36 panel py-1 shadow-xl fade-in rounded-xl">
              {STATUS_OPTIONS.map((s) => {
                const ss = STATUS_STYLE[s];
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-surface transition ${
                      lead.status === s ? "text-foreground" : "text-muted"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ss.dot}`} />
                    {ss.label}
                    {lead.status === s && <IconCheck size={11} className="ml-auto text-accent" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
            title="Edit"
          >
            <IconEdit size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
            title="Delete"
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pitch Email Status ───────────────────────────────────────────────────────

const PITCH_STATUS_CONFIG: Record<string, { label: string; className: string; border: string }> = {
  sent:      { label: "Sent",      className: "text-muted",       border: "border-border" },
  delivered: { label: "Delivered", className: "text-blue-400",    border: "border-blue-500/30" },
  opened:    { label: "Opened",    className: "text-yellow-400",  border: "border-yellow-500/30" },
  clicked:   { label: "Clicked",   className: "text-emerald-400", border: "border-emerald-500/30" },
  bounced:   { label: "Bounced",   className: "text-red-400",     border: "border-red-500/30" },
  failed:    { label: "Failed",    className: "text-red-400",     border: "border-red-500/30" },
};

interface PitchEvent {
  id: string;
  type: string;
  createdAt: string;
}

function PitchEmailStatus({ leadId, sentAt }: { leadId: string; sentAt: string }) {
  const [status, setStatus] = useState<string>("sent");
  const [events, setEvents] = useState<PitchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email?leadId=${leadId}&view=sent&limit=1`);
      const data = await res.json();
      const msg = data.messages?.[0];
      if (msg) { setStatus(msg.status || "sent"); setEvents(msg.events || []); }
    } catch { /* empty */ }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const sc = PITCH_STATUS_CONFIG[status] || PITCH_STATUS_CONFIG.sent;
  const fmtEvent = (d: string) =>
    new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className={`rounded-xl border px-4 py-3 text-[12px] ${sc.border} bg-surface/50`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <IconCheck size={13} className="text-emerald-400 shrink-0" />
          <span className="text-muted">Sent {new Date(sentAt).toLocaleDateString()}</span>
          <span className="text-border">·</span>
          {(() => {
            const StatusIcon = status === "opened" ? IconEye
              : status === "clicked" ? IconZap
              : status === "bounced" ? IconAlert
              : status === "delivered" ? IconCheck
              : IconClock;
            return (
              <span className={`flex items-center gap-1 font-semibold ${sc.className}`}>
                <StatusIcon size={11} /> {sc.label}
              </span>
            );
          })()}
        </div>
        <button onClick={fetchStatus} disabled={loading} className="text-muted hover:text-foreground transition p-0.5">
          <IconRefresh size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {events.length > 0 && (
        <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border flex-wrap">
          {events.slice(-5).map((ev) => {
            const esc = PITCH_STATUS_CONFIG[ev.type] || { label: ev.type, className: "text-muted", border: "" };
            return (
              <span key={ev.id} className={`text-[10px] ${esc.className}`}>
                {esc.label} · {fmtEvent(ev.createdAt)}
              </span>
            );
          })}
        </div>
      )}
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
  const grade = analysis ? GRADE_CONFIG[analysis.overallGrade] : null;

  useEffect(() => { setEditedPitch(lead.pitchDraft || ""); }, [lead.pitchDraft]);

  return (
    <div className="w-[440px] shrink-0 ml-5 h-full overflow-hidden flex flex-col bg-background border border-border rounded-2xl fade-in">
      <div className="h-1.5 bg-gradient-to-r from-accent to-orange-500 rounded-t-2xl shrink-0" />

      {/* Drawer header */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-4 border-b border-border shrink-0">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getGradient(lead.business || lead.name)} flex items-center justify-center shrink-0`}>
          <span className="text-white font-bold text-[14px]">{initials(lead.name, lead.business)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] text-foreground leading-tight truncate">
            {lead.business || lead.name}
          </h3>
          <p className="text-[12px] text-muted truncate mt-0.5">
            {lead.business ? lead.name : lead.email}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {grade && analysis && (
            <div className={`w-8 h-8 rounded-lg ring-1 ${grade.bg} ${grade.ring} flex items-center justify-center mr-1`}>
              <span className={`text-[13px] font-black ${grade.color}`}>{analysis.overallGrade}</span>
            </div>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition">
            <IconEdit size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition">
            <IconX size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5 shrink-0">
        {(["info", "analysis", "pitch"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-3 text-[12px] font-medium capitalize border-b-2 transition -mb-px ${
              activeTab === tab ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab === "analysis" && analysis && (
              <span className={`mr-1.5 font-bold ${grade?.color || ""}`}>{analysis.overallGrade}</span>
            )}
            {tab === "pitch" && lead.pitchSentAt && (
              <span className="mr-1.5 text-emerald-400">✓</span>
            )}
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Info Tab ── */}
        {activeTab === "info" && (
          <div className="space-y-5">
            {/* Quick contact actions */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface/50 hover:border-accent/40 hover:bg-accent/5 transition text-[12px] text-muted hover:text-accent"
              >
                <IconMail size={13} /> {lead.email.length > 20 ? lead.email.slice(0, 18) + "…" : lead.email}
              </a>
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface/50 hover:border-accent/40 hover:bg-accent/5 transition text-[12px] text-muted hover:text-accent"
                >
                  <IconPhone size={13} /> {lead.phone}
                </a>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 bg-surface/20 text-[12px] text-muted/40">
                  <IconPhone size={13} /> No phone
                </div>
              )}
            </div>

            <div className="space-y-3">
              <InfoRow icon={<IconBuilding size={13} />} label="Business" value={lead.business} />
              <InfoRow icon={<IconFilter size={13} />}   label="Industry" value={lead.industry} />
              <InfoRow icon={<IconGlobe size={13} />}    label="Website"  value={lead.websiteUrl} isLink />
              <InfoRow icon={<IconLink size={13} />}     label="LinkedIn" value={lead.linkedinUrl} isLink />
              <InfoRow icon={<IconFilter size={13} />}   label="Source"   value={lead.source} />
            </div>

            {(lead.notes || lead.message) && (
              <div className="space-y-2">
                {lead.notes && (
                  <div className="rounded-xl bg-surface border border-border p-3.5 text-[12px] text-muted leading-relaxed">
                    {lead.notes}
                  </div>
                )}
                {lead.message && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Message</p>
                    <div className="rounded-xl bg-surface border border-border p-3.5 text-[12px] text-muted leading-relaxed">
                      {lead.message}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted/60">
              Added {new Date(lead.createdAt).toLocaleDateString()}
              {lead.pitchSentAt && <> · Pitched {new Date(lead.pitchSentAt).toLocaleDateString()}</>}
            </p>

            <div className="flex flex-col gap-2 pt-1">
              {!analysis && (
                <button onClick={onAnalyze} disabled={analyzing} className="btn-ghost w-full flex items-center justify-center gap-2 text-[13px]">
                  {analyzing
                    ? <><IconRefresh size={14} className="animate-spin" /> Scanning…</>
                    : <><IconGlobe size={14} /> Analyze Digital Footprint</>}
                </button>
              )}
              {!lead.pitchDraft && (
                <button onClick={onDraftPitch} disabled={pitching} className="btn-primary w-full flex items-center justify-center gap-2 text-[13px]">
                  {pitching
                    ? <><IconRefresh size={14} className="animate-spin" /> Writing pitch…</>
                    : <><IconBot size={14} /> Draft Pitch with AI</>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Analysis Tab ── */}
        {activeTab === "analysis" && (
          <div className="space-y-5">
            {!analysis ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                  <IconGlobe size={28} className="text-muted opacity-40" />
                </div>
                <p className="text-[14px] font-semibold text-foreground mb-1">No analysis yet</p>
                <p className="text-[12px] text-muted mb-5">Scan their digital presence to find opportunities</p>
                <button onClick={onAnalyze} disabled={analyzing} className="btn-primary flex items-center gap-2 mx-auto">
                  {analyzing
                    ? <><IconRefresh size={14} className="animate-spin" /> Analyzing…</>
                    : <><IconGlobe size={14} /> Run Analysis</>}
                </button>
              </div>
            ) : (
              <>
                <div className={`rounded-2xl p-5 text-center ${grade?.bg || "bg-surface"}`}>
                  <div className={`text-6xl font-black mb-1 ${grade?.color || "text-foreground"}`}>
                    {analysis.overallGrade}
                  </div>
                  <div className="text-[12px] text-muted font-medium">
                    Digital Health Score: {analysis.overallScore}/100
                  </div>
                  <p className="text-[12px] text-muted mt-3 leading-relaxed max-w-[320px] mx-auto">
                    {analysis.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <AnalysisCard label="Website"         value={analysis.websiteQuality}        sub={analysis.websiteNotes} />
                  <AnalysisCard label="SEO"             value={analysis.seoScore}              sub={analysis.seoNotes} />
                  <AnalysisCard label="Google Business" value={analysis.googleBusinessProfile} sub={`${analysis.googleReviewCount} reviews · ${analysis.googleRating}★`} />
                  <AnalysisCard label="Social Media"    value={analysis.socialPresence}        sub={analysis.socialNotes} />
                  <AnalysisCard label="Paid Ads"        value={analysis.paidAds}               sub={analysis.adsNotes} />
                  <AnalysisCard label="Ad Spend Est."   value={analysis.estimatedMonthlyAdSpend} sub="" />
                </div>

                {analysis.socialMedia && Object.values(analysis.socialMedia).some(Boolean) && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Social Profiles</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(analysis.socialMedia).filter(([, url]) => url).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline capitalize bg-accent/10 px-2 py-1 rounded-lg">
                          {platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.painPoints?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <IconAlert size={11} className="text-orange-400" /> Pain Points
                    </p>
                    <ul className="space-y-2">
                      {analysis.painPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[12px] text-muted bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2 leading-relaxed">
                          <span className="text-orange-400 shrink-0 mt-0.5">!</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.opportunities?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <IconCheck size={11} className="text-emerald-400" /> Opportunities
                    </p>
                    <ul className="space-y-2">
                      {analysis.opportunities.map((o, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[12px] text-muted bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 leading-relaxed">
                          <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>{o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.competitorGap && (
                  <div className="rounded-xl bg-surface border border-border p-4">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Competitor Gap</p>
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

        {/* ── Pitch Tab ── */}
        {activeTab === "pitch" && (
          <div className="space-y-4">
            {!lead.pitchDraft ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                  <IconBot size={28} className="text-muted opacity-40" />
                </div>
                <p className="text-[14px] font-semibold text-foreground mb-1">No pitch yet</p>
                <p className="text-[12px] text-muted mb-5">AI will write a personalized cold outreach email</p>
                <button onClick={onDraftPitch} disabled={pitching} className="btn-primary flex items-center gap-2 mx-auto">
                  {pitching
                    ? <><IconRefresh size={14} className="animate-spin" /> Writing…</>
                    : <><IconBot size={14} /> Draft Pitch with AI</>}
                </button>
              </div>
            ) : (
              <>
                {lead.pitchSentAt && <PitchEmailStatus leadId={lead.id} sentAt={lead.pitchSentAt} />}

                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-2">
                    Pitch Email (editable)
                  </label>
                  <textarea
                    value={editedPitch}
                    onChange={(e) => setEditedPitch(e.target.value)}
                    className="input-field resize-none font-mono text-[11px] leading-relaxed"
                    rows={16}
                  />
                </div>

                <details className="border border-border rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 text-[12px] text-muted cursor-pointer hover:text-foreground transition bg-surface/50">
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
                      {sending
                        ? <><IconRefresh size={14} className="animate-spin" /> Sending…</>
                        : <><IconSend size={14} /> Send Pitch</>}
                    </button>
                  )}
                  <button onClick={onDraftPitch} disabled={pitching} className="btn-ghost flex items-center gap-1.5 text-[12px]">
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
      <div className="panel w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in rounded-2xl">
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
            <input name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" defaultValue={lead?.linkedinUrl || ""} className="input-field" />
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
    if (!res.ok) { setError(data.error || "Failed to parse CSV"); setStep("upload"); return; }
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
    if (f.name.endsWith(".csv") || f.type === "text/csv") { setFile(f); setError(""); }
    else setError("File must be a .csv");
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in rounded-2xl">
        <div className="panel-header">
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><IconUpload size={16} /> Import CSV</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition"><IconX size={18} /></button>
        </div>
        <div className="panel-body space-y-4">

          {step === "done" && (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <IconCheck size={28} className="text-emerald-400" />
              </div>
              <div className="text-4xl font-black text-emerald-400">{savedCount}</div>
              <p className="text-[13px] text-muted">leads added to your pipeline</p>
              <button onClick={onClose} className="btn-primary mx-auto">Done</button>
            </div>
          )}

          {step === "upload" && (
            <>
              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${
                  dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
              >
                <div className="w-14 h-14 bg-surface rounded-2xl border border-border flex items-center justify-center mx-auto mb-4">
                  <IconUpload size={24} className="text-muted opacity-60" />
                </div>
                {file ? (
                  <>
                    <p className="text-[15px] font-semibold text-accent">{file.name}</p>
                    <p className="text-[12px] text-muted mt-1">{(file.size / 1024).toFixed(1)} KB · click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-[14px] font-medium text-foreground">Drop your CSV here or click to browse</p>
                    <p className="text-[12px] text-muted mt-1.5">Any column layout — AI will map it automatically</p>
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

          {step === "parsing" && (
            <div className="text-center py-14 space-y-4">
              <IconRefresh size={28} className="mx-auto text-accent animate-spin" />
              <p className="text-[15px] font-semibold">Reading your CSV…</p>
              <p className="text-[12px] text-muted">AI is mapping columns and extracting lead data</p>
            </div>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">{preview.length} leads found in <span className="text-accent">{file?.name}</span></p>
                <div className="flex gap-2">
                  <button onClick={() => setSelected(new Set(preview.map((_, i) => i)))} className="text-[11px] text-accent hover:underline">Select all</button>
                  <span className="text-muted">·</span>
                  <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:underline">Deselect all</button>
                </div>
              </div>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {preview.map((lead, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                      selected.has(i) ? "border-accent/50 bg-accent/5" : "border-border hover:border-border/80"
                    }`}
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
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getGradient(lead.business || lead.name)} flex items-center justify-center shrink-0`}>
                      <span className="text-white font-bold text-[10px]">{initials(lead.name, lead.business)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[13px]">{lead.business || lead.name || "—"}</span>
                        {lead.name && lead.business && <span className="text-[11px] text-muted">{lead.name}</span>}
                        {lead.industry && <span className="text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded-md border border-border">{lead.industry}</span>}
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
                    </div>
                  </label>
                ))}
              </div>
              {error && <p className="text-[12px] text-danger flex items-center gap-1.5"><IconAlert size={13} /> {error}</p>}
              <div className="flex gap-3 border-t border-border pt-4">
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
      <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in rounded-2xl">
        <div className="panel-header">
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <IconSparkles size={16} /> Find New Leads with AI
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition"><IconX size={18} /></button>
        </div>
        <div className="panel-body space-y-4">
          {done ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <IconCheck size={28} className="text-emerald-400" />
              </div>
              <div className="text-4xl font-black text-emerald-400">{savedCount}</div>
              <p className="text-[13px] text-muted">leads saved to your pipeline</p>
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
                    placeholder="e.g. restaurants, plumbers, real estate…"
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
                    placeholder="e.g. no website, bad reviews, new business…"
                    value={form.keywords}
                    onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted mb-1.5">Number of leads</label>
                  <select
                    value={form.count}
                    onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                    className="input-field"
                  >
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
                  ? <><IconRefresh size={14} className="animate-spin" /> Searching with AI…</>
                  : <><IconSparkles size={14} /> Find Leads</>}
              </button>
              {results.length > 0 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold">{results.length} leads found</p>
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(new Set(results.map((_, i) => i)))} className="text-[11px] text-accent hover:underline">Select all</button>
                      <span className="text-muted">·</span>
                      <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:underline">Deselect all</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {results.map((lead, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                          selected.has(i) ? "border-accent/50 bg-accent/5" : "border-border hover:border-border/80"
                        }`}
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
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getGradient(lead.business || lead.name)} flex items-center justify-center shrink-0`}>
                          <span className="text-white font-bold text-[10px]">{initials(lead.name, lead.business)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[13px]">{lead.business || lead.name}</span>
                            {lead.industry && <span className="text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded-md border border-border">{lead.industry}</span>}
                          </div>
                          {lead.email && <div className="text-[11px] text-muted mt-0.5">{lead.email}</div>}
                          {lead.websiteUrl && (
                            <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                              {lead.websiteUrl}
                            </a>
                          )}
                          {lead.notes && <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">{lead.notes}</p>}
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
    <div className="flex items-start gap-3">
      <span className="text-muted mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        {isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent hover:underline break-all">
            {value}
          </a>
        ) : (
          <p className="text-[13px] text-foreground">{value}</p>
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
    <div className="bg-surface/60 rounded-xl border border-border p-3.5">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-[13px] font-bold capitalize ${QUALITY_COLORS[value?.toLowerCase()] || "text-foreground"}`}>
        {value?.replace(/_/g, " ") || "—"}
      </p>
      {sub && <p className="text-[11px] text-muted mt-1 leading-relaxed">{sub}</p>}
    </div>
  );
}
