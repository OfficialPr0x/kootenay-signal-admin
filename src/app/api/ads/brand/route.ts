import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/ads/brand — fetch the active brand profile (with assets)
export async function GET() {
  const { data, error } = await supabase
    .from("AdBrandProfile")
    .select("*, AdBrandAsset(*)")
    .eq("isActive", true)
    .order("createdAt", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? null);
}

// PUT /api/ads/brand — upsert the active brand profile
export async function PUT(request: NextRequest) {
  const body = await request.json();

  const {
    name,
    tagline,
    brandVoice,
    colorPalette,
    visualStyle,
    targetAudience,
    doList,
    dontList,
    extraContext,
  } = body;

  // Fetch existing active profile id
  const { data: existing } = await supabase
    .from("AdBrandProfile")
    .select("id")
    .eq("isActive", true)
    .limit(1)
    .maybeSingle();

  const payload = {
    name: name ?? "Kootenay Signal",
    tagline: tagline ?? null,
    brandVoice: brandVoice ?? null,
    colorPalette: colorPalette ?? null,
    visualStyle: visualStyle ?? null,
    targetAudience: targetAudience ?? null,
    doList: doList ?? null,
    dontList: dontList ?? null,
    extraContext: extraContext ?? null,
    isActive: true,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("AdBrandProfile")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // No profile yet — insert
  const { data, error } = await supabase
    .from("AdBrandProfile")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
