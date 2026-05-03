import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// DELETE /api/ads/brand/assets/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get asset to find storage path
  const { data: asset, error: fetchError } = await supabase
    .from("AdBrandAsset")
    .select("fileUrl")
    .eq("id", id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Delete from storage — extract path from URL
  try {
    const url = new URL(asset.fileUrl);
    const bucketPrefix = "/storage/v1/object/public/ad-brand-assets/";
    if (url.pathname.startsWith(bucketPrefix)) {
      const storagePath = decodeURIComponent(url.pathname.slice(bucketPrefix.length));
      await supabase.storage.from("ad-brand-assets").remove([storagePath]);
    }
  } catch {
    // Storage delete failure is non-fatal — continue to delete the DB record
  }

  const { error } = await supabase.from("AdBrandAsset").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
