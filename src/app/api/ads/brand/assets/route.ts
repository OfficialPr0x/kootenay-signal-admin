import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/ads/brand/assets — list all assets for the active brand profile
export async function GET() {
  const { data: profile } = await supabase
    .from("AdBrandProfile")
    .select("id")
    .eq("isActive", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("AdBrandAsset")
    .select("*")
    .eq("brandProfileId", profile.id)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// POST /api/ads/brand/assets — upload a new brand asset image
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || "Untitled Asset";
  const description = (formData.get("description") as string) || null;
  const assetType = (formData.get("assetType") as string) || "reference";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be PNG, JPEG, WebP, or GIF" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  // Get active brand profile
  const { data: profile } = await supabase
    .from("AdBrandProfile")
    .select("id")
    .eq("isActive", true)
    .limit(1)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "No active brand profile found. Create one first." }, { status: 404 });
  }

  // Upload to Supabase Storage
  const ext = file.type.split("/")[1] || "png";
  const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("ad-brand-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("ad-brand-assets").getPublicUrl(path);
  const fileUrl = urlData.publicUrl;

  // Save record
  const { data, error } = await supabase
    .from("AdBrandAsset")
    .insert({
      brandProfileId: profile.id,
      name,
      description,
      fileUrl,
      mimeType: file.type,
      assetType,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
