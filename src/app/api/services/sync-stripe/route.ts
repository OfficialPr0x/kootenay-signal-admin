import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";

// POST /api/services/sync-stripe
// For every active service that doesn't yet have a Stripe product+price,
// creates them on Stripe and saves the IDs back to the DB.
export async function POST() {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured — add STRIPE_SECRET_KEY to .env" }, { status: 400 });
  }

  try {
    const { data: services, error } = await supabase
      .from("Service")
      .select("id, name, description, price, isActive, isOneOff, stripeProductId, stripePriceId")
      .eq("isActive", true);

    if (error) {
      return NextResponse.json(
        { error: `DB error: ${error.message}. Have you run the migration SQL in Supabase?` },
        { status: 500 }
      );
    }

    const results: { name: string; status: string; stripeProductId?: string; stripePriceId?: string }[] = [];

    for (const svc of services ?? []) {
      if (svc.stripePriceId) {
        results.push({ name: svc.name, status: "already_synced", stripePriceId: svc.stripePriceId });
        continue;
      }

      try {
        const isOneOff = svc.isOneOff ?? false;

        // Create Stripe Product
        const product = await stripe.products.create({
          name: svc.name,
          description: svc.description,
          metadata: { serviceId: svc.id, isOneOff: String(isOneOff) },
        });

        // Create Stripe Price (CAD, in cents)
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(svc.price * 100),
          currency: "cad",
          ...(isOneOff ? {} : { recurring: { interval: "month" } }),
          metadata: { serviceId: svc.id },
        });

        // Save IDs back to DB
        const { error: updateError } = await supabase
          .from("Service")
          .update({ stripeProductId: product.id, stripePriceId: price.id })
          .eq("id", svc.id);

        if (updateError) {
          results.push({ name: svc.name, status: `stripe_created_but_db_error: ${updateError.message}` });
        } else {
          results.push({ name: svc.name, status: "created", stripeProductId: product.id, stripePriceId: price.id });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ name: svc.name, status: `error: ${msg}` });
      }
    }

    return NextResponse.json({ synced: results.length, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
