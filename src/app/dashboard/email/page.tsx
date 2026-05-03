"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconSearch, IconStar, IconStarFilled, IconArchive, IconReply,
  IconBrain, IconCheck, IconX, IconRefresh, IconSend, IconInbox,
  IconEye, IconClock, IconAlert, IconTag, IconZap,
} from "@/components/icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailEvent {
  id: string;
  type: string;
  metadata: string | null;
  createdAt: string;
}

interface AiClassification {
  id: string;
  intent: string;
  sentiment: string | null;
  urgency: string;
  confidence: number;
  summary: string | null;
  suggestedAction: string | null;
  label: string | null;
}

interface AiDraft {
  id: string;
  subject: string | null;
  bodyHtml: string;
  status: string;
}

interface EmailMessage {
  id: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  status: string;
  isRead: boolean;
  isArchived: boolean;
  isStarred: boolean;
  threadId: string | null;
  tags: string | null;
  events: EmailEvent[];
  classifications: AiClassification[];
  aiDrafts: AiDraft[];
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
  sent:      { label: "Sent",      className: "text-muted" },
  delivered: { label: "Delivered", className: "text-info" },
  opened:    { label: "Opened",    className: "text-success" },
  clicked:   { label: "Clicked",   className: "text-accent" },
  bounced:   { label: "Bounced",   className: "text-danger" },
  failed:    { label: "Failed",    className: "text-danger" },
  received:  { label: "Received",  className: "text-muted" },
};

const INTENT_BADGE: Record<string, string> = {
  lead:            "bg-accent/15 text-accent",
  existing_client: "bg-emerald-500/15 text-emerald-400",
  follow_up:       "bg-yellow-500/15 text-yellow-400",
  spam:            "bg-red-500/15 text-red-400",
  partnership:     "bg-blue-500/15 text-blue-400",
  support:         "bg-purple-500/15 text-purple-400",
  quote_request:   "bg-accent/15 text-accent",
  not_interested:  "bg-surface text-muted",
};

// Extract human-readable source from tags string
function getTagSource(tags: string | null): string | null {
  if (!tags) return null;
  if (tags.includes("type:lead_pitch")) return "Lead Pitch";
  if (tags.includes("type:invoice")) return "Invoice";
  if (tags.includes("mode:cold_outreach")) return "Cold Outreach";
  if (tags.includes("mode:follow_up")) return "Follow-Up";
  if (tags.includes("mode:reply")) return "Reply";
  if (tags.includes("mode:reactivation")) return "Reactivation";
  if (tags.includes("mode:meeting_request")) return "Meeting Request";
  return null;
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function fmtFull(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "inbox" | "sent";

export default function EmailPage() {
  const [view, setView] = useState<ViewMode>("inbox");
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view });
      if (search) params.set("search", search);
      const res = await fetch(`/api/email?${params}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* empty */ }
    setLoading(false);
  }, [view, search]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Keep selected message up to date after refetch
  useEffect(() => {
    if (selected) {
      const refreshed = messages.find((m) => m.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function toggleStar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !msg.isStarred }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: !m.isStarred } : m))
    );
  }

  async function markRead(id: string) {
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function archiveMessage(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function handleReply() {
    if (!replyText.trim() || !selected) return;
    setReplying(true);
    try {
      await fetch(`/api/email/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Re: ${selected.subject}`,
          html: replyText.replace(/\n/g, "<br>"),
        }),
      });
      setReplyText("");
      fetchMessages();
    } catch { /* empty */ }
    setReplying(false);
  }

  function selectMessage(msg: EmailMessage) {
    setSelected((prev) => (prev?.id === msg.id ? null : msg));
    if (!msg.isRead && msg.direction === "inbound") markRead(msg.id);
  }

  const classification = selected?.classifications?.[0];
  const aiDraft = selected?.aiDrafts?.find((d) => d.status === "draft");

  return (
    <div className="flex gap-0" style={{ height: "calc(100vh - 180px)" }}>
      {/* ── Message List ─────────────────────────────────────────── */}
      <div className="w-[380px] shrink-0 flex flex-col panel mr-4">
        {/* View switch */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <button
            onClick={() => { setView("inbox"); setSelected(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              view === "inbox" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            <IconInbox size={13} /> Inbox
            {unreadCount > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setView("sent"); setSelected(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              view === "sent" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            <IconSend size={13} /> Sent
          </button>
          <button onClick={fetchMessages} className="ml-auto p-1.5 text-muted hover:text-foreground transition">
            <IconRefresh size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={view === "inbox" ? "Search inbox..." : "Search sent..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 !py-2 !text-[12px]"
            />
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-muted text-[12px]">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-muted text-[12px]">
              {view === "inbox" ? "No messages in inbox" : "No sent emails yet"}
            </div>
          ) : (
            messages.map((msg) => {
              const source = getTagSource(msg.tags);
              const sc = STATUS_CONFIG[msg.status] || STATUS_CONFIG.sent;
              const isSelected = selected?.id === msg.id;
              return (
                <div
                  key={msg.id}
                  onClick={() => selectMessage(msg)}
                  className={`px-4 py-3 cursor-pointer transition group ${
                    isSelected ? "bg-accent/10" : "hover:bg-surface"
                  } ${!msg.isRead && msg.direction === "inbound" ? "bg-accent/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!msg.isRead && msg.direction === "inbound" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                        <span className={`text-[13px] truncate ${!msg.isRead && msg.direction === "inbound" ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                          {view === "inbox" ? (msg.fromName || msg.fromEmail) : msg.toEmail}
                        </span>
                      </div>
                      <p className="text-[12px] text-foreground/70 truncate mt-0.5">{msg.subject}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {source && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                            {source}
                          </span>
                        )}
                        {view === "sent" && (
                          <span className={`text-[10px] font-medium ${sc.className}`}>
                            {sc.label}
                          </span>
                        )}
                        {view === "inbox" && classification && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-medium ${INTENT_BADGE[classification.intent] || "bg-surface text-muted"}`}>
                            {classification.intent.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted">{fmt(msg.createdAt)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => toggleStar(msg.id, e)}
                          className="p-0.5 text-muted hover:text-yellow-400 transition"
                        >
                          {msg.isStarred ? <IconStarFilled size={12} className="text-yellow-400" /> : <IconStar size={12} />}
                        </button>
                        {view === "inbox" && (
                          <button
                            onClick={(e) => archiveMessage(msg.id, e)}
                            className="p-0.5 text-muted hover:text-foreground transition"
                          >
                            <IconArchive size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Message Detail ──────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 min-w-0 panel flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-foreground leading-tight">{selected.subject}</h3>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[12px] text-muted">
                  {selected.direction === "inbound" ? (
                    <>
                      <span>From: <span className="text-foreground/80">{selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}</span></span>
                      <span>To: <span className="text-foreground/80">{selected.toEmail}</span></span>
                    </>
                  ) : (
                    <>
                      <span>To: <span className="text-foreground/80">{selected.toEmail}</span></span>
                      <span>From: <span className="text-foreground/80">{selected.fromEmail}</span></span>
                    </>
                  )}
                  <span>{fmtFull(selected.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => toggleStar(selected.id, e)}
                  className="p-1.5 text-muted hover:text-yellow-400 transition"
                >
                  {selected.isStarred ? <IconStarFilled size={15} className="text-yellow-400" /> : <IconStar size={15} />}
                </button>
                {selected.direction === "inbound" && (
                  <button
                    onClick={(e) => archiveMessage(selected.id, e)}
                    className="p-1.5 text-muted hover:text-foreground transition"
                    title="Archive"
                  >
                    <IconArchive size={15} />
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 text-muted hover:text-foreground transition"
                >
                  <IconX size={15} />
                </button>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {(() => {
                const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG.sent;
                const StatusIcon = selected.status === "opened" ? IconEye
                  : selected.status === "clicked" ? IconZap
                  : selected.status === "bounced" ? IconAlert
                  : selected.status === "delivered" ? IconCheck
                  : selected.status === "sent" || selected.status === "received" ? IconSend
                  : null;
                return (
                  <span className={`flex items-center gap-1 text-[11px] font-medium ${sc.className}`}>
                    {StatusIcon && <StatusIcon size={11} />}
                    {sc.label}
                  </span>
                );
              })()}
              {getTagSource(selected.tags) && (
                <span className="flex items-center gap-1 text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  <IconTag size={10} /> {getTagSource(selected.tags)}
                </span>
              )}
              {classification && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize font-medium ${INTENT_BADGE[classification.intent] || "bg-surface text-muted"}`}>
                  <IconBrain size={10} className="inline mr-0.5" />
                  {classification.intent.replace("_", " ")}
                  {classification.urgency === "urgent" && " · urgent"}
                </span>
              )}
            </div>
          </div>

          {/* AI summary + action */}
          {classification?.summary && (
            <div className="mx-6 mt-4 px-4 py-3 bg-surface rounded-lg border border-border text-[12px] text-muted leading-relaxed flex items-start gap-2">
              <IconBrain size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">AI: </span>
                {classification.summary}
                {classification.suggestedAction && (
                  <span className="block mt-1 text-accent">
                    → Suggested: {classification.suggestedAction.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selected.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none text-foreground/90 text-[13px] leading-relaxed [&_a]:text-accent [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
              />
            ) : (
              <pre className="text-[12px] text-muted whitespace-pre-wrap leading-relaxed font-sans">
                {selected.bodyText || "(No content)"}
              </pre>
            )}
          </div>

          {/* Event timeline (delivery tracking) */}
          {selected.events.length > 0 && (
            <div className="px-6 py-3 border-t border-border bg-surface/50">
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Delivery Timeline</p>
              <div className="flex items-center gap-0">
                {selected.events.map((ev, i) => {
                  const sc = STATUS_CONFIG[ev.type] || { label: ev.type, className: "text-muted" };
                  const EventIcon = ev.type === "opened" ? IconEye
                    : ev.type === "clicked" ? IconZap
                    : ev.type === "bounced" ? IconAlert
                    : ev.type === "delivered" ? IconCheck
                    : ev.type === "sent" ? IconSend
                    : IconClock;
                  return (
                    <div key={ev.id} className="flex items-center gap-0">
                      <div className="flex flex-col items-center">
                        <div className={`flex items-center gap-1 text-[11px] font-medium ${sc.className}`}>
                          <EventIcon size={11} /> {sc.label}
                        </div>
                        <span className="text-[9px] text-muted">{fmt(ev.createdAt)}</span>
                      </div>
                      {i < selected.events.length - 1 && (
                        <div className="w-6 h-px bg-border mx-1.5 self-start mt-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI draft banner */}
          {aiDraft && (
            <div className="px-6 py-3 border-t border-border bg-accent/5">
              <p className="text-[11px] text-accent font-medium mb-2 flex items-center gap-1.5">
                <IconBrain size={12} /> AI Draft Ready
              </p>
              <div
                className="text-[12px] text-muted leading-relaxed line-clamp-3"
                dangerouslySetInnerHTML={{ __html: aiDraft.bodyHtml }}
              />
            </div>
          )}

          {/* Reply box (inbox only) */}
          {selected.direction === "inbound" && (
            <div className="px-6 py-4 border-t border-border">
              {aiDraft && (
                <button
                  onClick={() => setReplyText(aiDraft.bodyHtml.replace(/<[^>]+>/g, ""))}
                  className="mb-2 text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  <IconBrain size={11} /> Use AI draft
                </button>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selected.fromEmail}…`}
                  rows={3}
                  className="input-field flex-1 resize-none text-[13px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
                  }}
                />
                <button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="btn-primary flex items-center gap-1.5 text-[13px] shrink-0"
                >
                  {replying ? <IconRefresh size={13} className="animate-spin" /> : <IconReply size={13} />}
                  {replying ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1.5">⌘+Enter to send</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 panel flex items-center justify-center">
          <div className="text-center">
            <IconInbox size={40} className="text-muted mx-auto mb-3 opacity-30" />
            <p className="text-[13px] text-muted">
              {view === "inbox" ? "Select a message to read" : "Select a sent email to view delivery status"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

