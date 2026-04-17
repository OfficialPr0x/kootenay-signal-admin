import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/email/accounts - List all email accounts
export async function GET() {
  const { data: accounts, error } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*)")
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape: rename and limit healthSnapshots to latest 1
  const shaped = (accounts || []).map((a: Record<string, unknown>) => {
    const { MailboxHealthSnapshot, ...rest } = a;
    return { ...rest, healthSnapshots: (MailboxHealthSnapshot as unknown[] || []).slice(0, 1) };
  });

  return NextResponse.json({ accounts: shaped });
}

// POST /api/email/accounts - Create a new email account
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name, domainId, dailySendLimit, isDefault } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "email and name are required" }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("EmailAccount")
    .select("id")
    .eq("email", email)
    .single();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // If setting as default, unset others
  if (isDefault) {
    await supabase
      .from("EmailAccount")
      .update({ isDefault: false })
      .eq("isDefault", true);
  }

  const { data: account, error } = await supabase
    .from("EmailAccount")
    .insert({
      email,
      name,
      domainId: domainId || null,
      dailySendLimit: dailySendLimit || 50,
      isDefault: isDefault || false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(account, { status: 201 });
}
