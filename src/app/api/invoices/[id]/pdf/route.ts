import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/invoice-pdf";
import React from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: inv, error } = await supabase
    .from("Invoice")
    .select("*, Client(name, business, email, phone, website)")
    .eq("id", id)
    .single();

  if (error || !inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = {
    ...inv,
    client: inv.Client,
  };

  const buffer = await renderToBuffer(
    React.createElement(InvoicePDF, { invoice }) as React.ReactElement<DocumentProps>
  );

  const shortId = id.slice(-8).toUpperCase();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="KS-Invoice-${shortId}.pdf"`,
    },
  });
}
