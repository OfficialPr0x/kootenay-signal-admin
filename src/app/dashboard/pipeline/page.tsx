"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  IconRefresh, IconSearch, IconX, IconZap, IconCheck, IconSend,
  IconArrowRight, IconBuilding, IconMail, IconPhone, IconGlobe,
  IconSparkles, IconClock, IconTrendUp, IconPipeline, IconAlert,
  IconChevronDown, IconFilter, IconBot,
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
  message: string | null;
  source: string;
  status: string;
  notes: string | null;
  analysis: DigitalAnalysis | null;
  pitchDraft: string | null;
  pitchSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DigitalAnalysis {
  overallScore?: number;
  overallGrade?: string;
  painPoints?: string[];
  opportunities?: string[];
  summary?: string;
}

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

const STAGES = [
  {
    key: "new",
    label: "New",
    sublabel: "Unworked leads",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.1)",
    colorBorder: "rgba(59,130,246,0.2)",
    textClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    dotClass: "bg-blue-400",
    borderClass: "border-blue-500/20",
    automation: "Run AI Analysis",
    automationIcon: "sparkles",
    nextStatus: "contacted",
    nextLabel: "Mark Contacted",
  },
  {
    key: "contacted",
    label: "Contacted",
    sublabel: "Outreach sent",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.1)",
    colorBorder: "rgba(245,158,11,0.2)",
    textClass: "text-yellow-400",
    bgClass: "bg-yellow-500/10",
    dotClass: "bg-yellow-400",
    borderClass: "border-yellow-500/20",
    automation: "Send AI Pitch",
    automationIcon: "send",
    nextStatus: "qualified",
    nextLabel: "Mark Qualified",
  },
  {
    key: "qualified",
    label: "Qualified",
    sublabel: "Hot prospects",
    color: "#e87f24",
    colorDim: "rgba(232,127,36,0.1)",
    colorBorder: "rgba(232,127,36,0.2)",
    textClass: "text-accent",
    bgClass: "bg-accent/10",
    dotClass: "bg-accent",
    borderClass: "border-accent/20",
    automation: "Convert to Client",
    automationIcon: "check",
    nextStatus: "converted",
    nextLabel: "Mark as Won",
  },
  {
    key: "converted",
    label: "Won",
    sublabel: "Converted clients",
    color: "#10b981",
    colorDim: "rgba(16,185,129,0.1)",
    colorBorder: "rgba(16,185,129,0.2)",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    dotClass: "bg-emerald-400",
    borderClass: "border-emerald-500/20",
    automation: null,
    automationIcon: null,
    nextStatus: null,
    nextLabel: null,
  },
  {
    key: "lost",
    label: "Lost",
    sublabel: "Dead leads",
    color: "#ef4444",
    colorDim: "rgba(239,68,68,0.08)",
    colorBorder: "rgba(239,68,68,0.15)",
    textClass: "text-red-400",
    bgClass: "bg-red-500/8",
    dotClass: "bg-red-400",
    borderClass: "border-red-500/15",
    automation: null,
    automationIcon: null,
    nextStatus: null,
    nextLabel: null,
  },
];

const GRADE_CONFIG: Record<string, { color: string; bg: string }> = {
  A: { color: "text-emerald-400", bg: "bg-emerald-500/15" },
  B: { color: "text-green-400",   bg: "bg-green-500/15" },
  C: { color: "text-yellow-400",  bg: "bg-yellow-500/15" },
  D: { color: "text-orange-400",  bg: "bg-orange-500/15" },
  F: { color: "text-red-400",     bg: "bg-red-500/15" },
};

const AVATAR_COLORS = [
  "from-accent to-orange-700",
  "from-blue-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-700",
  "from-cyan-500 to-sky-700",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function fmt(n: number) {
  return n === 1 ? "1 day" : `${n} days`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_COL_WIDTH = 280;
const MIN_COL_WIDTH = 160;
const LS_ORDER = "ks_pipeline_order";
const LS_WIDTHS = "ks_pipeline_widths";

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Column layout state ──
  const [stageOrder, setStageOrder] = useState<string[]>(STAGES.map((s) => s.key));
  const [colWidths, setColWidths] = useState<number[]>(STAGES.map(() => DEFAULT_COL_WIDTH));
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const [colDragOver, setColDragOver] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load leads", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Persist column layout ──
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(LS_ORDER);
      const savedWidths = localStorage.getItem(LS_WIDTHS);
      if (savedOrder) {
        const parsed: string[] = JSON.parse(savedOrder);
        // Validate: must contain all stage keys (no more, no less)
        const allKeys = STAGES.map((s) => s.key);
        const valid = allKeys.every((k) => parsed.includes(k)) && parsed.length === allKeys.length;
        if (valid) setStageOrder(parsed);
      }
      if (savedWidths) {
        const parsed: number[] = JSON.parse(savedWidths);
        if (Array.isArray(parsed) && parsed.length === STAGES.length) setColWidths(parsed);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_ORDER, JSON.stringify(stageOrder));
  }, [stageOrder]);

  useEffect(() => {
    localStorage.setItem(LS_WIDTHS, JSON.stringify(colWidths));
  }, [colWidths]);

  // ── Cursor during resize ──
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // ── Patch status ──
  const moveToStage = useCallback(async (id: string, status: string, label: string) => {
    setMovingId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      if (selectedLead?.id === id) setSelectedLead(updated);
      showToast(`Moved to ${label}`);
    } catch {
      showToast("Failed to move lead", "error");
    } finally {
      setMovingId(null);
    }
  }, [selectedLead, showToast]);

  // ── AI Analysis ──
  const runAnalysis = useCallback(async (lead: Lead) => {
    setRunningId(lead.id);
    try {
      const res = await fetch("/api/leads/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, websiteUrl: lead.websiteUrl, business: lead.business }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...updated } : l)));
      if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, ...updated });
      showToast("AI analysis complete");
    } catch {
      showToast("Analysis failed — try again", "error");
    } finally {
      setRunningId(null);
    }
  }, [selectedLead, showToast]);

  // ── Send pitch ──
  const sendPitch = useCallback(async (lead: Lead) => {
    setRunningId(lead.id);
    try {
      const res = await fetch("/api/leads/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, sendPitch: true }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...updated } : l)));
      if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, ...updated });
      showToast("Pitch sent successfully");
    } catch {
      showToast("Failed to send pitch", "error");
    } finally {
      setRunningId(null);
    }
  }, [selectedLead, showToast]);

  // ── Drag & drop ──
  function onDragStart(e: React.DragEvent, leadId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("leadId", leadId);
    setDragging(leadId);
  }

  function onDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  function onDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(stageKey);
  }

  function onDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const stage = STAGES.find((s) => s.key === stageKey);
    if (leadId && stage) {
      moveToStage(leadId, stageKey, stage.label);
    }
    setDragging(null);
    setDragOver(null);
  }

  // ── Column resize ──
  function onResizeStart(e: React.MouseEvent, colIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colIndex, startX: e.clientX, startWidth: colWidths[colIndex] };
    setIsResizing(true);

    function onMouseMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizingRef.current.startWidth + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingRef.current!.colIndex] = newWidth;
        return next;
      });
    }

    function onMouseUp() {
      resizingRef.current = null;
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ── Column reorder ──
  function onColDragStart(e: React.DragEvent, key: string) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("colKey", key);
    setDraggingCol(key);
  }

  function onColDragEnd() {
    setDraggingCol(null);
    setColDragOver(null);
  }

  function onColDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    if (draggingCol && draggingCol !== key) setColDragOver(key);
  }

  function onColDrop(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    e.stopPropagation();
    const srcKey = draggingCol;
    if (!srcKey || srcKey === targetKey) {
      setDraggingCol(null);
      setColDragOver(null);
      return;
    }
    setStageOrder((prev) => {
      const next = [...prev];
      const srcIdx = next.indexOf(srcKey);
      const tgtIdx = next.indexOf(targetKey);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, srcKey);
      return next;
    });
    setColWidths((prev) => {
      const next = [...prev];
      const srcIdx = stageOrder.indexOf(srcKey);
      const tgtIdx = stageOrder.indexOf(targetKey);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const [w] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, w);
      return next;
    });
    setDraggingCol(null);
    setColDragOver(null);
  }

  // ── Filtered leads ──
  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.business?.toLowerCase().includes(q) ||
      l.industry?.toLowerCase().includes(q)
    );
  });

  const byStage = (key: string) => filtered.filter((l) => l.status === key);

  // ── Stats ──
  const total = leads.length;
  const won = leads.filter((l) => l.status === "converted").length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const contacted = leads.filter((l) => l.status === "contacted").length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  // ── Ordered stages ──
  const orderedStages = stageOrder
    .map((key) => STAGES.find((s) => s.key === key)!)
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-[#06080a] overflow-hidden">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl transition-all duration-300 ${
          toast.type === "success"
            ? "bg-[#0c0e12] border-emerald-500/30 text-emerald-400"
            : "bg-[#0c0e12] border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success"
            ? <IconCheck size={14} />
            : <IconAlert size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1a1e25] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <IconPipeline size={16} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white/90 tracking-wide">Pipeline</h1>
            <p className="text-[11px] text-white/30 mt-0.5">{total} total leads across {STAGES.length} stages</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="pl-8 pr-8 py-2 bg-[#0c0e12] border border-[#1a1e25] rounded-lg text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-accent/40 w-52 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60">
                <IconX size={12} />
              </button>
            )}
          </div>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0c0e12] border border-[#1a1e25] rounded-lg text-xs text-white/50 hover:text-white/80 hover:border-[#252b35] transition-all disabled:opacity-40"
          >
            <IconRefresh size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => {
              setStageOrder(STAGES.map((s) => s.key));
              setColWidths(STAGES.map(() => DEFAULT_COL_WIDTH));
            }}
            title="Reset column layout"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0c0e12] border border-[#1a1e25] rounded-lg text-xs text-white/30 hover:text-white/60 hover:border-[#252b35] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
            </svg>
            Reset Layout
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="flex items-stretch gap-px border-b border-[#1a1e25] flex-shrink-0 bg-[#1a1e25]">
        {[
          { label: "Total Leads",    value: total,    icon: <IconPipeline size={13} />, color: "text-white/60" },
          { label: "New",            value: newLeads,  icon: <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />,     color: "text-blue-400" },
          { label: "Contacted",      value: contacted, icon: <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />,   color: "text-yellow-400" },
          { label: "Qualified",      value: qualified, icon: <div className="w-1.5 h-1.5 rounded-full bg-accent" />,       color: "text-accent" },
          { label: "Won",            value: won,       icon: <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />,  color: "text-emerald-400" },
          { label: "Win Rate",       value: `${winRate}%`, icon: <IconTrendUp size={13} />, color: winRate >= 20 ? "text-emerald-400" : "text-white/50" },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 bg-[#06080a] hover:bg-[#0c0e12] transition-colors">
            <div className={`flex items-center gap-1.5 ${stat.color} text-[18px] font-bold tracking-tight`}>
              {stat.value}
            </div>
            <div className="flex items-center gap-1 text-white/25 text-[9px] tracking-[0.15em] uppercase">
              {stat.icon}
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Kanban Board ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-0 h-full" style={{ minHeight: 0 }}>
          {orderedStages.map((stage, si) => {
            const stageLeads = byStage(stage.key);
            const isLeadDragTarget = dragOver === stage.key && !draggingCol;
            const isColDragTarget = colDragOver === stage.key;
            const isThisColDragging = draggingCol === stage.key;
            const width = colWidths[si] ?? DEFAULT_COL_WIDTH;
            const isLast = si === orderedStages.length - 1;

            return (
              <div
                key={stage.key}
                className={`relative flex flex-col border-r border-[#1a1e25] last:border-r-0 flex-shrink-0 transition-colors duration-150 ${
                  isLeadDragTarget ? "bg-[#0c0e12]" : "bg-[#06080a]"
                } ${isThisColDragging ? "opacity-40" : ""}`}
                style={{ width }}
                onDragOver={(e) => {
                  if (draggingCol) {
                    onColDragOver(e, stage.key);
                  } else {
                    onDragOver(e, stage.key);
                  }
                }}
                onDragLeave={() => {
                  if (draggingCol) setColDragOver(null);
                  else setDragOver(null);
                }}
                onDrop={(e) => {
                  if (draggingCol) {
                    onColDrop(e, stage.key);
                  } else {
                    onDrop(e, stage.key);
                  }
                }}
              >
                {/* Col-drag insertion indicator (left edge) */}
                {isColDragTarget && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-0.5 z-20 animate-pulse"
                    style={{ background: stage.color }}
                  />
                )}

                {/* Column header */}
                <div
                  className="px-3 pt-3.5 pb-2.5 border-b flex-shrink-0 select-none"
                  style={{ borderBottomColor: isColDragTarget ? stage.color : stage.colorBorder }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: stage.colorDim, color: stage.color }}
                      >
                        {stageLeads.length}
                      </span>
                      {/* Grip — drag to reorder column */}
                      <div
                        draggable
                        onDragStart={(e) => onColDragStart(e, stage.key)}
                        onDragEnd={onColDragEnd}
                        title="Drag to reorder"
                        className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/50 transition-colors px-0.5"
                      >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                          <circle cx="2.5" cy="2.5" r="1.5" />
                          <circle cx="7.5" cy="2.5" r="1.5" />
                          <circle cx="2.5" cy="7" r="1.5" />
                          <circle cx="7.5" cy="7" r="1.5" />
                          <circle cx="2.5" cy="11.5" r="1.5" />
                          <circle cx="7.5" cy="11.5" r="1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-white/20 tracking-wide">{stage.sublabel}</p>

                  {/* Lead drop indicator */}
                  {isLeadDragTarget && (
                    <div
                      className="mt-2 h-0.5 rounded-full animate-pulse"
                      style={{ background: stage.color, opacity: 0.6 }}
                    />
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 scrollbar-hide">
                  {loading && stageLeads.length === 0 ? (
                    <div className="space-y-2 pt-1">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-20 rounded-lg bg-[#0c0e12] border border-[#1a1e25] animate-pulse" />
                      ))}
                    </div>
                  ) : stageLeads.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center gap-2 mt-6 py-6 rounded-xl border border-dashed text-center opacity-40"
                      style={{ borderColor: stage.colorBorder }}
                    >
                      <div className="w-6 h-6 rounded-full" style={{ background: stage.colorDim }} />
                      <p className="text-[9px] text-white/30 tracking-wide">
                        {search ? "No matches" : "Empty stage"}
                      </p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        stage={stage}
                        stages={STAGES}
                        isDragging={dragging === lead.id}
                        isMoving={movingId === lead.id}
                        isRunning={runningId === lead.id}
                        onClick={() => setSelectedLead(lead)}
                        onDragStart={(e) => onDragStart(e, lead.id)}
                        onDragEnd={onDragEnd}
                        onMove={(status, label) => moveToStage(lead.id, status, label)}
                        onAnalyze={() => runAnalysis(lead)}
                        onSendPitch={() => sendPitch(lead)}
                        onMarkLost={() => moveToStage(lead.id, "lost", "Lost")}
                      />
                    ))
                  )}
                </div>

                {/* Column footer with progress */}
                <div className="px-3 pb-2.5 pt-1 flex-shrink-0 border-t border-[#1a1e25]/50">
                  <div className="h-0.5 w-full rounded-full bg-[#1a1e25] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: total > 0 ? `${(stageLeads.length / total) * 100}%` : "0%",
                        background: stage.color,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-white/15 mt-1 text-right">
                    {total > 0 ? `${Math.round((stageLeads.length / total) * 100)}%` : "0%"} of pipeline
                  </p>
                </div>

                {/* Resize handle — right edge of every column except the last */}
                {!isLast && (
                  <div
                    className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize z-10 flex items-center justify-center group/rh"
                    onMouseDown={(e) => onResizeStart(e, si)}
                  >
                    <div className="w-px h-full bg-[#1a1e25] group-hover/rh:bg-accent/50 transition-colors duration-150" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lead Drawer ── */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          stages={STAGES}
          isMoving={movingId === selectedLead.id}
          isRunning={runningId === selectedLead.id}
          onClose={() => setSelectedLead(null)}
          onMove={(status, label) => moveToStage(selectedLead.id, status, label)}
          onAnalyze={() => runAnalysis(selectedLead)}
          onSendPitch={() => sendPitch(selectedLead)}
          onMarkLost={() => moveToStage(selectedLead.id, "lost", "Lost")}
        />
      )}
    </div>
  );
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

interface CardProps {
  lead: Lead;
  stage: typeof STAGES[number];
  stages: typeof STAGES;
  isDragging: boolean;
  isMoving: boolean;
  isRunning: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (status: string, label: string) => void;
  onAnalyze: () => void;
  onSendPitch: () => void;
  onMarkLost: () => void;
}

function PipelineCard({
  lead, stage, isDragging, isMoving, isRunning,
  onClick, onDragStart, onDragEnd, onMove, onAnalyze, onSendPitch, onMarkLost,
}: CardProps) {
  const grade = lead.analysis?.overallGrade;
  const gradeConf = grade ? (GRADE_CONFIG[grade] ?? null) : null;
  const days = daysAgo(lead.updatedAt);
  const pitchSent = !!lead.pitchSentAt;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative rounded-xl border bg-[#0c0e12] p-3 cursor-pointer transition-all duration-150 select-none ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
      } ${isMoving ? "opacity-60 pointer-events-none" : ""} hover:border-[#252b35] hover:bg-[#12151a]`}
      style={{ borderColor: "#1a1e25" }}
    >
      {/* Top row */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor(lead.id)} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>
          {(lead.name || lead.business || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white/85 truncate leading-tight">
            {lead.name}
          </p>
          {lead.business && (
            <p className="text-[10px] text-white/35 truncate flex items-center gap-1 mt-0.5">
              <IconBuilding size={9} />
              {lead.business}
            </p>
          )}
        </div>
        {gradeConf && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${gradeConf.color} ${gradeConf.bg} flex-shrink-0`}>
            {grade}
          </span>
        )}
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {lead.industry && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/8 truncate max-w-[80px]">
            {lead.industry}
          </span>
        )}
        {pitchSent && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <IconCheck size={8} /> Pitched
          </span>
        )}
        {lead.analysis && !pitchSent && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 flex items-center gap-1">
            <IconSparkles size={8} /> Analyzed
          </span>
        )}
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/4 text-white/20 flex items-center gap-1 ml-auto">
          <IconClock size={8} />{fmt(days)}
        </span>
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
        {stage.nextStatus && (
          <button
            onClick={() => onMove(stage.nextStatus!, stage.nextLabel!)}
            disabled={isMoving || isRunning}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold bg-white/6 hover:bg-accent/20 hover:text-accent text-white/40 transition-all disabled:opacity-30"
          >
            <IconArrowRight size={9} />
            {stage.nextLabel}
          </button>
        )}
        {stage.key === "new" && !lead.analysis && (
          <button
            onClick={onAnalyze}
            disabled={isMoving || isRunning}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold bg-white/6 hover:bg-accent/20 hover:text-accent text-white/40 transition-all disabled:opacity-30"
          >
            {isRunning ? <IconRefresh size={9} className="animate-spin" /> : <IconSparkles size={9} />}
            Analyze
          </button>
        )}
        {stage.key === "contacted" && !pitchSent && (
          <button
            onClick={onSendPitch}
            disabled={isMoving || isRunning}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold bg-white/6 hover:bg-blue-500/20 hover:text-blue-400 text-white/40 transition-all disabled:opacity-30"
          >
            {isRunning ? <IconRefresh size={9} className="animate-spin" /> : <IconSend size={9} />}
            Pitch
          </button>
        )}
        {stage.key !== "lost" && stage.key !== "converted" && (
          <button
            onClick={onMarkLost}
            disabled={isMoving}
            className="ml-auto flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
          >
            <IconX size={9} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Lead Drawer ──────────────────────────────────────────────────────────────

interface DrawerProps {
  lead: Lead;
  stages: typeof STAGES;
  isMoving: boolean;
  isRunning: boolean;
  onClose: () => void;
  onMove: (status: string, label: string) => void;
  onAnalyze: () => void;
  onSendPitch: () => void;
  onMarkLost: () => void;
}

function LeadDrawer({ lead, stages, isMoving, isRunning, onClose, onMove, onAnalyze, onSendPitch, onMarkLost }: DrawerProps) {
  const currentStage = stages.find((s) => s.key === lead.status) ?? stages[0];
  const grade = lead.analysis?.overallGrade;
  const gradeConf = grade ? (GRADE_CONFIG[grade] ?? null) : null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" />

      {/* Panel */}
      <div
        className="w-[420px] flex-shrink-0 bg-[#0c0e12] border-l border-[#1a1e25] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1e25]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(lead.id)} flex items-center justify-center text-[13px] font-bold text-white`}>
              {(lead.name || lead.business || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[13px] font-bold text-white/90">{lead.name}</p>
              {lead.business && <p className="text-[11px] text-white/35">{lead.business}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1.5 hover:bg-white/5 rounded-lg">
            <IconX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stage & Grade */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-[#1a1e25]/50">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ background: currentStage.colorDim, color: currentStage.color, border: `1px solid ${currentStage.colorBorder}` }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: currentStage.color }} />
              {currentStage.label}
            </div>
            {gradeConf && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ${gradeConf.color} ${gradeConf.bg}`}>
                <IconSparkles size={11} />
                Grade {grade}
                {lead.analysis?.overallScore != null && (
                  <span className="opacity-60 text-[10px]">· {lead.analysis.overallScore}/100</span>
                )}
              </div>
            )}
            <span className="ml-auto text-[10px] text-white/25 flex items-center gap-1">
              <IconClock size={10} />
              {fmt(daysAgo(lead.updatedAt))} ago
            </span>
          </div>

          {/* Contact info */}
          <div className="px-5 py-4 space-y-2.5 border-b border-[#1a1e25]/50">
            <p className="text-[9px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-3">Contact</p>
            <InfoRow icon={<IconMail size={12} />} label={lead.email} href={`mailto:${lead.email}`} />
            {lead.phone && <InfoRow icon={<IconPhone size={12} />} label={lead.phone} href={`tel:${lead.phone}`} />}
            {lead.websiteUrl && <InfoRow icon={<IconGlobe size={12} />} label={lead.websiteUrl} href={lead.websiteUrl} external />}
            {lead.industry && <InfoRow icon={<IconBuilding size={12} />} label={lead.industry} />}
          </div>

          {/* AI Analysis */}
          {lead.analysis ? (
            <div className="px-5 py-4 border-b border-[#1a1e25]/50">
              <p className="text-[9px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-3">AI Analysis</p>
              {lead.analysis.summary && (
                <p className="text-[11px] text-white/50 leading-relaxed mb-3">{lead.analysis.summary}</p>
              )}
              {lead.analysis.painPoints && lead.analysis.painPoints.length > 0 && (
                <div className="mb-3">
                  <p className="text-[9px] text-red-400/60 uppercase tracking-wider mb-1.5">Pain Points</p>
                  <ul className="space-y-1">
                    {lead.analysis.painPoints.slice(0, 3).map((p, i) => (
                      <li key={i} className="text-[10px] text-white/40 flex items-start gap-1.5">
                        <span className="text-red-400/50 mt-0.5">·</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.analysis.opportunities && lead.analysis.opportunities.length > 0 && (
                <div>
                  <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-1.5">Opportunities</p>
                  <ul className="space-y-1">
                    {lead.analysis.opportunities.slice(0, 3).map((o, i) => (
                      <li key={i} className="text-[10px] text-white/40 flex items-start gap-1.5">
                        <span className="text-emerald-400/50 mt-0.5">·</span>{o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 border-b border-[#1a1e25]/50">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/15">
                <IconBot size={14} className="text-accent/60" />
                <div>
                  <p className="text-[11px] text-white/50">No AI analysis yet</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Run analysis to score this lead</p>
                </div>
              </div>
            </div>
          )}

          {/* Pitch status */}
          {lead.pitchSentAt && (
            <div className="px-5 py-4 border-b border-[#1a1e25]/50">
              <p className="text-[9px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-3">Pitch</p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <IconCheck size={12} />
                Sent {new Date(lead.pitchSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          )}

          {/* Move to stage */}
          <div className="px-5 py-4 border-b border-[#1a1e25]/50">
            <p className="text-[9px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-3">Move to Stage</p>
            <div className="flex flex-wrap gap-2">
              {stages.filter((s) => s.key !== lead.status).map((s) => (
                <button
                  key={s.key}
                  onClick={() => onMove(s.key, s.label)}
                  disabled={isMoving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40 hover:scale-[1.02]"
                  style={{ background: s.colorDim, color: s.color, border: `1px solid ${s.colorBorder}` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="px-5 py-4">
              <p className="text-[9px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-2">Notes</p>
              <p className="text-[11px] text-white/40 leading-relaxed">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Drawer footer — actions */}
        <div className="px-5 py-4 border-t border-[#1a1e25] space-y-2.5">
          {!lead.analysis && (
            <button
              onClick={onAnalyze}
              disabled={isRunning || isMoving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-[11px] font-bold tracking-wide border border-accent/20 transition-all disabled:opacity-40"
            >
              {isRunning ? <IconRefresh size={13} className="animate-spin" /> : <IconSparkles size={13} />}
              Run AI Analysis
            </button>
          )}
          {lead.status === "contacted" && !lead.pitchSentAt && (
            <button
              onClick={onSendPitch}
              disabled={isRunning || isMoving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-bold tracking-wide border border-blue-500/20 transition-all disabled:opacity-40"
            >
              {isRunning ? <IconRefresh size={13} className="animate-spin" /> : <IconSend size={13} />}
              Send AI Pitch Email
            </button>
          )}
          {currentStage.nextStatus && (
            <button
              onClick={() => onMove(currentStage.nextStatus!, currentStage.nextLabel!)}
              disabled={isMoving || isRunning}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-[11px] font-bold tracking-wide transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${currentStage.color}22, ${currentStage.color}15)`, border: `1px solid ${currentStage.colorBorder}`, color: currentStage.color }}
            >
              {isMoving ? <IconRefresh size={13} className="animate-spin" /> : <IconArrowRight size={13} />}
              {currentStage.nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, href, external }: { icon: React.ReactNode; label: string; href?: string; external?: boolean }) {
  const cls = "flex items-center gap-2 text-[11px] text-white/45 hover:text-white/70 transition-colors truncate";
  const inner = (
    <>
      <span className="text-accent/50 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
