"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconSearch, IconStar, IconStarFilled, IconArchive, IconReply,
  IconBrain, IconCheck, IconX, IconTag, IconRefresh, IconClock,
} from "@/components/icons";

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
  classifications: AiClassification[];
  aiDrafts: AiDraft[];
  createdAt: string;
}

type InboxFilter = "all" | "unread" | "important" | "needs_reply" | "ai_handled";

const INTENT_COLORS: Record<string, string> = {
  lead: "badge-accent",
  existing_client: "badge-success",
  follow_up: "badge-warning",
  spam: "badge-danger",
  partnership: "badge-info",
  support: "badge-info",
  quote_request: "badge-accent",
  not_interested: "badge-muted",
};

const URGENCY_DOTS: Record<string, string> = {
  urgent: "bg-danger",
  high: "bg-warning",
  normal: "bg-info",
  low: "bg-muted",
};

export default function InboxPage() {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [stats, setStats] = useState({ unread: 0, needsReply: 0 });
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "inbox" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/email?${params}`);
      const data = await res.json();
      const msgs = data.messages || [];
      setMessages(msgs);
      setStats({
        unread: msgs.filter((m: EmailMessage) => !m.isRead).length,
        needsReply: msgs.filter((m: EmailMessage) =>
          m.direction === "inbound" && !m.isRead
        ).length,
      });
    } catch { /* empty */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filteredMessages = messages.filter((m) => {
    if (filter === "unread") return !m.isRead;
    if (filter === "important") return m.isStarred;
    if (filter === "needs_reply") return m.direction === "inbound" && !m.isRead;
    if (filter === "ai_handled") return m.aiDrafts?.some(d => d.status === "sent");
    return true;
  });

  async function toggleStar(id: string) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !msg.isStarred }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isStarred: !m.isStarred } : m));
  }

  async function markRead(id: string) {
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
  }

  async function archiveMessage(id: string) {
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function handleReply(messageId: string) {
    if (!replyText.trim() || !selected) return;
    setReplying(true);
    try {
      await fetch(`/api/email/${messageId}`, {
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
    setSelected(msg);
    if (!msg.isRead) markRead(msg.id);
  }

  const classification = selected?.classifications?.[0];
  const aiDraft = selected?.aiDrafts?.find(d => d.status === "draft");

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 240px)" }}>
      {/* Left panel - message list */}
      <div className="w-[400px] shrink-0 flex flex-col panel">
        <div className="px-4 py-3 border-b border-border flex items-center gap-4">
          <span className="text-[11px] text-muted uppercase tracking-wider font-medium">Inbox</span>
          <div className="flex gap-3 ml-auto">
            <span className="text-[11px]"><span className="text-info font-medium">{stats.unread}</span> <span className="text-muted">unread</span></span>
            <span className="text-[11px]"><span className="text-warning font-medium">{stats.needsReply}</span> <span className="text-muted">needs reply</span></span>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-border space-y-2">
          <div className="relative">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search inbox..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 !py-2 !text-[12px]"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "unread", "important", "needs_reply", "ai_handled"] as InboxFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2 py-1 rounded-md transition cursor-pointer ${
                  filter === f ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {f === "needs_reply" ? "Needs Reply" : f === "ai_handled" ? "AI Handled" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted text-[13px]">Loading...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-muted text-[13px]">No messages</div>
          ) : (
            filteredMessages.map(msg => {
              const cls = msg.classifications?.[0];
              return (
                <button
                  key={msg.id}
                  onClick={() => selectMessage(msg)}
                  className={`w-full text-left px-4 py-3 border-b border-border transition cursor-pointer ${
                    selected?.id === msg.id ? "bg-accent/5" : "hover:bg-card-hover"
                  } ${!msg.isRead ? "bg-card-elevated" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <button onClick={e => { e.stopPropagation(); toggleStar(msg.id); }} className="mt-0.5 shrink-0 cursor-pointer">
                      {msg.isStarred
                        ? <IconStarFilled size={14} className="text-warning" />
                        : <IconStar size={14} className="text-muted hover:text-warning" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!msg.isRead && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                        <span className={`text-[13px] truncate ${!msg.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {msg.fromName || msg.fromEmail}
                        </span>
                        {cls && (
                          <span className="ml-auto shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${URGENCY_DOTS[cls.urgency] || "bg-muted"}`} />
                          </span>
                        )}
                      </div>
                      <p className={`text-[12px] truncate mt-0.5 ${!msg.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                        {msg.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {cls?.label && (
                          <span className={`badge !text-[10px] !px-1.5 !py-0.5 ${INTENT_COLORS[cls.intent] || "badge-muted"}`}>
                            {cls.label}
                          </span>
                        )}
                        <span className="text-[10px] text-muted ml-auto">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-border">
          <button onClick={() => fetchMessages()} className="btn-ghost !py-1.5 !text-[11px] w-full justify-center cursor-pointer">
            <IconRefresh size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Right panel - message detail */}
      <div className="flex-1 panel flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted text-[13px]">
            <div className="text-center">
              <InboxIcon size={40} className="mx-auto mb-3 opacity-20" />
              <p>Select a message to view</p>
              <p className="text-[11px] mt-1 opacity-60">AI classification and suggested replies appear here</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-foreground truncate">{selected.subject}</h3>
                  <p className="text-[12px] text-muted mt-1">
                    From: <span className="text-muted-foreground">{selected.fromName || selected.fromEmail}</span>
                    <span className="mx-2">·</span>
                    To: <span className="text-muted-foreground">{selected.toEmail}</span>
                    <span className="mx-2">·</span>
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => toggleStar(selected.id)} className="p-1.5 rounded-md hover:bg-card-hover transition cursor-pointer">
                    {selected.isStarred ? <IconStarFilled size={16} className="text-warning" /> : <IconStar size={16} className="text-muted" />}
                  </button>
                  <button onClick={() => archiveMessage(selected.id)} className="p-1.5 rounded-md hover:bg-card-hover transition cursor-pointer">
                    <IconArchive size={16} className="text-muted hover:text-foreground" />
                  </button>
                </div>
              </div>

              {classification && (
                <div className="mt-3 p-3 rounded-lg bg-card-elevated border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <IconBrain size={14} className="text-accent" />
                    <span className="text-[11px] font-medium text-accent uppercase tracking-wider">AI Analysis</span>
                    <span className="text-[10px] text-muted ml-auto">{Math.round(classification.confidence * 100)}% confidence</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`badge !text-[10px] ${INTENT_COLORS[classification.intent] || "badge-muted"}`}>
                      <IconTag size={10} /> {classification.intent.replace(/_/g, " ")}
                    </span>
                    {classification.sentiment && (
                      <span className={`badge !text-[10px] ${
                        classification.sentiment === "positive" ? "badge-success" :
                        classification.sentiment === "negative" ? "badge-danger" : "badge-muted"
                      }`}>
                        {classification.sentiment}
                      </span>
                    )}
                    <span className={`badge !text-[10px] ${
                      classification.urgency === "urgent" ? "badge-danger" :
                      classification.urgency === "high" ? "badge-warning" : "badge-muted"
                    }`}>
                      <IconClock size={10} /> {classification.urgency}
                    </span>
                    {classification.suggestedAction && (
                      <span className="badge !text-[10px] badge-info">
                        → {classification.suggestedAction.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {classification.summary && (
                    <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{classification.summary}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selected.bodyHtml ? (
                <div className="text-[13px] leading-relaxed text-muted-foreground max-w-none"
                  dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
                />
              ) : (
                <pre className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{selected.bodyText}</pre>
              )}
            </div>

            {aiDraft && (
              <div className="px-5 py-3 border-t border-border" style={{ background: "rgba(232,127,36,0.03)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <IconBrain size={14} className="text-accent" />
                  <span className="text-[11px] font-medium text-accent">AI Suggested Reply</span>
                  <div className="ml-auto flex gap-1">
                    <button className="btn-primary !py-1 !px-2 !text-[11px]"><IconCheck size={12} /> Approve & Send</button>
                    <button className="btn-ghost !py-1 !px-2 !text-[11px]"><IconX size={12} /> Reject</button>
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground bg-card p-3 rounded-md border border-border"
                  dangerouslySetInnerHTML={{ __html: aiDraft.bodyHtml }}
                />
              </div>
            )}

            <div className="px-5 py-3 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="input-field !py-2 !text-[12px] flex-1 resize-none"
                  rows={2}
                />
                <button
                  onClick={() => handleReply(selected.id)}
                  disabled={!replyText.trim() || replying}
                  className="btn-primary !py-2 self-end cursor-pointer"
                >
                  <IconReply size={14} /> {replying ? "..." : "Reply"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InboxIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
