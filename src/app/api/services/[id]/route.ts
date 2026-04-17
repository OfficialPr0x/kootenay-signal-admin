import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (body.features) {
    body.features = JSON.stringify(body.features);
  }

  const { data: service, error } = await supabase.from("Service").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(service);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("Service").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
