"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──

type ToolCall = {
  id: string;
  toolName: string;
  toolInputJson: string;
  toolOutputJson: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type Approval = {
  id: string;
  actionType: string;
  summary: string;
  status: string;
};

type AgentRun = {
  id: string;
  commandText: string;
  intentType: string;
  status: string;
  resultSummary: string | null;
  errorJson: string | null;
  planJson: string | null;
  requiresApproval: boolean;
  toolCalls: ToolCall[];
  approvals: Approval[];
  createdAt: string;
  completedAt: string | null;
};

type RunState = "idle" | "loading" | "needs_approval" | "running" | "completed" | "failed" | "error";

// ── Example commands ──

const EXAMPLES = [
  "Show dashboard stats",
  "Find contacts named Johnson",
  "List prospect list",
  "Check inbox",
  "List mailboxes",
  "Unpaid invoices",
  "Find client Jaryd",
  "Create invoice for ClientName",
  "Domain health kootenaysignal.com",
];

// ── Component ──

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<AgentRun[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcut ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape" && open) {
        if (state === "idle" || state === "completed" || state === "failed" || state === "error") {
          setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, state]);

  // ── Focus input when modal opens ──
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Submit command ──
  const submitCommand = useCallback(async () => {
    if (!command.trim()) return;

    setState("loading");
    setRun(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: command.trim(), sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }

      if (data.sessionId) setSessionId(data.sessionId);

      if (data.status === "needs_approval") {
        setState("needs_approval");
        setRun(data.run);
      } else if (data.run?.status === "completed") {
        setState("completed");
        setRun(data.run);
        setHistory(prev => [data.run, ...prev].slice(0, 20));
      } else if (data.run?.status === "failed") {
        setState("failed");
        setRun(data.run);
      } else {
        setState("completed");
        setRun(data.run);
      }
    } catch {
      setState("error");
      setErrorMsg("Network error — couldn't reach the server.");
    }
  }, [command, sessionId]);

  // ── Handle approval ──
  const handleApproval = useCallback(async (approvalId: string, action: "approve" | "reject") => {
    setState("loading");
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, action }),
      });
      const data = await res.json();

      if (action === "reject") {
        setState("idle");
        setRun(null);
        setCommand("");
        return;
      }

      if (data.run) {
        setRun(data.run);
        setState(data.run.status === "completed" ? "completed" : "failed");
        setHistory(prev => [data.run, ...prev].slice(0, 20));
      } else {
        setState("completed");
      }
    } catch {
      setState("error");
      setErrorMsg("Failed to process approval.");
    }
  }, []);

  // ── Reset ──
  const reset = useCallback(() => {
    setState("idle");
    setRun(null);
    setCommand("");
    setErrorMsg("");
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
        if (state === "idle" || state === "completed" || state === "failed" || state === "error") setOpen(false);
      }} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[var(--card)] border border-[var(--border-bright)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-[var(--accent-dim)]">
            <CommandIcon />
          </div>
          <span className="text-sm text-[var(--muted-foreground)]">AI Command Center</span>
          <span className="ml-auto text-xs text-[var(--muted)] bg-[var(--card-hover)] px-2 py-0.5 rounded">
            {navigator?.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}
          </span>
        </div>

        {/* Input */}
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && state === "idle") {
                e.preventDefault();
                submitCommand();
              }
            }}
            placeholder="What would you like to do?"
            disabled={state !== "idle" && state !== "completed" && state !== "failed" && state !== "error"}
            className="w-full bg-transparent text-[var(--foreground)] text-base placeholder:text-[var(--muted)] outline-none disabled:opacity-50"
          />
        </div>

        {/* State-specific content */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Idle — show examples */}
          {state === "idle" && !command && (
            <div className="px-4 pb-4">
              <p className="text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">Try saying</p>
              <div className="grid gap-1">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setCommand(ex); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="text-left px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {state === "loading" && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 py-4">
                <Spinner />
                <span className="text-sm text-[var(--muted-foreground)]">Processing your command...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="px-4 pb-4">
              <div className="bg-[var(--danger-dim)] border border-[var(--danger)]/20 rounded-lg p-4">
                <p className="text-sm text-[var(--danger)] whitespace-pre-wrap">{errorMsg}</p>
              </div>
              <button onClick={reset} className="mt-3 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
                Try again
              </button>
            </div>
          )}

          {/* Needs approval */}
          {state === "needs_approval" && run && (
            <div className="px-4 pb-4">
              <ApprovalCard run={run} onApprove={handleApproval} />
            </div>
          )}

          {/* Completed */}
          {state === "completed" && run && (
            <div className="px-4 pb-4">
              <ResultPanel run={run} />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={reset}
                  className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  New command
                </button>
              </div>
            </div>
          )}

          {/* Failed */}
          {state === "failed" && run && (
            <div className="px-4 pb-4">
              <div className="bg-[var(--danger-dim)] border border-[var(--danger)]/20 rounded-lg p-4">
                <p className="text-sm font-medium text-[var(--danger)] mb-1">Execution failed</p>
                <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
                  {run.resultSummary || (run.errorJson ? JSON.parse(run.errorJson).error : "Unknown error")}
                </p>
              </div>
              <ExecutionTimeline toolCalls={run.toolCalls} />
              <button onClick={reset} className="mt-3 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <span>
            {state === "idle" ? "Enter to run" : state === "needs_approval" ? "Waiting for approval" : state === "loading" ? "Running..." : ""}
          </span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}

// ── Approval Card ──

function ApprovalCard({ run, onApprove }: { run: AgentRun; onApprove: (id: string, action: "approve" | "reject") => void }) {
  const approval = run.approvals.find(a => a.status === "pending");
  if (!approval) return null;

  return (
    <div className="bg-[var(--warning-dim)] border border-[var(--warning)]/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--warning)]/20 shrink-0 mt-0.5">
          <ShieldIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">Approval Required</p>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">{approval.summary}</p>

          {/* Show plan steps */}
          {run.planJson && (
            <div className="mb-3">
              <PlanPreview planJson={run.planJson} />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onApprove(approval.id, "approve")}
              className="px-4 py-1.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              Approve & Run
            </button>
            <button
              onClick={() => onApprove(approval.id, "reject")}
              className="px-4 py-1.5 bg-[var(--card-hover)] text-[var(--muted-foreground)] text-sm rounded-lg hover:text-[var(--foreground)] transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan Preview ──

function PlanPreview({ planJson }: { planJson: string }) {
  try {
    const plan = JSON.parse(planJson);
    return (
      <div className="space-y-1">
        {plan.steps?.map((step: { toolName: string; description: string }, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span className="w-4 h-4 flex items-center justify-center bg-[var(--card)] rounded text-[10px] text-[var(--muted)]">{i + 1}</span>
            <span className="font-mono text-[var(--accent)]">{step.toolName}</span>
            <span className="text-[var(--muted)]">—</span>
            <span>{step.description}</span>
          </div>
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

// ── Result Panel ──

function ResultPanel({ run }: { run: AgentRun }) {
  return (
    <div>
      {/* Success header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-[var(--success)]/20 flex items-center justify-center">
          <CheckIcon />
        </div>
        <span className="text-sm font-medium text-[var(--success)]">Completed</span>
        {run.completedAt && run.createdAt && (
          <span className="text-xs text-[var(--muted)] ml-auto">
            {Math.round((new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)}s
          </span>
        )}
      </div>

      {/* Result summary */}
      {run.resultSummary && (
        <div className="bg-[var(--card-hover)] rounded-lg p-4 mb-3">
          <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans leading-relaxed">
            {run.resultSummary}
          </pre>
        </div>
      )}

      {/* Execution timeline */}
      <ExecutionTimeline toolCalls={run.toolCalls} />
    </div>
  );
}

// ── Execution Timeline ──

function ExecutionTimeline({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (toolCalls.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(expanded ? null : toolCalls[0]?.id)}
        className="text-xs text-[var(--muted)] hover:text-[var(--muted-foreground)] mb-2"
      >
        {expanded ? "Hide" : "Show"} execution details ({toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""})
      </button>

      {expanded && (
        <div className="space-y-2">
          {toolCalls.map(tc => (
            <div key={tc.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === tc.id ? null : tc.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--card-hover)] transition-colors"
              >
                <StatusDot status={tc.status} />
                <span className="text-xs font-mono text-[var(--accent)]">{tc.toolName}</span>
                {tc.startedAt && tc.finishedAt && (
                  <span className="ml-auto text-xs text-[var(--muted)]">
                    {Math.round((new Date(tc.finishedAt).getTime() - new Date(tc.startedAt).getTime()))}ms
                  </span>
                )}
              </button>
              {expanded === tc.id && (
                <div className="border-t border-[var(--border)] px-3 py-2">
                  <div className="mb-2">
                    <span className="text-xs text-[var(--muted)] uppercase">Input</span>
                    <pre className="text-xs text-[var(--muted-foreground)] mt-1 overflow-x-auto">
                      {formatJson(tc.toolInputJson)}
                    </pre>
                  </div>
                  {tc.toolOutputJson && (
                    <div>
                      <span className="text-xs text-[var(--muted)] uppercase">Output</span>
                      <pre className="text-xs text-[var(--muted-foreground)] mt-1 overflow-x-auto max-h-40 overflow-y-auto">
                        {formatJson(tc.toolOutputJson)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Micro-components ──

function StatusDot({ status }: { status: string }) {
  const color = status === "completed" ? "var(--success)" : status === "failed" ? "var(--danger)" : status === "running" ? "var(--accent)" : "var(--muted)";
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6v12a3 3 0 103-3H6a3 3 0 103 3V6a3 3 0 10-3 3h12a3 3 0 10-3-3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function formatJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
