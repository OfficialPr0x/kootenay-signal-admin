import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VALID_SIZES = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "auto",
] as const;

const VALID_QUALITY = ["low", "medium", "high", "auto"] as const;

// ─── Brand Context Builder ────────────────────────────────────────────────────

interface BrandProfile {
  id: string;
  name: string;
  tagline: string | null;
  brandVoice: string | null;
  colorPalette: string | null;
  visualStyle: string | null;
  targetAudience: string | null;
  doList: string | null;
  dontList: string | null;
  extraContext: string | null;
}

function buildBrandedPrompt(userPrompt: string, brand: BrandProfile | null): string {
  if (!brand) return userPrompt;

  const lines: string[] = [];
  lines.push(`[BRAND: ${brand.name}]`);
  if (brand.tagline) lines.push(`Tagline: "${brand.tagline}"`);
  if (brand.brandVoice) lines.push(`\nBrand Voice: ${brand.brandVoice}`);
  if (brand.visualStyle) lines.push(`\nVisual Style: ${brand.visualStyle}`);

  if (brand.colorPalette) {
    try {
      const palette = JSON.parse(brand.colorPalette) as Array<{ name: string; hex: string }>;
      lines.push(`\nColor Palette: ${palette.map((c) => `${c.name} ${c.hex}`).join(", ")}`);
    } catch {
      lines.push(`\nColor Palette: ${brand.colorPalette}`);
    }
  }

  if (brand.targetAudience) lines.push(`\nTarget Audience: ${brand.targetAudience}`);

  if (brand.doList) {
    const dos = brand.doList.split("\n").map((l) => `- ${l.trim()}`).filter((l) => l.length > 3);
    if (dos.length) lines.push(`\nAlways do:\n${dos.join("\n")}`);
  }

  if (brand.dontList) {
    const donts = brand.dontList.split("\n").map((l) => `- ${l.trim()}`).filter((l) => l.length > 3);
    if (donts.length) lines.push(`\nNever do:\n${donts.join("\n")}`);
  }

  if (brand.extraContext) lines.push(`\nBrand Context: ${brand.extraContext}`);

  lines.push(`\n[AD CREATIVE REQUEST]\n${userPrompt}`);

  return lines.join("\n");
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size = "1024x1024", quality = "high", n = 1 } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 4000) {
      return NextResponse.json({ error: "Prompt must be 4000 characters or fewer" }, { status: 400 });
    }

    if (!VALID_SIZES.includes(size)) {
      return NextResponse.json({ error: "Invalid size" }, { status: 400 });
    }

    if (!VALID_QUALITY.includes(quality)) {
      return NextResponse.json({ error: "Invalid quality" }, { status: 400 });
    }

    const count = Math.min(Math.max(Number(n) || 1, 1), 4);

    // Fetch active brand profile to inject into every prompt
    const { data: brandProfile } = await supabase
      .from("AdBrandProfile")
      .select("*")
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    const userPrompt = prompt.trim();
    const brandedPrompt = buildBrandedPrompt(userPrompt, brandProfile as BrandProfile | null);
    // Fall back to raw prompt if brand context pushes past 4000 chars
    const finalPrompt = brandedPrompt.length > 4000 ? userPrompt : brandedPrompt;

    const result = await openai.images.generate({
      model: "gpt-image-2-2026-04-21",
      prompt: finalPrompt,
      size: size === "auto" ? undefined : (size as "1024x1024" | "1024x1536" | "1536x1024"),
      quality: quality === "auto" ? undefined : (quality as "low" | "medium" | "high"),
      n: count,
    });

    const rawImages = result.data ?? [];

    // Upload to Supabase Storage + save history record per image
    const images = await Promise.all(
      rawImages.map(async (item, idx) => {
        const b64 = item.b64_json ?? "";
        const revisedPrompt = (item as { revised_prompt?: string }).revised_prompt ?? null;
        let imageUrl: string | null = null;

        try {
          const buffer = Buffer.from(b64, "base64");
          const path = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.png`;
          const { error: upErr } = await supabase.storage
            .from("ad-creatives")
            .upload(path, buffer, { contentType: "image/png", upsert: false });

          if (!upErr) {
            const { data: urlData } = supabase.storage.from("ad-creatives").getPublicUrl(path);
            imageUrl = urlData.publicUrl;
          }
        } catch {
          // Storage failure is non-fatal
        }

        // Persist history
        await supabase.from("AdCreative").insert({
          prompt: userPrompt,
          revisedPrompt,
          brandedPrompt: finalPrompt !== userPrompt ? finalPrompt : null,
          size,
          quality,
          imageUrl,
          brandProfileId: (brandProfile as BrandProfile | null)?.id ?? null,
        });

        return { b64_json: b64, revised_prompt: revisedPrompt, imageUrl };
      })
    );

    return NextResponse.json({
      images,
      brandApplied: !!brandProfile,
      brandName: (brandProfile as BrandProfile | null)?.name ?? null,
    });
  } catch (err: unknown) {
    console.error("[ads/generate] Error:", err);

    if (err && typeof err === "object" && "status" in err) {
      const apiErr = err as { status: number; message?: string };
      if (apiErr.status === 400) {
        return NextResponse.json(
          { error: apiErr.message || "Invalid request to image API" },
          { status: 400 }
        );
      }
      if (apiErr.status === 429) {
        return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
      }
    }

    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
