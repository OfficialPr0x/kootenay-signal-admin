import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/payments — recent payments with invoice + client data
export async function GET() {
  const { data, error } = await supabase
    .from("Payment")
    .select("*, Invoice(id, amount, description, paymentSource, Client(name, business))")
    .order("paidAt", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
