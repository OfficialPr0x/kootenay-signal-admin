import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/email/accounts/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: account, error } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*), WarmupJob(*, WarmupProfile(*))")
    .eq("id", id)
    .single();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Reshape
  const { MailboxHealthSnapshot, WarmupJob, ...rest } = account;
  const shaped = {
    ...rest,
    healthSnapshots: (MailboxHealthSnapshot as unknown[] || []).slice(0, 10),
    warmupJobs: (WarmupJob as Array<Record<string, unknown>> || []).slice(0, 1).map((j: Record<string, unknown>) => {
      const { WarmupProfile, ...jRest } = j;
      return { ...jRest, profile: WarmupProfile || null };
    }),
  };

  return NextResponse.json(shaped);
}

// PATCH /api/email/accounts/[id] - Update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, dailySendLimit, isDefault } = body;

  // If setting as default, unset others
  if (isDefault) {
    await supabase
      .from("EmailAccount")
      .update({ isDefault: false })
      .eq("isDefault", true)
      .neq("id", id);
  }

  const { data: account, error } = await supabase
    .from("EmailAccount")
    .update({
      ...(name !== undefined && { name }),
      ...(dailySendLimit !== undefined && { dailySendLimit }),
      ...(isDefault !== undefined && { isDefault }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(account);
}

// DELETE /api/email/accounts/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await supabase.from("EmailAccount").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
