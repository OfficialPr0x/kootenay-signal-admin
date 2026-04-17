/**
 * POST /api/agent/approve — Approve or reject a pending agent action
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { executeRun } from "@/lib/agent/orchestrator";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { approvalId, action } = body as { approvalId: string; action: "approve" | "reject" };

  if (!approvalId || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "approvalId and action (approve/reject) are required" }, { status: 400 });
  }

  const { data: approval } = await supabase
    .from("AgentApproval")
    .select("*, AgentRun(*, AgentSession(*))")
    .eq("id", approvalId)
    .single();

  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  const run = approval.AgentRun as Record<string, unknown>;
  const agentSession = run.AgentSession as Record<string, unknown>;
  if (agentSession.userId !== session.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (approval.status !== "pending") {
    return NextResponse.json({ error: `Approval already ${approval.status}` }, { status: 400 });
  }

  // Update approval
  await supabase.from("AgentApproval").update({
    status: action === "approve" ? "approved" : "rejected",
    approvedBy: session.id,
    approvedAt: new Date().toISOString(),
  }).eq("id", approvalId);

  if (action === "reject") {
    await supabase.from("AgentRun").update({
      status: "cancelled",
      completedAt: new Date().toISOString(),
    }).eq("id", approval.runId);

    return NextResponse.json({
      status: "rejected",
      message: "Action was rejected and cancelled.",
    });
  }

  // Approved — execute the run
  try {
    await executeRun(approval.runId);
  } catch {
    // Error stored in run record
  }

  const { data: completedRun } = await supabase
    .from("AgentRun")
    .select("*, AgentToolCall(*), AgentApproval(*)")
    .eq("id", approval.runId)
    .single();

  const shaped = completedRun ? (() => {
    const { AgentToolCall, AgentApproval: approvals, ...rest } = completedRun;
    return { ...rest, toolCalls: AgentToolCall || [], approvals: approvals || [] };
  })() : null;

  return NextResponse.json({
    status: "approved",
    run: shaped,
    message: "Action approved and executed.",
  });
}
