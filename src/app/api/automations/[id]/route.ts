import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/automations/[id] - Get workflow detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: workflow } = await supabase
    .from("Workflow")
    .select("*, WorkflowNode(*), WorkflowEdge(*), WorkflowRun(*)")
    .eq("id", id)
    .order("posY", { referencedTable: "WorkflowNode", ascending: true })
    .order("createdAt", { referencedTable: "WorkflowRun", ascending: false })
    .single();

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...workflow,
    nodes: workflow.WorkflowNode,
    edges: workflow.WorkflowEdge,
    runs: (workflow.WorkflowRun || []).slice(0, 20),
    WorkflowNode: undefined,
    WorkflowEdge: undefined,
    WorkflowRun: undefined,
  });
}

// PATCH /api/automations/[id] - Update workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, description, status, isActive, trigger } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (isActive !== undefined) data.isActive = isActive;
  if (trigger !== undefined) data.trigger = JSON.stringify(trigger);

  const { data: workflow, error } = await supabase.from("Workflow").update(data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(workflow);
}

// DELETE /api/automations/[id] - Delete workflow
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("Workflow").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
