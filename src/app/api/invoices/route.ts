import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  let query = supabase.from("Invoice").select("*, Client(name, business, email)").order("createdAt", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (clientId) query = query.eq("clientId", clientId);

  const { data: invoices, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape to match expected format (client as nested object)
  const shaped = (invoices || []).map((inv) => ({
    ...inv,
    client: inv.Client,
    Client: undefined,
  }));

  return NextResponse.json(shaped);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clientId, amount, dueDate } = body;

  if (!clientId || !amount || !dueDate) {
    return NextResponse.json({ error: "Client, amount, and due date are required" }, { status: 400 });
  }

  const { data: invoice, error } = await supabase
    .from("Invoice")
    .insert({ clientId, amount, dueDate: new Date(dueDate).toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(invoice, { status: 201 });
}
