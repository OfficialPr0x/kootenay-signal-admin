import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { amount, description, clientEmail, clientName, invoiceId, stripePriceId } = await request.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Build line_items: use existing Stripe Price if available, otherwise ad-hoc price_data
    const lineItems = stripePriceId
      ? [{ price: stripePriceId as string, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "cad",
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: description || "Kootenay Signal — Services",
                description: "One-time setup. No ongoing management included.",
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      customer_email: clientEmail || undefined,
      metadata: {
        invoiceId: invoiceId || "",
        clientName: clientName || "",
      },
      success_url: `${appUrl}/dashboard/invoices?payment=success`,
      cancel_url: `${appUrl}/dashboard/invoices?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
