import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(session);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email } = await request.json();

  const updateData: Record<string, string> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;

  const { data: user } = await supabase
    .from("User")
    .update(updateData)
    .eq("id", session.id)
    .select("id, email, name, role")
    .single();

  return NextResponse.json(user);
}
