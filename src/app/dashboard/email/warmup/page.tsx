"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconPlay, IconPause, IconRefresh, IconAlert,
  IconCheck, IconTrendUp, IconShield, IconWarmup, IconChevronRight,
  IconClock, IconSend, IconMail, IconBarChart, IconTrash, IconEdit, IconX,
} from "@/components/icons";

/* ── Types ── */

interface WarmupMessageRecord {
  id: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: string;
}

interface MailboxHealth {
  id: string;
  trustScore: number;
  bounceRate: number;
  replyRate: number;
  openRate: number;
  complaintRate: number;
  spamRiskScore: number;
  dailyVolume: number;
  dnsHealthy: boolean;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  createdAt: string;
}

interface WarmupJob {
  id: string;
  status: string;
  currentVolume: number;
  totalSent: number;
  totalReplies: number;
  totalBounces: number;
  lastRunAt: string | null;
  createdAt: string;
  profile: { name: string; maxVolume: number; startVolume?: number; rampIncrement?: number };
  messages?: WarmupMessageRecord[];
}

interface Mailbox {
  id: string;
  email: string;
  name: string;
  warmupStatus: string;
  dailySendLimit: number;
  currentVolume: number;
  trustScore: number;
  healthSnapshots: MailboxHealth[];
  warmupJobs: WarmupJob[];
}

interface WarmupProfile {
  id: string;
  name: string;
  startVolume: number;
  maxVolume: number;
  rampIncrement: number;
  seedAddresses: string | null;
  contentVariants: string | null;
  isActive: boolean;
  jobs?: { id: string; status: string }[];
}

/* ── Constants ── */

const WARMUP_STATUS_STYLES: Record<string, { badge: string; label: string; dot: string }> = {
  none:    { badge: "badge-muted",   label: "Not Started", dot: "bg-muted" },
  warming: { badge: "badge-warning", label: "Warming",     dot: "bg-warning" },
  stable:  { badge: "badge-success", label: "Stable",      dot: "bg-success" },
  at_risk: { badge: "badge-danger",  label: "At Risk",     dot: "bg-danger" },
  paused:  { badge: "badge-muted",   label: "Paused",      dot: "bg-muted" },
};

const MSG_STATUS_STYLES: Record<string, { label: string }> = {
  sent:      { label: "Sent" },
  delivered: { label: "Delivered" },
  opened:    { label: "Opened" },
  replied:   { label: "Replied" },
  bounced:   { label: "Bounced" },
};

const DNS_STATUS_ICON: Record<string, { color: string; label: string }> = {
  pass:    { color: "text-success", label: "Pass" },
  fail:    { color: "text-danger",  label: "Fail" },
  unknown: { color: "text-muted",   label: "Unknown" },
};

export default function WarmupPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [profiles, setProfiles] = useState<WarmupProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMailbox, setExpandedMailbox] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"activity" | "messages" | "health">("activity");
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [assigningProfile, setAssigningProfile] = useState<string | null>(null);

  // Detail view data
  const [detailData, setDetailData] = useState<Mailbox | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Profile form
  const [profileName, setProfileName] = useState("");
  const [startVol, setStartVol] = useState(2);
  const [maxVol, setMaxVol] = useState(40);
  const [rampInc, setRampInc] = useState(2);
  const [saving, setSaving] = useState(false);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [editStartVol, setEditStartVol] = useState(2);
  const [editMaxVol, setEditMaxVol] = useState(40);
  const [editRampInc, setEditRampInc] = useState(2);
  const [editSeeds, setEditSeeds] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);

  // Seed addresses for new profile
  const [seedAddresses, setSeedAddresses] = useState("");

  // Warmup execution
  const [executing, setExecuting] = useState(false);
  const [engaging, setEngaging] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRunTimer, setAutoRunTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [execResult, setExecResult] = useState<{ message: string; totalSent: number; timestamp: string } | null>(null);
  const [engageResult, setEngageResult] = useState<{ message: string; emailsFound: number; emailsReplied: number; emailsLabeled: number } | null>(null);
  const [lastRunInfo, setLastRunInfo] = useState<{ lastRunAt: string | null; activeJobs: number; todaySent: number } | null>(null);
  const [engageStatus, setEngageStatus] = useState<{ zapierConfigured: boolean; pendingEngagement: number; totalOpened: number; totalReplied: number } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mbRes, profRes] = await Promise.all([
        fetch("/api/warmup/mailboxes"),
        fetch("/api/warmup"),
      ]);
      const mbData = await mbRes.json();
      const profData = await profRes.json();
      setMailboxes(mbData.mailboxes || []);
      setProfiles(profData.profiles || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchExecStatus = useCallback(async () => {
    try {
      const [execRes, engageRes] = await Promise.all([
        fetch("/api/warmup/execute"),
        fetch("/api/warmup/engage"),
      ]);
      if (execRes.ok) setLastRunInfo(await execRes.json());
      if (engageRes.ok) setEngageStatus(await engageRes.json());
    } catch { /* empty */ }
  }, []);

  useEffect(() => { fetchData(); fetchExecStatus(); }, [fetchData, fetchExecStatus]);

  // Cleanup auto-run timer on unmount
  useEffect(() => {
    return () => {
      if (autoRunTimer) clearInterval(autoRunTimer);
    };
  }, [autoRunTimer]);

  async function fetchMailboxDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/warmup/mailboxes/${id}`);
      const data = await res.json();
      setDetailData(data.mailbox || null);
    } catch { /* empty */ }
    setDetailLoading(false);
  }

  function handleExpandMailbox(id: string) {
    if (expandedMailbox === id) {
      setExpandedMailbox(null);
      setDetailData(null);
    } else {
      setExpandedMailbox(id);
      setDetailTab("activity");
      fetchMailboxDetail(id);
    }
  }

  async function createProfile() {
    if (!profileName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          startVolume: startVol,
          maxVolume: maxVol,
          rampIncrement: rampInc,
          seedAddresses: seedAddresses.trim() || null,
        }),
      });
      if (res.ok) {
        setShowAddProfile(false);
        setProfileName(""); setStartVol(2); setMaxVol(40); setRampInc(2); setSeedAddresses("");
        fetchData();
      }
    } catch { /* empty */ }
    setSaving(false);
  }

  async function runWarmupNow() {
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await fetch("/api/warmup/execute", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setExecResult(data);
        fetchData();
        fetchExecStatus();
      } else {
        setProfileError(data.error || "Warmup execution failed");
      }
    } catch { setProfileError("Failed to run warmup"); }
    setExecuting(false);
  }

  async function runEngageNow() {
    setEngaging(true);
    setEngageResult(null);
    try {
      const res = await fetch("/api/warmup/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyRate: 0.4, maxToProcess: 20 }),
      });
      const data = await res.json();
      if (res.ok) {
        setEngageResult(data);
        fetchData();
        fetchExecStatus();
      } else {
        setProfileError(data.error || "Engage failed");
      }
    } catch { setProfileError("Failed to run engage"); }
    setEngaging(false);
  }

  async function runFullCycle() {
    try {
      const res = await fetch("/api/warmup/cron", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Update results from the cron response
        const execPhase = data.results?.find((r: { phase: string }) => r.phase === "execute");
        const engagePhase = data.results?.find((r: { phase: string }) => r.phase === "engage");
        if (execPhase?.data) setExecResult(execPhase.data as typeof execResult);
        if (engagePhase?.data) setEngageResult(engagePhase.data as typeof engageResult);
        fetchData();
        fetchExecStatus();
      }
    } catch { /* autonomous cycle failed silently */ }
  }

  function toggleAutoRun() {
    if (autoRunning) {
      // Stop autonomous warmup
      if (autoRunTimer) clearInterval(autoRunTimer);
      setAutoRunTimer(null);
      setAutoRunning(false);
    } else {
      // Start autonomous warmup — run immediately, then every 3 minutes
      setAutoRunning(true);
      runFullCycle();
      const timer = setInterval(() => {
        runFullCycle();
      }, 3 * 60 * 1000); // 3 minutes
      setAutoRunTimer(timer);
    }
  }

  function startEditProfile(p: WarmupProfile) {
    setEditingProfile(p.id);
    setEditProfileName(p.name);
    setEditStartVol(p.startVolume);
    setEditMaxVol(p.maxVolume);
    setEditRampInc(p.rampIncrement);
    setEditSeeds(p.seedAddresses || "");
    setProfileError(null);
  }

  async function updateProfile(id: string) {
    setSaving(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/warmup/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProfileName,
          startVolume: editStartVol,
          maxVolume: editMaxVol,
          rampIncrement: editRampInc,
          seedAddresses: editSeeds.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingProfile(null);
        fetchData();
      } else {
        const data = await res.json();
        setProfileError(data.error || "Failed to update profile");
      }
    } catch { setProfileError("Failed to update profile"); }
    setSaving(false);
  }

  async function deleteProfile(id: string) {
    if (!confirm("Delete this warmup profile?")) return;
    setProfileError(null);
    try {
      const res = await fetch(`/api/warmup/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editingProfile === id) setEditingProfile(null);
        fetchData();
      } else {
        const data = await res.json();
        setProfileError(data.error || "Failed to delete profile");
      }
    } catch { setProfileError("Failed to delete profile"); }
  }

  async function toggleProfileActive(id: string, currentlyActive: boolean) {
    await fetch(`/api/warmup/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentlyActive }),
    });
    fetchData();
  }

  async function toggleWarmup(mailboxId: string, currentStatus: string) {
    const newStatus = currentStatus === "warming" ? "paused" : "warming";
    await fetch("/api/warmup/mailboxes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId, warmupStatus: newStatus }),
    });
    fetchData();
  }

  async function assignProfile(mailboxId: string, profileId: string) {
    await fetch("/api/warmup/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId, profileId }),
    });
    setAssigningProfile(null);
    fetchData();
  }

  function getTrustScoreColor(score: number) {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-danger";
  }

  function getTrustScoreBg(score: number) {
    if (score >= 80) return "bg-success";
    if (score >= 60) return "bg-warning";
    return "bg-danger";
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatDateShort(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function timeAgo(d: string | null) {
    if (!d) return "Never";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  if (loading) {
    return <div className="panel p-8 text-center text-muted text-[13px]">Loading warmup data...</div>;
  }

  const warmingCount = mailboxes.filter(m => m.warmupStatus === "warming").length;
  const stableCount = mailboxes.filter(m => m.warmupStatus === "stable").length;
  const atRiskCount = mailboxes.filter(m => m.warmupStatus === "at_risk").length;
  const pausedCount = mailboxes.filter(m => m.warmupStatus === "paused").length;
  const totalSentAll = mailboxes.reduce((sum, m) => sum + (m.warmupJobs?.[0]?.totalSent || 0), 0);
  const totalBouncesAll = mailboxes.reduce((sum, m) => sum + (m.warmupJobs?.[0]?.totalBounces || 0), 0);
  const totalRepliesAll = mailboxes.reduce((sum, m) => sum + (m.warmupJobs?.[0]?.totalReplies || 0), 0);
  const avgTrustScore = mailboxes.length > 0 ? mailboxes.reduce((sum, m) => sum + (m.trustScore || 0), 0) / mailboxes.length : 0;

  return (
    <div>
      {/* ── Overview Stats ── */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-6">
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Mailboxes</span>
          <p className="text-[22px] font-semibold text-foreground mt-1">{mailboxes.length}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Warming</span>
          <p className="text-[22px] font-semibold text-warning mt-1">{warmingCount}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Stable</span>
          <p className="text-[22px] font-semibold text-success mt-1">{stableCount}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">At Risk</span>
          <p className="text-[22px] font-semibold text-danger mt-1">{atRiskCount}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Total Sent</span>
          <p className="text-[22px] font-semibold text-info mt-1">{totalSentAll}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Replied</span>
          <p className="text-[22px] font-semibold text-success mt-1">{totalRepliesAll}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Bounce Rate</span>
          <p className={`text-[22px] font-semibold mt-1 ${totalSentAll > 0 && (totalBouncesAll / totalSentAll) * 100 > 5 ? "text-danger" : "text-foreground"}`}>
            {totalSentAll > 0 ? ((totalBouncesAll / totalSentAll) * 100).toFixed(1) : "0.0"}%
          </p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Trust Score</span>
          <p className={`text-[22px] font-semibold mt-1 ${avgTrustScore >= 80 ? "text-success" : avgTrustScore >= 50 ? "text-warning" : "text-danger"}`}>
            {avgTrustScore.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* ── Mailboxes Panel ── */}
        <div className="col-span-2">
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <IconWarmup size={16} className="text-accent" />
                Mailbox Warmup Status
              </h3>
              <button onClick={() => fetchData()} className="btn-ghost !py-1.5 !text-[11px] cursor-pointer">
                <IconRefresh size={12} /> Refresh
              </button>
            </div>

            {mailboxes.length === 0 ? (
              <div className="p-8 text-center text-muted text-[13px]">
                <IconWarmup size={32} className="mx-auto mb-3 opacity-20" />
                <p>No mailboxes configured</p>
                <p className="text-[11px] mt-1 opacity-60">Add email accounts and domains to start warmup</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mailboxes.map(mb => {
                  const health = mb.healthSnapshots?.[0];
                  const job = mb.warmupJobs?.[0];
                  const statusInfo = WARMUP_STATUS_STYLES[mb.warmupStatus] || WARMUP_STATUS_STYLES.none;
                  const isExpanded = expandedMailbox === mb.id;

                  return (
                    <div key={mb.id} className={`transition ${isExpanded ? "bg-card-elevated" : ""}`}>
                      {/* ── Mailbox Row ── */}
                      <div
                        className="p-4 hover:bg-card-hover transition cursor-pointer"
                        onClick={() => handleExpandMailbox(mb.id)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                              <IconChevronRight size={14} className="text-muted" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`} style={{ boxShadow: mb.warmupStatus === "warming" ? "0 0 6px var(--warning)" : mb.warmupStatus === "at_risk" ? "0 0 6px var(--danger)" : "none" }} />
                                <span className="text-[13px] font-medium text-foreground">{mb.email}</span>
                                <span className={`badge !text-[10px] ${statusInfo.badge}`}>{statusInfo.label}</span>
                              </div>
                              <p className="text-[11px] text-muted mt-0.5 ml-4">{mb.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                            {!job && profiles.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={() => setAssigningProfile(assigningProfile === mb.id ? null : mb.id)}
                                  className="btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer !text-accent"
                                >
                                  <IconPlus size={12} /> Assign Profile
                                </button>
                                {assigningProfile === mb.id && (
                                  <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[180px]">
                                    {profiles.map(p => (
                                      <button
                                        key={p.id}
                                        onClick={() => assignProfile(mb.id, p.id)}
                                        className="w-full text-left px-3 py-2 text-[12px] text-foreground hover:bg-card-hover rounded transition cursor-pointer"
                                      >
                                        <span className="font-medium">{p.name}</span>
                                        <span className="text-muted ml-2">{p.startVolume}→{p.maxVolume}/day</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => toggleWarmup(mb.id, mb.warmupStatus)}
                              className={`btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer ${
                                mb.warmupStatus === "warming" ? "!text-warning" : "!text-success"
                              }`}
                            >
                              {mb.warmupStatus === "warming" ? <><IconPause size={12} /> Pause</> : <><IconPlay size={12} /> Start</>}
                            </button>
                          </div>
                        </div>

                        {/* ── Metrics Row ── */}
                        <div className="grid grid-cols-6 gap-3 ml-7">
                          <div>
                            <span className="text-[10px] text-muted">Trust Score</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className={`text-[15px] font-semibold ${getTrustScoreColor(mb.trustScore)}`}>
                                {mb.trustScore.toFixed(0)}
                              </p>
                              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${getTrustScoreBg(mb.trustScore)}`} style={{ width: `${mb.trustScore}%`, opacity: 0.7 }} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted">Daily Volume</span>
                            <p className="text-[14px] font-semibold text-foreground mt-0.5">
                              {mb.currentVolume}<span className="text-muted text-[11px]">/{mb.dailySendLimit}</span>
                            </p>
                            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-0.5">
                              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${mb.dailySendLimit > 0 ? Math.min((mb.currentVolume / mb.dailySendLimit) * 100, 100) : 0}%` }} />
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted">Bounce Rate</span>
                            <p className={`text-[14px] font-semibold mt-0.5 ${(health?.bounceRate || 0) > 5 ? "text-danger" : "text-foreground"}`}>
                              {(health?.bounceRate || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted">Reply Rate</span>
                            <p className="text-[14px] font-semibold text-foreground mt-0.5">
                              {(health?.replyRate || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted">Last Run</span>
                            <p className="text-[12px] font-medium text-muted-foreground mt-1">
                              {job?.lastRunAt ? timeAgo(job.lastRunAt) : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted">DNS</span>
                            <div className="flex gap-1.5 mt-1">
                              {(["spf", "dkim", "dmarc"] as const).map(check => {
                                const status = (health?.[`${check}Status` as keyof MailboxHealth] as string) || "unknown";
                                const info = DNS_STATUS_ICON[status] || DNS_STATUS_ICON.unknown;
                                return (
                                  <span key={check} className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${info.color}`}
                                    style={{ background: status === "pass" ? "var(--success-dim)" : status === "fail" ? "var(--danger-dim)" : "rgba(92,99,112,0.15)" }}
                                    title={`${check.toUpperCase()}: ${info.label}`}
                                  >
                                    {check}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* ── Active Job Summary Bar ── */}
                        {job && (
                          <div className="mt-3 ml-7 p-2.5 rounded-lg bg-card border border-border flex items-center gap-5 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <IconWarmup size={12} className="text-accent" />
                              <span className="text-accent font-medium">{job.profile.name}</span>
                            </div>
                            <div className="h-3 w-px bg-border" />
                            <div className="flex items-center gap-1">
                              <IconSend size={11} className="text-muted" />
                              <span className="text-muted">Sent:</span>
                              <span className="text-foreground font-medium">{job.totalSent}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <IconCheck size={11} className="text-success" />
                              <span className="text-muted">Replies:</span>
                              <span className="text-success font-medium">{job.totalReplies}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <IconAlert size={11} className="text-danger" />
                              <span className="text-muted">Bounces:</span>
                              <span className="text-danger font-medium">{job.totalBounces}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <IconTrendUp size={11} className="text-info" />
                              <span className="text-muted">Vol:</span>
                              <span className="text-foreground font-medium">{job.currentVolume}/{job.profile.maxVolume}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                              <IconClock size={11} className="text-muted" />
                              <span className="text-muted">{job.lastRunAt ? timeAgo(job.lastRunAt) : "Not started"}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Expanded Detail View ── */}
                      {isExpanded && (
                        <div className="border-t border-border">
                          {/* Tabs */}
                          <div className="flex gap-0 border-b border-border bg-card">
                            {(
                              [
                                { key: "activity" as const, label: "Activity Log", icon: <IconBarChart size={12} /> },
                                { key: "messages" as const, label: "Warmup Messages", icon: <IconMail size={12} /> },
                                { key: "health" as const, label: "Health History", icon: <IconShield size={12} /> },
                              ] as const
                            ).map(tab => (
                              <button
                                key={tab.key}
                                onClick={() => setDetailTab(tab.key)}
                                className={`px-4 py-2.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                  detailTab === tab.key
                                    ? "border-accent text-accent"
                                    : "border-transparent text-muted hover:text-foreground"
                                }`}
                              >
                                {tab.icon} {tab.label}
                              </button>
                            ))}
                          </div>

                          {detailLoading ? (
                            <div className="p-6 text-center text-muted text-[12px]">Loading details...</div>
                          ) : (
                            <div className="p-4">
                              {detailTab === "activity" && (
                                <ActivityLogView mailbox={detailData || mb} formatDate={formatDate} />
                              )}
                              {detailTab === "messages" && (
                                <MessagesView mailbox={detailData || mb} formatDate={formatDate} />
                              )}
                              {detailTab === "health" && (
                                <HealthHistoryView mailbox={detailData || mb} formatDateShort={formatDateShort} />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="col-span-1 space-y-4">
          {/* Warmup Profiles */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold">Warmup Profiles</h3>
              <button onClick={() => setShowAddProfile(!showAddProfile)} className="btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer">
                <IconPlus size={12} /> Add
              </button>
            </div>

            {showAddProfile && (
              <div className="p-4 border-b border-border bg-card-elevated space-y-3">
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="input-field !text-[12px]" placeholder="Profile name" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Start Vol</label>
                    <input type="number" value={startVol} onChange={e => setStartVol(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Vol</label>
                    <input type="number" value={maxVol} onChange={e => setMaxVol(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Ramp/Day</label>
                    <input type="number" value={rampInc} onChange={e => setRampInc(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Seed Addresses (comma-separated)</label>
                  <textarea
                    value={seedAddresses}
                    onChange={e => setSeedAddresses(e.target.value)}
                    className="input-field !text-[11px] !py-1.5 min-h-[60px]"
                    placeholder="seed1@gmail.com, seed2@outlook.com, seed3@yahoo.com"
                  />
                  <p className="text-[9px] text-muted mt-1">Warmup emails will be sent to these addresses. Use inboxes you control for best results.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddProfile(false)} className="btn-ghost !text-[11px] !py-1.5 flex-1 cursor-pointer">Cancel</button>
                  <button onClick={createProfile} disabled={saving} className="btn-primary !text-[11px] !py-1.5 flex-1 cursor-pointer">
                    {saving ? "..." : "Create"}
                  </button>
                </div>
              </div>
            )}

            {profileError && (
              <div className="px-4 py-2 bg-danger/10 border-b border-danger/20 text-danger text-[11px] flex items-center gap-2">
                <IconAlert size={12} />
                <span className="flex-1">{profileError}</span>
                <button onClick={() => setProfileError(null)} className="cursor-pointer"><IconX size={12} /></button>
              </div>
            )}

            {profiles.length === 0 && !showAddProfile ? (
              <div className="p-6 text-center text-muted text-[12px]">No profiles yet</div>
            ) : (
              <div className="divide-y divide-border">
                {profiles.map(p => {
                  const activeJobs = p.jobs?.filter(j => j.status === "active").length || 0;
                  const isEditing = editingProfile === p.id;

                  if (isEditing) {
                    return (
                      <div key={p.id} className="p-3 bg-card-elevated space-y-2">
                        <input
                          type="text"
                          value={editProfileName}
                          onChange={e => setEditProfileName(e.target.value)}
                          className="input-field !text-[12px]"
                          placeholder="Profile name"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted block mb-1">Start Vol</label>
                            <input type="number" value={editStartVol} onChange={e => setEditStartVol(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted block mb-1">Max Vol</label>
                            <input type="number" value={editMaxVol} onChange={e => setEditMaxVol(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted block mb-1">Ramp/Day</label>
                            <input type="number" value={editRampInc} onChange={e => setEditRampInc(parseInt(e.target.value) || 0)} className="input-field !text-[11px] !py-1.5" min={1} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted block mb-1">Seed Addresses</label>
                          <textarea
                            value={editSeeds}
                            onChange={e => setEditSeeds(e.target.value)}
                            className="input-field !text-[11px] !py-1.5 min-h-[50px]"
                            placeholder="seed1@gmail.com, seed2@outlook.com"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingProfile(null)} className="btn-ghost !text-[11px] !py-1.5 flex-1 cursor-pointer">Cancel</button>
                          <button onClick={() => updateProfile(p.id)} disabled={saving} className="btn-primary !text-[11px] !py-1.5 flex-1 cursor-pointer">
                            {saving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} className="p-3 hover:bg-card-hover transition group">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-foreground">{p.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleProfileActive(p.id, p.isActive)}
                            className={`badge !text-[9px] cursor-pointer border-none ${p.isActive ? "badge-success" : "badge-muted"}`}
                            title={p.isActive ? "Click to deactivate" : "Click to activate"}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </button>
                          <button
                            onClick={() => startEditProfile(p)}
                            className="btn-ghost !py-0.5 !px-1.5 !text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Edit profile"
                          >
                            <IconEdit size={11} />
                          </button>
                          <button
                            onClick={() => deleteProfile(p.id)}
                            className="btn-ghost !py-0.5 !px-1.5 !text-[10px] !text-danger opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Delete profile"
                          >
                            <IconTrash size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted mt-1">
                        {p.startVolume} → {p.maxVolume}/day · +{p.rampIncrement}/day
                      </p>
                      {p.seedAddresses && (
                        <p className="text-[10px] text-info mt-0.5">
                          {p.seedAddresses.split(",").filter((e: string) => e.trim()).length} seed address{p.seedAddresses.split(",").filter((e: string) => e.trim()).length !== 1 ? "es" : ""}
                        </p>
                      )}
                      {!p.seedAddresses && (
                        <p className="text-[10px] text-danger mt-0.5">⚠ No seed addresses</p>
                      )}
                      {activeJobs > 0 && (
                        <p className="text-[10px] text-accent mt-0.5">
                          {activeJobs} mailbox{activeJobs > 1 ? "es" : ""} using this profile
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Autonomous Warmup Engine */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <IconSend size={14} className="text-accent" />
                Warmup Engine
              </h3>
              {autoRunning ? (
                <span className="badge !text-[9px] badge-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Auto-Running
                </span>
              ) : (
                <span className="badge !text-[9px] badge-muted">Stopped</span>
              )}
            </div>
            <div className="panel-body space-y-3">
              {/* Status row */}
              <div className="text-[11px] text-muted space-y-1">
                <div className="flex justify-between">
                  <span>Active Jobs</span>
                  <span className="text-foreground font-medium">{lastRunInfo?.activeJobs ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sent Today</span>
                  <span className="text-foreground font-medium">{lastRunInfo?.todaySent ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Run</span>
                  <span className="text-foreground font-medium">{lastRunInfo?.lastRunAt ? timeAgo(lastRunInfo.lastRunAt) : "Never"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Zapier MCP</span>
                  {engageStatus?.zapierConfigured ? (
                    <span className="text-success font-medium">Connected</span>
                  ) : (
                    <span className="text-danger font-medium">Not Set</span>
                  )}
                </div>
              </div>

              {/* Auto-run toggle button */}
              <button
                onClick={toggleAutoRun}
                className={`w-full !text-[12px] !py-2.5 cursor-pointer font-semibold ${
                  autoRunning
                    ? "btn-primary !bg-danger hover:!bg-danger/90"
                    : "btn-primary !bg-success hover:!bg-success/90"
                }`}
              >
                {autoRunning ? (
                  <><IconPause size={13} /> Stop Autonomous Warmup</>
                ) : (
                  <><IconPlay size={13} /> Start Autonomous Warmup</>
                )}
              </button>

              {autoRunning && (
                <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-[10px] text-success">
                  <p className="font-medium">Autonomous warmup active</p>
                  <p className="text-muted mt-0.5">Runs every 3 minutes: sends emails → checks Gmail → opens/replies</p>
                </div>
              )}

              {/* Divider with manual controls */}
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Manual Controls</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={runWarmupNow}
                    disabled={executing}
                    className="btn-ghost !text-[11px] !py-1.5 cursor-pointer"
                  >
                    {executing ? (
                      <><IconRefresh size={11} className="animate-spin" /> Sending...</>
                    ) : (
                      <><IconSend size={11} /> Send Now</>
                    )}
                  </button>
                  <button
                    onClick={runEngageNow}
                    disabled={engaging || !engageStatus?.zapierConfigured}
                    className="btn-ghost !text-[11px] !py-1.5 cursor-pointer"
                  >
                    {engaging ? (
                      <><IconRefresh size={11} className="animate-spin" /> Engaging...</>
                    ) : (
                      <><IconMail size={11} /> Engage Now</>
                    )}
                  </button>
                </div>
              </div>

              {/* Results */}
              {execResult && (
                <div className="p-2.5 rounded-lg bg-info/10 border border-info/20 text-[11px]">
                  <p className="text-info font-medium">{execResult.message}</p>
                  <p className="text-muted mt-1">{execResult.totalSent} emails sent</p>
                </div>
              )}

              {engageResult && (
                <div className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-[11px]">
                  <p className="text-success font-medium">{engageResult.message}</p>
                  <p className="text-muted mt-1">
                    Found {engageResult.emailsFound} · Replied {engageResult.emailsReplied} · Labeled {engageResult.emailsLabeled}
                  </p>
                </div>
              )}

              {/* Engage Stats */}
              <div className="border-t border-border pt-3 space-y-1">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wider mb-1">Gmail Engagement</p>
                <div className="text-[11px] text-muted space-y-1">
                  <div className="flex justify-between">
                    <span>Pending</span>
                    <span className="text-warning font-medium">{engageStatus?.pendingEngagement ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opened</span>
                    <span className="text-foreground font-medium">{engageStatus?.totalOpened ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Replied</span>
                    <span className="text-success font-medium">{engageStatus?.totalReplied ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className="text-[9px] text-muted border-t border-border pt-2 space-y-0.5">
                <p className="font-medium text-muted-foreground">Autonomous Loop:</p>
                <p>1. <span className="text-accent">Send</span> warmup emails via Resend</p>
                <p>2. <span className="text-success">Engage</span> Gmail → open, star, reply (~40%)</p>
                <p>3. Trust score ramps up automatically</p>
                <p>4. Repeats every 3 min via cron</p>
              </div>
            </div>
          </div>

          {/* Warmup Schedule */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold">Ramp Schedule</h3>
            </div>
            <div className="panel-body">
              {mailboxes.filter(m => m.warmupStatus === "warming" && m.warmupJobs?.[0]).length === 0 ? (
                <p className="text-[12px] text-muted text-center py-2">No active warmup schedules</p>
              ) : (
                <div className="space-y-3">
                  {mailboxes
                    .filter(m => m.warmupStatus === "warming" && m.warmupJobs?.[0])
                    .map(mb => {
                      const job = mb.warmupJobs[0];
                      const pct = job.profile.maxVolume > 0 ? Math.min((job.currentVolume / job.profile.maxVolume) * 100, 100) : 0;
                      const daysRemaining = job.profile.maxVolume > job.currentVolume
                        ? Math.ceil((job.profile.maxVolume - job.currentVolume) / (job.profile.rampIncrement || 2))
                        : 0;
                      return (
                        <div key={mb.id} className="p-2 rounded-lg bg-card-elevated border border-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium text-foreground truncate max-w-[140px]">{mb.email}</span>
                            <span className="text-[10px] text-muted">{daysRemaining > 0 ? `~${daysRemaining}d left` : "At max"}</span>
                          </div>
                          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, var(--accent), var(--warning))`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px] text-muted">{job.currentVolume}/day</span>
                            <span className="text-[9px] text-muted">{job.profile.maxVolume}/day</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Zapier MCP Integration */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <IconRefresh size={14} className="text-warning" />
                Gmail Automation
              </h3>
              {engageStatus?.zapierConfigured ? (
                <span className="badge !text-[9px] badge-success">Live</span>
              ) : (
                <span className="badge !text-[9px] badge-danger">Offline</span>
              )}
            </div>
            <div className="panel-body space-y-3 text-[11px]">
              <div className={`p-2.5 rounded-lg border ${engageStatus?.zapierConfigured ? "bg-success/10 border-success/20" : "bg-danger/10 border-danger/20"}`}>
                <p className={`font-medium text-[12px] mb-1 ${engageStatus?.zapierConfigured ? "text-success" : "text-danger"}`}>
                  {engageStatus?.zapierConfigured ? "Zapier MCP Connected" : "Zapier MCP Not Connected"}
                </p>
                <p className="text-muted">
                  {engageStatus?.zapierConfigured
                    ? "Direct Gmail control — no manual Zapier workflow needed."
                    : "Add ZAPIER_MCP_TOKEN to .env to enable Gmail automation."
                  }
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Closed-Loop Flow</p>
                <div className="space-y-1.5">
                  {[
                    { step: "1", text: "Resend sends warmup → seed Gmail", color: "text-accent" },
                    { step: "2", text: "Zapier MCP finds email in Gmail", color: "text-warning" },
                    { step: "3", text: "Auto-stars & marks important", color: "text-info" },
                    { step: "4", text: "AI generates natural reply", color: "text-success" },
                    { step: "5", text: "Reply sent FROM Gmail account", color: "text-accent" },
                    { step: "6", text: "Resend sees reply → trust ↑", color: "text-success" },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-2">
                      <span className={`text-[10px] font-bold ${item.color} w-3 flex-shrink-0`}>{item.step}</span>
                      <span className="text-muted">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-info/10 border border-info/20 text-[10px] text-muted">
                <p className="text-info font-medium mb-0.5">Key Signals Being Sent</p>
                <p>• Email opened (not spam) ✓</p>
                <p>• Marked as Important ✓</p>
                <p>• Human-like reply at ~40% rate ✓</p>
                <p>• Reply sent from real Gmail ✓</p>
                <p>• Staggered 5-50min reply delay ✓</p>
              </div>
            </div>
          </div>

          {/* Trust Score Formula */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold">Trust Score Formula</h3>
            </div>
            <div className="panel-body space-y-2 text-[11px]">
              {[
                { label: "SPF/DKIM/DMARC", weight: 20, color: "bg-success" },
                { label: "Domain Age", weight: 10, color: "bg-info" },
                { label: "Sending Consistency", weight: 15, color: "bg-accent" },
                { label: "Hard Bounce Rate", weight: 20, color: "bg-danger" },
                { label: "Reply Rate", weight: 15, color: "bg-warning" },
                { label: "Complaint Rate", weight: 10, color: "bg-danger" },
                { label: "Blacklist Status", weight: 10, color: "bg-muted" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-muted">{item.label}</span>
                    <span className="text-foreground">{item.weight}%</span>
                  </div>
                  <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.weight}%`, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Total</span>
                <span className="text-accent">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Activity Log Sub-component ── */
function ActivityLogView({ mailbox, formatDate }: { mailbox: Mailbox; formatDate: (d: string | null) => string }) {
  const jobs = mailbox.warmupJobs || [];

  if (jobs.length === 0) {
    return (
      <div className="text-center py-6 text-muted text-[12px]">
        <IconClock size={24} className="mx-auto mb-2 opacity-30" />
        <p>No warmup activity yet</p>
        <p className="text-[11px] mt-1 opacity-60">Assign a warmup profile to get started</p>
      </div>
    );
  }

  type TimelineEvent = {
    id: string;
    type: "job_created" | "job_status" | "message_bounced" | "message_replied" | "milestone";
    title: string;
    detail: string;
    time: string;
    color: string;
  };

  const events: TimelineEvent[] = [];

  for (const job of jobs) {
    events.push({
      id: `job-${job.id}`,
      type: "job_created",
      title: `Warmup job started`,
      detail: `Profile "${job.profile.name}" assigned · Starting at ${job.profile.startVolume || 2}/day`,
      time: job.createdAt,
      color: "text-accent",
    });

    if (job.lastRunAt) {
      events.push({
        id: `run-${job.id}`,
        type: "job_status",
        title: `Last execution`,
        detail: `Sent ${job.totalSent} total · ${job.currentVolume}/day current volume`,
        time: job.lastRunAt,
        color: "text-info",
      });
    }

    if (job.totalSent > 0 && job.totalSent % 50 === 0) {
      events.push({
        id: `milestone-${job.id}-${job.totalSent}`,
        type: "milestone",
        title: `Milestone: ${job.totalSent} emails sent`,
        detail: `${job.totalReplies} replies · ${job.totalBounces} bounces`,
        time: job.lastRunAt || job.createdAt,
        color: "text-success",
      });
    }

    const msgs = job.messages || [];
    for (const msg of msgs.slice(0, 10)) {
      if (msg.status === "bounced") {
        events.push({
          id: `msg-${msg.id}`,
          type: "message_bounced",
          title: `Bounce detected`,
          detail: `To: ${msg.toEmail} · "${msg.subject}"`,
          time: msg.sentAt,
          color: "text-danger",
        });
      } else if (msg.status === "replied") {
        events.push({
          id: `msg-${msg.id}`,
          type: "message_replied",
          title: `Reply received`,
          detail: `From: ${msg.toEmail} · "${msg.subject}"`,
          time: msg.sentAt,
          color: "text-success",
        });
      }
    }
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[12px] font-semibold text-foreground">Activity Timeline</h4>
        <span className="text-[10px] text-muted">{events.length} event{events.length !== 1 ? "s" : ""}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-[12px] text-muted text-center py-4">No activity recorded yet</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {events.slice(0, 20).map(ev => (
              <div key={ev.id} className="flex gap-3 relative">
                <div className={`w-[15px] h-[15px] rounded-full border-2 border-card-elevated flex-shrink-0 z-10 mt-0.5 ${
                  ev.type === "message_bounced" ? "bg-danger" :
                  ev.type === "message_replied" ? "bg-success" :
                  ev.type === "milestone" ? "bg-accent" :
                  ev.type === "job_created" ? "bg-info" :
                  "bg-muted"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-medium ${ev.color}`}>{ev.title}</span>
                    <span className="text-[10px] text-muted flex-shrink-0 ml-2">{formatDate(ev.time)}</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{ev.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Messages Sub-component ── */
function MessagesView({ mailbox, formatDate }: { mailbox: Mailbox; formatDate: (d: string | null) => string }) {
  const allMessages: WarmupMessageRecord[] = [];
  for (const job of mailbox.warmupJobs || []) {
    for (const msg of job.messages || []) {
      allMessages.push(msg);
    }
  }
  allMessages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const sent = allMessages.filter(m => m.status === "sent" || m.status === "delivered").length;
  const opened = allMessages.filter(m => m.status === "opened").length;
  const replied = allMessages.filter(m => m.status === "replied").length;
  const bounced = allMessages.filter(m => m.status === "bounced").length;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-2.5 rounded-lg bg-card border border-border text-center">
          <p className="text-[16px] font-semibold text-info">{sent}</p>
          <span className="text-[10px] text-muted">Sent</span>
        </div>
        <div className="p-2.5 rounded-lg bg-card border border-border text-center">
          <p className="text-[16px] font-semibold text-warning">{opened}</p>
          <span className="text-[10px] text-muted">Opened</span>
        </div>
        <div className="p-2.5 rounded-lg bg-card border border-border text-center">
          <p className="text-[16px] font-semibold text-success">{replied}</p>
          <span className="text-[10px] text-muted">Replied</span>
        </div>
        <div className="p-2.5 rounded-lg bg-card border border-border text-center">
          <p className="text-[16px] font-semibold text-danger">{bounced}</p>
          <span className="text-[10px] text-muted">Bounced</span>
        </div>
      </div>

      {allMessages.length === 0 ? (
        <div className="text-center py-6 text-muted text-[12px]">
          <IconMail size={24} className="mx-auto mb-2 opacity-30" />
          <p>No warmup messages sent yet</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-semibold text-foreground">Recent Messages</h4>
            <span className="text-[10px] text-muted">{allMessages.length} total</span>
          </div>
          <table className="brand-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>To</th>
                <th>Subject</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {allMessages.slice(0, 25).map(msg => {
                const statusStyle = MSG_STATUS_STYLES[msg.status] || MSG_STATUS_STYLES.sent;
                return (
                  <tr key={msg.id}>
                    <td>
                      <span className={`badge !text-[10px] ${
                        msg.status === "bounced" ? "badge-danger" :
                        msg.status === "replied" ? "badge-success" :
                        msg.status === "opened" ? "badge-warning" :
                        "badge-info"
                      }`}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="text-[12px] text-foreground">{msg.toEmail}</td>
                    <td className="text-[12px] text-muted-foreground max-w-[200px] truncate">{msg.subject}</td>
                    <td className="text-[11px] text-muted">{formatDate(msg.sentAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Health History Sub-component ── */
function HealthHistoryView({ mailbox, formatDateShort }: { mailbox: Mailbox; formatDateShort: (d: string) => string }) {
  const snapshots = mailbox.healthSnapshots || [];

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-6 text-muted text-[12px]">
        <IconShield size={24} className="mx-auto mb-2 opacity-30" />
        <p>No health snapshots recorded yet</p>
        <p className="text-[11px] mt-1 opacity-60">Health data is captured periodically during warmup</p>
      </div>
    );
  }

  const latest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];
  const trustDelta = latest.trustScore - oldest.trustScore;
  const bounceDelta = latest.bounceRate - oldest.bounceRate;
  const chartData = [...snapshots].reverse();

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted">Current Trust Score</span>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-[20px] font-bold ${latest.trustScore >= 80 ? "text-success" : latest.trustScore >= 60 ? "text-warning" : "text-danger"}`}>
              {latest.trustScore.toFixed(0)}
            </p>
            {snapshots.length > 1 && (
              <span className={`text-[11px] font-medium ${trustDelta >= 0 ? "text-success" : "text-danger"}`}>
                {trustDelta >= 0 ? "+" : ""}{trustDelta.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted">Spam Risk Score</span>
          <p className={`text-[20px] font-bold mt-1 ${latest.spamRiskScore > 50 ? "text-danger" : latest.spamRiskScore > 25 ? "text-warning" : "text-success"}`}>
            {latest.spamRiskScore.toFixed(0)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted">Bounce Trend</span>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-[20px] font-bold ${latest.bounceRate > 5 ? "text-danger" : "text-foreground"}`}>
              {latest.bounceRate.toFixed(1)}%
            </p>
            {snapshots.length > 1 && (
              <span className={`text-[11px] font-medium ${bounceDelta <= 0 ? "text-success" : "text-danger"}`}>
                {bounceDelta >= 0 ? "+" : ""}{bounceDelta.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="mb-4">
          <h4 className="text-[12px] font-semibold text-foreground mb-2">Trust Score Over Time</h4>
          <div className="p-3 rounded-lg bg-card border border-border">
            <div className="flex items-end gap-1 h-[80px]">
              {chartData.map((snap) => {
                const height = Math.max(snap.trustScore, 2);
                return (
                  <div key={snap.id} className="flex-1 flex flex-col items-center gap-1" title={`${formatDateShort(snap.createdAt)}: ${snap.trustScore.toFixed(0)}`}>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        background: snap.trustScore >= 80 ? "var(--success)" : snap.trustScore >= 60 ? "var(--warning)" : "var(--danger)",
                        opacity: 0.7,
                        minHeight: "2px",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] text-muted">{formatDateShort(chartData[0].createdAt)}</span>
              <span className="text-[9px] text-muted">{formatDateShort(chartData[chartData.length - 1].createdAt)}</span>
            </div>
          </div>
        </div>
      )}

      <h4 className="text-[12px] font-semibold text-foreground mb-2">Health Snapshots</h4>
      <table className="brand-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Trust</th>
            <th>Bounce</th>
            <th>Reply</th>
            <th>Open</th>
            <th>Volume</th>
            <th>DNS</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.slice(0, 15).map(snap => (
            <tr key={snap.id}>
              <td className="text-[11px]">{formatDateShort(snap.createdAt)}</td>
              <td>
                <span className={`text-[12px] font-semibold ${snap.trustScore >= 80 ? "text-success" : snap.trustScore >= 60 ? "text-warning" : "text-danger"}`}>
                  {snap.trustScore.toFixed(0)}
                </span>
              </td>
              <td className={`text-[12px] ${snap.bounceRate > 5 ? "text-danger font-medium" : ""}`}>
                {snap.bounceRate.toFixed(1)}%
              </td>
              <td className="text-[12px]">{snap.replyRate.toFixed(1)}%</td>
              <td className="text-[12px]">{snap.openRate.toFixed(1)}%</td>
              <td className="text-[12px]">{snap.dailyVolume}</td>
              <td>
                <span className={`text-[10px] font-medium ${snap.dnsHealthy ? "text-success" : "text-danger"}`}>
                  {snap.dnsHealthy ? "Healthy" : "Issues"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
