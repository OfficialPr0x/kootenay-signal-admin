import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// Public tracking redirect — no auth required.
// URL format: /api/r/[trackingCode] → redirect to destination

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Look up QR code record
  const { data: qr } = await supabase
    .from("QrCode")
    .select("id, destination, isActive")
    .eq("trackingCode", code)
    .maybeSingle();

  if (!qr || !qr.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Record click — capture useful metadata
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const country = request.headers.get("x-vercel-ip-country") || null;
  const city = request.headers.get("x-vercel-ip-city") || null;
  const region = request.headers.get("x-vercel-ip-country-region") || null;
  const userAgent = request.headers.get("user-agent") || null;
  const referer = request.headers.get("referer") || null;

  // Fire-and-forget — don't block the redirect
  supabase
    .from("QrCodeClick")
    .insert({
      qrCodeId: qr.id,
      ipAddress: ip,
      userAgent,
      referer,
      country,
      city,
      region,
    })
    .then(() => {
      // Also bump the totalClicks counter
      return supabase.rpc("increment_qr_clicks", { qr_id: qr.id });
    })
    .catch(() => {
      // Non-fatal
    });

  // Redirect
  const destination = qr.destination.startsWith("http")
    ? qr.destination
    : `https://${qr.destination}`;

  return NextResponse.redirect(destination, { status: 302 });
}
