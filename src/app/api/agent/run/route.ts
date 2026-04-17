/**
 * POST /api/agent/run  — Start a new agent run
 * GET  /api/agent/run  — List recent runs for current session
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { planCommand, executeRun } from "@/lib/agent/orchestrator";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { command, sessionId } = body as { command: string; sessionId?: string };

  if (!command || typeof command !== "string" || command.trim().length === 0) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  // Get or create agent session
  let agentSession: Record<string, unknown> | null = null;
  if (sessionId) {
    const { data } = await supabase.from("AgentSession").select("*").eq("id", sessionId).single();
    agentSession = data;
  }
  if (!agentSession) {
    const { data } = await supabase.from("AgentSession").insert({ userId: session.id, status: "active" }).select().single();
    agentSession = data;
  } else {
    await supabase.from("AgentSession").update({ lastActiveAt: new Date().toISOString() }).eq("id", agentSession.id);
  }

  // Plan the command
  const plan = planCommand(command.trim());

  if (plan.intentType === "unknown" || plan.steps.length === 0) {
    return NextResponse.json({
      error: "I couldn't understand that command. Try something like:\n• \"Show dashboard stats\"\n• \"Find contacts named John\"\n• \"List mailboxes\"\n• \"Create invoice for ClientName\"\n• \"Check inbox\"\n• \"Unpaid invoices\"",
    }, { status: 422 });
  }

  // Create the run
  const { data: run, error: runErr } = await supabase.from("AgentRun").insert({
    sessionId: agentSession!.id,
    commandText: command.trim(),
    intentType: plan.intentType,
    planJson: JSON.stringify(plan),
    status: plan.requiresApproval ? "needs_approval" : "planning",
    requiresApproval: plan.requiresApproval,
  }).select().single();
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });

  // If requires approval, create approval record
  if (plan.requiresApproval) {
    await supabase.from("AgentApproval").insert({
      runId: run.id,
      actionType: plan.intentType,
      summary: plan.approvalSummary || `Execute ${plan.steps.map(s => s.toolName).join(", ")}`,
      approvalPayloadJson: JSON.stringify(plan.steps),
      status: "pending",
    });

    const { data: updatedRun } = await supabase
      .from("AgentRun")
      .select("*, AgentToolCall(*), AgentApproval(*)")
      .eq("id", run.id)
      .single();

    // Reshape
    const shaped = updatedRun ? (() => {
      const { AgentToolCall, AgentApproval, ...rest } = updatedRun;
      return { ...rest, toolCalls: AgentToolCall || [], approvals: AgentApproval || [] };
    })() : run;

    return NextResponse.json({
      run: shaped,
      sessionId: agentSession!.id,
      status: "needs_approval",
      message: "This action requires your approval before proceeding.",
    });
  }

  // Execute immediately for safe actions
  try {
    await executeRun(run.id);
  } catch {
    // Error is stored in the run record
  }

  const { data: completedRun } = await supabase
    .from("AgentRun")
    .select("*, AgentToolCall(*), AgentApproval(*)")
    .eq("id", run.id)
    .single();

  // Reshape
  const shaped = completedRun ? (() => {
    const { AgentToolCall, AgentApproval, ...rest } = completedRun;
    return { ...rest, toolCalls: AgentToolCall || [], approvals: AgentApproval || [] };
  })() : null;

  return NextResponse.json({
    run: shaped,
    sessionId: agentSession!.id,
    status: shaped?.status || "completed",
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  let query = supabase
    .from("AgentRun")
    .select("*, AgentToolCall(*), AgentApproval(*), AgentSession!inner(userId)")
    .order("createdAt", { ascending: false })
    .limit(20);

  if (sessionId) {
    query = query.eq("sessionId", sessionId);
  } else {
    query = query.eq("AgentSession.userId", session.id);
  }

  const { data } = await query;

  // Reshape
  const runs = (data || []).map((r: Record<string, unknown>) => {
    const { AgentToolCall, AgentApproval, AgentSession, ...rest } = r;
    return { ...rest, toolCalls: AgentToolCall || [], approvals: AgentApproval || [], session: AgentSession };
  });

  return NextResponse.json({ runs });
}
