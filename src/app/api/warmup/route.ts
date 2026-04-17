import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/warmup - List warmup profiles
export async function GET() {
  const { data: profiles, error } = await supabase
    .from("WarmupProfile")
    .select("*, WarmupJob(id, status)")
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape: rename WarmupJob -> jobs
  const shaped = (profiles || []).map((p: Record<string, unknown>) => {
    const { WarmupJob, ...rest } = p;
    return { ...rest, jobs: WarmupJob || [] };
  });

  return NextResponse.json({ profiles: shaped });
}

// POST /api/warmup - Create warmup profile
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, startVolume, maxVolume, rampIncrement, seedAddresses, contentVariants } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: profile, error } = await supabase
    .from("WarmupProfile")
    .insert({
      name,
      startVolume: startVolume || 2,
      maxVolume: maxVolume || 40,
      rampIncrement: rampIncrement || 2,
      seedAddresses: seedAddresses || null,
      contentVariants: contentVariants || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(profile, { status: 201 });
}
