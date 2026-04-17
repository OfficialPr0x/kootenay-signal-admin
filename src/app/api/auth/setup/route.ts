import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Only allow setup if no users exist
  const { count } = await supabase.from("User").select("*", { count: "exact", head: true });
  if ((count || 0) > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  const { data: user, error } = await supabase
    .from("User")
    .insert({ email, password: hashed, name, role: "admin" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
