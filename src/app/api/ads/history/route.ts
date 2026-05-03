import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/ads/history — paginated generated creatives
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const { data, error, count } = await supabase
    .from("AdCreative")
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}
