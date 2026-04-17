import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/automations - List workflows
export async function GET() {
  const { data: workflows } = await supabase
    .from("Workflow")
    .select("*, WorkflowNode(*), WorkflowEdge(*), WorkflowRun(id)")
    .order("createdAt", { ascending: false })
    .order("posY", { referencedTable: "WorkflowNode", ascending: true });

  // Add _count.runs to match expected shape
  const shaped = (workflows || []).map((w) => ({
    ...w,
    nodes: w.WorkflowNode,
    edges: w.WorkflowEdge,
    _count: { runs: w.WorkflowRun?.length || 0 },
    WorkflowNode: undefined,
    WorkflowEdge: undefined,
    WorkflowRun: undefined,
  }));

  return NextResponse.json({ workflows: shaped });
}

// POST /api/automations - Create workflow
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, trigger, nodes } = body;

  if (!name || !trigger) {
    return NextResponse.json({ error: "name and trigger are required" }, { status: 400 });
  }

  const { data: workflow, error } = await supabase
    .from("Workflow")
    .insert({ name, description, trigger: JSON.stringify(trigger) })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create nodes separately
  if (nodes?.length && workflow) {
    const nodeRows = nodes.map((n: { type: string; label: string; config: unknown }, i: number) => ({
      workflowId: workflow.id,
      type: n.type,
      label: n.label,
      config: JSON.stringify(n.config || {}),
      posY: i * 100,
    }));
    await supabase.from("WorkflowNode").insert(nodeRows);
  }

  // Re-fetch with relations
  const { data: full } = await supabase
    .from("Workflow")
    .select("*, WorkflowNode(*), WorkflowEdge(*)")
    .eq("id", workflow!.id)
    .single();

  return NextResponse.json(
    { ...full, nodes: full?.WorkflowNode, edges: full?.WorkflowEdge },
    { status: 201 }
  );
}
