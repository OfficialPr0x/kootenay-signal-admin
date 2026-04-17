import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/warmup/mailboxes/[id] - Get mailbox detail with warmup history
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: mailbox, error } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*), WarmupJob(*, WarmupProfile(*), WarmupMessage(*))")
    .eq("id", id)
    .single();

  if (error || !mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  // Reshape
  const { MailboxHealthSnapshot, WarmupJob, ...rest } = mailbox;
  const shaped = {
    ...rest,
    healthSnapshots: (MailboxHealthSnapshot as unknown[] || []).slice(0, 30),
    warmupJobs: (WarmupJob as Array<Record<string, unknown>> || []).map((j: Record<string, unknown>) => {
      const { WarmupProfile, WarmupMessage, ...jRest } = j;
      return {
        ...jRest,
        profile: WarmupProfile || null,
        messages: (WarmupMessage as unknown[] || []).slice(0, 100),
      };
    }),
  };

  return NextResponse.json({ mailbox: shaped });
}
