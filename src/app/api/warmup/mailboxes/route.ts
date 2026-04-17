import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/warmup/mailboxes - List mailboxes with warmup data
export async function GET() {
  const { data: mailboxes, error } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*), WarmupJob(*, WarmupProfile(name, maxVolume, startVolume, rampIncrement), WarmupMessage(*))")
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape
  const shaped = (mailboxes || []).map((mb: Record<string, unknown>) => {
    const { MailboxHealthSnapshot, WarmupJob, ...rest } = mb;
    return {
      ...rest,
      healthSnapshots: (MailboxHealthSnapshot as unknown[] || []).slice(0, 1),
      warmupJobs: (WarmupJob as Array<Record<string, unknown>> || []).slice(0, 1).map((j: Record<string, unknown>) => {
        const { WarmupProfile, WarmupMessage, ...jRest } = j;
        return {
          ...jRest,
          profile: WarmupProfile || null,
          messages: (WarmupMessage as unknown[] || []).slice(0, 50),
        };
      }),
    };
  });

  return NextResponse.json({ mailboxes: shaped });
}

// POST /api/warmup/mailboxes - Assign a warmup profile to a mailbox (create job)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mailboxId, profileId } = body;

  if (!mailboxId || !profileId) {
    return NextResponse.json({ error: "mailboxId and profileId required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("WarmupProfile")
    .select("startVolume")
    .eq("id", profileId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: job, error } = await supabase
    .from("WarmupJob")
    .insert({
      mailboxId,
      profileId,
      status: "active",
      currentVolume: profile.startVolume,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("EmailAccount")
    .update({ warmupStatus: "warming" })
    .eq("id", mailboxId);

  return NextResponse.json(job, { status: 201 });
}

// PATCH /api/warmup/mailboxes - Update mailbox warmup status
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { mailboxId, warmupStatus } = body;

  if (!mailboxId || !warmupStatus) {
    return NextResponse.json({ error: "mailboxId and warmupStatus required" }, { status: 400 });
  }

  const validStatuses = ["none", "warming", "stable", "at_risk", "paused"];
  if (!validStatuses.includes(warmupStatus)) {
    return NextResponse.json({ error: "Invalid warmup status" }, { status: 400 });
  }

  const { data: mailbox, error } = await supabase
    .from("EmailAccount")
    .update({ warmupStatus })
    .eq("id", mailboxId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(mailbox);
}
