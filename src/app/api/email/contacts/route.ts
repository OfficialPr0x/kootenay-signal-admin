import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  let query = supabase
    .from("EmailContact")
    .select("*, ContactActivity(*)")
    .order("createdAt", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape: rename ContactActivity -> activities, limit to 10
  const contacts = (data || []).map((c: Record<string, unknown>) => {
    const { ContactActivity, ...rest } = c;
    return { ...rest, activities: (ContactActivity as unknown[] || []).slice(0, 10) };
  });

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name, company, phone, tags, status, source, pipelineStage, owner, notes } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const { data: contact, error } = await supabase
    .from("EmailContact")
    .upsert({
      email, name: name || null, company: company || null, phone: phone || null,
      tags: tags || null, status: status || "subscribed",
      source: source || null, pipelineStage: pipelineStage || null,
      owner: owner || null, notes: notes || null,
    }, { onConflict: "email" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(contact, { status: 201 });
}
