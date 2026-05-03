import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";
import Stripe from "stripe";

async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    const json = await res.json();
    return json?.rates?.[to.toUpperCase()] ?? 1;
  } catch {
    return 1;
  }
}

export async function GET(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, message: "Stripe not configured" });
  }

  const { searchParams } = new URL(request.url);
  const requestedCurrency = (searchParams.get("currency") || "").toUpperCase();

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    // Expand balance_transaction so we get Stripe-converted amounts in account currency
    const [chargesLast30, chargesLast90, subscriptions, balanceRes] = await Promise.all([
      stripe.charges.list({ created: { gte: thirtyDaysAgo }, limit: 100, expand: ["data.balance_transaction"] }),
      stripe.charges.list({ created: { gte: ninetyDaysAgo }, limit: 100, expand: ["data.balance_transaction"] }),
      stripe.subscriptions.list({ status: "active", limit: 100 }),
      stripe.balance.retrieve(),
    ]);

    // Account's native currency from Stripe balance
    const accountCurrency = balanceRes.available[0]?.currency?.toUpperCase() || "USD";
    const displayCurrency = requestedCurrency || accountCurrency;

    // Get exchange rate from account currency → requested display currency (server-side, no CORS)
    const rate = await getExchangeRate(accountCurrency, displayCurrency);

    // Use balance_transaction.amount which is already in account currency (Stripe handles conversion)
    function btAmount(charge: Stripe.Charge): number {
      const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
      // balance_transaction.amount is in account currency (smallest unit)
      if (bt && typeof bt === "object" && "amount" in bt) return bt.amount;
      // fallback: raw charge amount (may be in a different currency)
      return charge.amount;
    }

    const revenue30d =
      (chargesLast30.data
        .filter((c) => c.status === "succeeded")
        .reduce((s, c) => s + btAmount(c), 0) /
        100) *
      rate;

    const revenue90d =
      (chargesLast90.data
        .filter((c) => c.status === "succeeded")
        .reduce((s, c) => s + btAmount(c), 0) /
        100) *
      rate;

    // MRR from active subscriptions (prices are in account currency)
    const mrr =
      (subscriptions.data.reduce((s, sub) => {
        const item = sub.items.data[0];
        if (!item?.price) return s;
        const amount = item.price.unit_amount || 0;
        const interval = item.price.recurring?.interval;
        const monthly = interval === "year" ? amount / 12 : amount;
        return s + monthly;
      }, 0) /
        100) *
      rate;

    // Available Stripe balance — convert all available currencies
    const available =
      balanceRes.available.reduce((sum, b) => {
        // Each balance entry might be in a different currency, convert each
        return sum + b.amount / 100;
      }, 0) * rate;

    // Recent transactions — include per-charge native amount + account-converted amount
    const recentCharges = chargesLast30.data.slice(0, 20).map((c) => {
      const bt = c.balance_transaction as Stripe.BalanceTransaction | null;
      const accountAmount = bt && typeof bt === "object" && "amount" in bt
        ? (bt.amount / 100) * rate
        : (c.amount / 100) * rate;
      return {
        id: c.id,
        amount: accountAmount,
        nativeAmount: c.amount / 100,
        nativeCurrency: c.currency.toUpperCase(),
        currency: displayCurrency,
        status: c.status,
        description: c.description,
        customerEmail: c.billing_details?.email || null,
        customerName: c.billing_details?.name || null,
        createdAt: new Date(c.created * 1000).toISOString(),
        receiptUrl: c.receipt_url,
      };
    });

    return NextResponse.json({
      configured: true,
      revenue30d,
      revenue90d,
      mrr,
      available,
      accountCurrency,
      currency: displayCurrency,
      exchangeRate: rate,
      subscriptionCount: subscriptions.data.length,
      recentCharges,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ configured: false, message }, { status: 500 });
  }
}
