/**
 * GET /api/agent/run/[id]  — Get a specific run with full details
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: run } = await supabase
    .from("AgentRun")
    .select("*, AgentToolCall(*), AgentApproval(*), AgentSession!inner(userId)")
    .eq("id", id)
    .single();

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const agentSession = run.AgentSession as Record<string, unknown>;
  if (agentSession.userId !== session.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { AgentToolCall, AgentApproval, AgentSession: _s, ...rest } = run;
  return NextResponse.json({ run: { ...rest, toolCalls: AgentToolCall || [], approvals: AgentApproval || [], session: agentSession } });
}
