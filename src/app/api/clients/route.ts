import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase.from("Client").select("*, Invoice(*)").order("createdAt", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,business.ilike.%${search}%`);
  }

  const { data: clients, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, phone, business, website, plan, monthlyRate, notes } = body;

  if (!name || !email || !business) {
    return NextResponse.json({ error: "Name, email, and business are required" }, { status: 400 });
  }

  const { data: client, error } = await supabase
    .from("Client")
    .insert({ name, email, phone, business, website, plan, monthlyRate: monthlyRate || 0, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(client, { status: 201 });
}
