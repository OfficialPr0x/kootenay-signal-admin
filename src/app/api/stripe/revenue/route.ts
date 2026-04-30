import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function GET() {
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, message: "Stripe not configured" });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    // Run all Stripe fetches in parallel
    const [chargesLast30, chargesLast90, subscriptions, balanceRes] = await Promise.all([
      stripe.charges.list({ created: { gte: thirtyDaysAgo }, limit: 100 }),
      stripe.charges.list({ created: { gte: ninetyDaysAgo }, limit: 100 }),
      stripe.subscriptions.list({ status: "active", limit: 100 }),
      stripe.balance.retrieve(),
    ]);

    // Revenue last 30 days (succeeded charges only)
    const revenue30d = chargesLast30.data
      .filter((c) => c.status === "succeeded")
      .reduce((s, c) => s + c.amount, 0) / 100;

    // Revenue last 90 days
    const revenue90d = chargesLast90.data
      .filter((c) => c.status === "succeeded")
      .reduce((s, c) => s + c.amount, 0) / 100;

    // MRR from active subscriptions
    const mrr = subscriptions.data.reduce((s, sub) => {
      const item = sub.items.data[0];
      if (!item?.price) return s;
      const amount = item.price.unit_amount || 0;
      const interval = item.price.recurring?.interval;
      const monthly = interval === "year" ? amount / 12 : amount;
      return s + monthly;
    }, 0) / 100;

    // Available balance
    const available = (balanceRes.available[0]?.amount || 0) / 100;
    const currency = balanceRes.available[0]?.currency?.toUpperCase() || "USD";

    // Recent transactions (last 20)
    const recentCharges = chargesLast30.data.slice(0, 20).map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency.toUpperCase(),
      status: c.status,
      description: c.description,
      customerEmail: c.billing_details?.email || null,
      customerName: c.billing_details?.name || null,
      createdAt: new Date(c.created * 1000).toISOString(),
      receiptUrl: c.receipt_url,
    }));

    return NextResponse.json({
      configured: true,
      revenue30d,
      revenue90d,
      mrr,
      available,
      currency,
      subscriptionCount: subscriptions.data.length,
      recentCharges,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ configured: false, message }, { status: 500 });
  }
}
