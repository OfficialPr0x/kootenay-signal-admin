import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/db";

function generateTrackingCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/ads/qr — list all QR codes
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("QrCode")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/ads/qr — create a new QR code
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name,
    destination,
    foregroundColor = "#e87f24",
    backgroundColor = "#06080a",
    dotStyle = "rounded",
    cornerStyle = "extra-rounded",
    logoUrl = "https://res.cloudinary.com/doajstql7/image/upload/q_auto/f_auto/v1777852487/ChatGPT_Image_May_3_2026_05_54_38_PM_unw0n4.png",
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return NextResponse.json({ error: "Destination URL is required" }, { status: 400 });
  }

  // Generate a unique tracking code
  let trackingCode = generateTrackingCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("QrCode")
      .select("id")
      .eq("trackingCode", trackingCode)
      .maybeSingle();
    if (!existing) break;
    trackingCode = generateTrackingCode();
    attempts++;
  }

  const { data, error } = await supabase
    .from("QrCode")
    .insert({
      name: name.trim(),
      destination: destination.trim(),
      trackingCode,
      foregroundColor,
      backgroundColor,
      dotStyle,
      cornerStyle,
      logoUrl,
      isActive: true,
      totalClicks: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
