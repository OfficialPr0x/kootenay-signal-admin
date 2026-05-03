import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VALID_SIZES = [
  "1024x1024",
  "768x1024",
  "1152x2048",
  "1024x768",
  "2048x1152",
  "auto",
] as const;

const VALID_QUALITY = ["low", "medium", "high", "auto"] as const;

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

    const result = await openai.images.generate({
      model: "gpt-image-2-2026-04-21",
      prompt: prompt.trim(),
      size: size === "auto" ? undefined : (size as "1024x1024"),
      quality: quality === "auto" ? undefined : (quality as "low" | "medium" | "high"),
      n: count,
      response_format: "b64_json",
    });

    const images = result.data.map((item) => ({
      b64_json: item.b64_json,
      revised_prompt: (item as { revised_prompt?: string }).revised_prompt ?? null,
    }));

    return NextResponse.json({ images });
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
