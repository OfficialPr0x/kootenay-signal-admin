"use client";

import { useState, useEffect } from "react";
import { IconSend, IconBrain, IconTemplate, IconPlus, IconX } from "@/components/icons";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: string | null;
}

interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
}

type ComposeMode = "cold_outreach" | "follow_up" | "reply" | "reactivation" | "offer" | "meeting_request";

const COMPOSE_MODES: { key: ComposeMode; label: string }[] = [
  { key: "cold_outreach", label: "Cold Outreach" },
  { key: "follow_up", label: "Follow-Up" },
  { key: "reply", label: "Reply" },
  { key: "reactivation", label: "Reactivation" },
  { key: "offer", label: "Offer" },
  { key: "meeting_request", label: "Meeting Request" },
];

export default function ComposePage() {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("cold_outreach");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  useEffect(() => {
    fetch("/api/email/templates").then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => {});
    fetch("/api/email/contacts").then(r => r.json()).then(d => setContacts(d.contacts || [])).catch(() => {});
  }, []);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, subject, and body are required");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.split(",").map(e => e.trim()).filter(Boolean),
          subject,
          html: body.replace(/\n/g, "<br>"),
          ...(cc && { cc: cc.split(",").map(e => e.trim()).filter(Boolean) }),
          ...(bcc && { bcc: bcc.split(",").map(e => e.trim()).filter(Boolean) }),
          tags: [{ name: "mode", value: composeMode }],
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          setTo(""); setCc(""); setBcc(""); setSubject(""); setBody("");
          setSent(false);
        }, 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send");
      }
    } catch {
      setError("Network error");
    }
    setSending(false);
  }

  function applyTemplate(tpl: EmailTemplate) {
    setSubject(tpl.subject);
    setBody(tpl.bodyHtml.replace(/<[^>]+>/g, ""));
    setShowTemplates(false);
  }

  function addContact(contact: EmailContact) {
    const current = to ? to + ", " : "";
    setTo(current + contact.email);
    setShowContacts(false);
    setContactSearch("");
  }

  const filteredContacts = contacts.filter(c =>
    c.email.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  if (sent) {
    return (
      <div className="panel p-12 text-center fade-in">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <IconSend size={20} className="text-success" />
        </div>
        <h3 className="text-[16px] font-semibold text-foreground">Email Sent</h3>
        <p className="text-[13px] text-muted mt-1">Your message has been delivered</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="panel">
        {/* Mode selector */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <IconBrain size={14} className="text-accent" />
            <span className="text-[11px] font-medium text-accent uppercase tracking-wider">Compose Mode</span>
          </div>
          <div className="flex gap-1 mt-2">
            {COMPOSE_MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setComposeMode(m.key)}
                className={`text-[11px] px-3 py-1.5 rounded-md transition cursor-pointer ${
                  composeMode === m.key ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* To field */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-[12px] text-muted w-10 shrink-0">To</label>
            <div className="flex-1 relative">
              <input
                type="text"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="input-field !py-2 !text-[13px]"
              />
              <button
                onClick={() => setShowContacts(!showContacts)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-card-hover transition cursor-pointer"
                title="Browse contacts"
              >
                <IconPlus size={14} className="text-muted" />
              </button>
            </div>
            {!showCcBcc && (
              <button onClick={() => setShowCcBcc(true)} className="text-[11px] text-muted hover:text-foreground cursor-pointer">
                Cc/Bcc
              </button>
            )}
          </div>

          {/* Contact picker dropdown */}
          {showContacts && (
            <div className="mt-2 ml-[52px] bg-card-elevated border border-border rounded-lg p-2 max-h-48 overflow-y-auto">
              <input
                type="text"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="input-field !py-1.5 !text-[11px] mb-2"
                autoFocus
              />
              {filteredContacts.length === 0 ? (
                <p className="text-[11px] text-muted p-2">No contacts found</p>
              ) : (
                filteredContacts.slice(0, 10).map(c => (
                  <button
                    key={c.id}
                    onClick={() => addContact(c)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-card-hover text-[12px] cursor-pointer"
                  >
                    <span className="text-foreground">{c.name || c.email}</span>
                    {c.name && <span className="text-muted ml-2">{c.email}</span>}
                    {c.company && <span className="text-muted ml-2">· {c.company}</span>}
                  </button>
                ))
              )}
            </div>
          )}

          {showCcBcc && (
            <>
              <div className="flex items-center gap-3 mt-2">
                <label className="text-[12px] text-muted w-10 shrink-0">Cc</label>
                <input type="text" value={cc} onChange={e => setCc(e.target.value)} className="input-field !py-2 !text-[13px] flex-1" />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <label className="text-[12px] text-muted w-10 shrink-0">Bcc</label>
                <input type="text" value={bcc} onChange={e => setBcc(e.target.value)} className="input-field !py-2 !text-[13px] flex-1" />
              </div>
            </>
          )}
        </div>

        {/* Subject */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-[12px] text-muted w-10 shrink-0">Subj</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="input-field !py-2 !text-[13px] flex-1"
            />
          </div>
        </div>

        {/* Template picker */}
        <div className="px-5 py-2 border-b border-border flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="btn-ghost !py-1.5 !text-[11px] cursor-pointer"
          >
            <IconTemplate size={12} /> {showTemplates ? "Hide Templates" : "Use Template"}
          </button>
        </div>

        {showTemplates && (
          <div className="px-5 py-3 border-b border-border bg-card-elevated">
            <div className="grid grid-cols-2 gap-2">
              {templates.length === 0 ? (
                <p className="text-[12px] text-muted col-span-2">No templates yet. Create templates in Settings.</p>
              ) : (
                templates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="text-left p-3 rounded-lg border border-border hover:border-accent/30 hover:bg-card-hover transition cursor-pointer"
                  >
                    <p className="text-[12px] font-medium text-foreground">{tpl.name}</p>
                    <p className="text-[11px] text-muted mt-0.5 truncate">{tpl.subject}</p>
                    {tpl.category && <span className="badge !text-[9px] !px-1.5 !py-0 badge-muted mt-1">{tpl.category}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your email..."
            className="input-field !text-[13px] min-h-[300px] resize-y leading-relaxed"
            rows={12}
          />
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-[12px] text-danger flex items-center gap-1">
                <IconX size={12} /> {error}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setTo(""); setCc(""); setBcc(""); setSubject(""); setBody(""); setError(""); }}
              className="btn-ghost !text-[12px] cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
              className="btn-primary !text-[12px] cursor-pointer"
            >
              <IconSend size={14} /> {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
