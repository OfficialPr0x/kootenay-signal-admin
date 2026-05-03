import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase.from("Lead").select("*").order("createdAt", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,business.ilike.%${search}%`);
  }

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Bulk insert: accept an array
  if (Array.isArray(body)) {
    const inserts = body
      .filter((l) => l.name || l.business)
      .map((l) => ({
        name: l.name || l.business,
        email: l.email || "",
        phone: l.phone || null,
        business: l.business || null,
        message: l.message || l.notes || null,
        source: l.source || "csv_import",
        websiteUrl: l.websiteUrl || null,
        industry: l.industry || null,
        linkedinUrl: l.linkedinUrl || null,
        status: "new",
      }));

    if (inserts.length === 0) {
      return NextResponse.json({ error: "No valid leads in array" }, { status: 400 });
    }

    const { data: saved, error: insertErr } = await supabase
      .from("Lead")
      .insert(inserts)
      .select();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ imported: saved?.length ?? 0, total: inserts.length }, { status: 201 });
  }

  // Single insert
  const { name, email, phone, business, message, source, websiteUrl, industry, linkedinUrl, notes } = body;

  if (!name && !business) {
    return NextResponse.json({ error: "Name or business is required" }, { status: 400 });
  }

  const { data: lead, error } = await supabase
    .from("Lead")
    .insert({
      name: name || business,
      email: email || null,
      phone: phone || null,
      business: business || null,
      message: message || notes || null,
      source: source || "admin",
      websiteUrl: websiteUrl || null,
      industry: industry || null,
      linkedinUrl: linkedinUrl || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(lead, { status: 201 });
}
