"use client";

import { useState, useEffect } from "react";

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  resendId: string | null;
  createdAt: string;
}

export default function EmailPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    const res = await fetch("/api/email");
    const data = await res.json();
    setLogs(data);
    setLoading(false);
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const to = (formData.get("to") as string).split(",").map((s) => s.trim()).filter(Boolean);
    const subject = formData.get("subject") as string;
    const html = formData.get("html") as string;

    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });

    const data = await res.json();

    if (res.ok) {
      setResult({ type: "success", message: `Email sent successfully! ID: ${data.id}` });
      setShowComposer(false);
      fetchLogs();
    } else {
      setResult({ type: "error", message: data.error || "Failed to send email" });
    }

    setSending(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Email</h2>
          <p className="text-muted text-sm mt-1">Send emails and view history</p>
        </div>
        <button
          onClick={() => { setShowComposer(true); setResult(null); }}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition cursor-pointer"
        >
          + Compose Email
        </button>
      </div>

      {result && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm border ${
          result.type === "success"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {result.message}
        </div>
      )}

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Compose Email</h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">To * (comma-separated for multiple)</label>
                <input name="to" required placeholder="client@example.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Subject *</label>
                <input name="subject" required placeholder="Monthly Report - Kootenay Signal"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">HTML Body *</label>
                <textarea name="html" required rows={10}
                  placeholder="<h1>Hello!</h1><p>Your monthly report is ready...</p>"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent resize-y" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={sending}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer">
                  {sending ? "Sending..." : "Send Email"}
                </button>
                <button type="button" onClick={() => setShowComposer(false)}
                  className="px-4 py-2 border border-border text-muted hover:text-foreground rounded-lg text-sm transition cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Log */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold">Email History</h3>
        </div>
        {loading ? (
          <p className="p-8 text-center text-muted">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-center text-muted">No emails sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="px-6 py-4 font-medium">To</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Resend ID</th>
                  <th className="px-6 py-4 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-card-hover transition">
                    <td className="px-6 py-4">{log.to}</td>
                    <td className="px-6 py-4 text-muted">{log.subject}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        log.status === "sent"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted text-xs font-mono">{log.resendId || "—"}</td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
