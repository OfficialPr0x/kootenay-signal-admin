import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          amount_total: number | null;
          metadata?: { invoiceId?: string };
          customer_email: string | null;
        };
        const invoiceId = session.metadata?.invoiceId;

        // Auto-mark the corresponding invoice as paid when checkout completes
        if (invoiceId) {
          const paidAtDate = new Date().toISOString();
          const paidAmount = session.amount_total ? session.amount_total / 100 : null;

          await Promise.all([
            supabase
              .from("Invoice")
              .update({ status: "paid", paidAt: paidAtDate, paymentSource: "stripe" })
              .eq("id", invoiceId),
            // Log a Payment record for unified payment history
            paidAmount
              ? supabase.from("Payment").insert({
                  invoiceId,
                  amount: paidAmount,
                  method: "stripe",
                  reference: session.id,
                  paidAt: paidAtDate,
                })
              : Promise.resolve(),
          ]);
        }
        break;
      }

      case "payment_intent.succeeded":
      case "charge.succeeded":
        // Future: log to StripeTransaction table if added
        break;

      default:
        // Unhandled event type — fine, just acknowledge
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Still return 200 so Stripe doesn't retry — log only
  }

  return NextResponse.json({ received: true });
}
