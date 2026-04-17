import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

type Params = { id: string };

// GET /api/warmup/[id] - Get a single warmup profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  const { data: profile, error } = await supabase
    .from("WarmupProfile")
    .select("*, WarmupJob(id, status, mailboxId, currentVolume, totalSent)")
    .eq("id", id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Reshape
  const { WarmupJob, ...rest } = profile;
  return NextResponse.json({ ...rest, jobs: WarmupJob || [] });
}

// PATCH /api/warmup/[id] - Update a warmup profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, startVolume, maxVolume, rampIncrement, isActive, seedAddresses, contentVariants } = body;

  const { data: existing } = await supabase
    .from("WarmupProfile")
    .select("id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: profile, error } = await supabase
    .from("WarmupProfile")
    .update({
      ...(name !== undefined && { name }),
      ...(startVolume !== undefined && { startVolume }),
      ...(maxVolume !== undefined && { maxVolume }),
      ...(rampIncrement !== undefined && { rampIncrement }),
      ...(isActive !== undefined && { isActive }),
      ...(seedAddresses !== undefined && { seedAddresses }),
      ...(contentVariants !== undefined && { contentVariants }),
    })
    .eq("id", id)
    .select("*, WarmupJob(id, status)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape
  const { WarmupJob, ...rest } = profile as Record<string, unknown>;
  return NextResponse.json({ ...rest, jobs: WarmupJob || [] });
}

// DELETE /api/warmup/[id] - Delete a warmup profile
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  // Check for active jobs
  const { data: activeJobs } = await supabase
    .from("WarmupJob")
    .select("id")
    .eq("profileId", id)
    .eq("status", "active");

  if (!activeJobs) {
    // Profile may not exist — check
    const { data: exists } = await supabase.from("WarmupProfile").select("id").eq("id", id).single();
    if (!exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${activeJobs.length} active warmup job(s) are using this profile. Pause or remove them first.` },
      { status: 400 }
    );
  }

  await supabase.from("WarmupProfile").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
