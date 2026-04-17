import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: contact, error } = await supabase
    .from("EmailContact")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  return NextResponse.json(contact);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { data: contact, error } = await supabase
    .from("EmailContact")
    .update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.pipelineStage !== undefined && { pipelineStage: body.pipelineStage }),
      ...(body.leadScore !== undefined && { leadScore: body.leadScore }),
      ...(body.owner !== undefined && { owner: body.owner }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.nextAction !== undefined && { nextAction: body.nextAction }),
      ...(body.nextActionAt !== undefined && { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt).toISOString() : null }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(contact);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("EmailContact").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
