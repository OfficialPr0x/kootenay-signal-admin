import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";

// GET /api/ads/qr/[id] — single QR code with recent clicks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: qr, error } = await supabase
    .from("QrCode")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !qr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Recent 50 clicks
  const { data: clicks } = await supabase
    .from("QrCodeClick")
    .select("id, country, city, region, referer, clickedAt")
    .eq("qrCodeId", id)
    .order("clickedAt", { ascending: false })
    .limit(50);

  // Country breakdown
  const { data: byCountry } = await supabase
    .from("QrCodeClick")
    .select("country")
    .eq("qrCodeId", id);

  const countryMap: Record<string, number> = {};
  for (const row of byCountry ?? []) {
    const c = row.country || "Unknown";
    countryMap[c] = (countryMap[c] || 0) + 1;
  }

  return NextResponse.json({
    ...qr,
    recentClicks: clicks ?? [],
    clicksByCountry: countryMap,
  });
}

// PATCH /api/ads/qr/[id] — update a QR code
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "destination", "foregroundColor", "backgroundColor", "dotStyle", "cornerStyle", "logoUrl", "isActive"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("QrCode")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/ads/qr/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase.from("QrCode").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
