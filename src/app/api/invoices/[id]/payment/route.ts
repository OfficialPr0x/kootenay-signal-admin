import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// POST /api/invoices/[id]/payment — record a manual payment, marks invoice paid
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { amount, method, reference, notes, paidAt } = body;

  if (!amount || isNaN(Number(amount))) {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }

  // Verify invoice exists
  const { data: inv, error: fetchErr } = await supabase
    .from("Invoice")
    .select("id, amount, status")
    .eq("id", id)
    .single();

  if (fetchErr || !inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const paidAtDate = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

  // Insert payment record
  const { data: payment, error: payErr } = await supabase
    .from("Payment")
    .insert({
      invoiceId: id,
      amount: Number(amount),
      method: method || "cash",
      reference: reference || null,
      notes: notes || null,
      paidAt: paidAtDate,
    })
    .select()
    .single();

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  // Mark invoice as paid (manual source)
  const { error: updateErr } = await supabase
    .from("Invoice")
    .update({
      status: "paid",
      paidAt: paidAtDate,
      paymentSource: "manual",
    })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ payment, invoiceStatus: "paid" }, { status: 201 });
}
