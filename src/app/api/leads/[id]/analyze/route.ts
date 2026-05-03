import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { chat, MODELS } from "@/lib/openrouter";

// ─── JSON Schema ──────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    websiteStatus: {
      type: "string",
      enum: ["has_website", "no_website", "broken"],
    },
    websiteUrl:     { type: "string" },
    websiteQuality: { type: "string", enum: ["strong", "moderate", "weak", "none"] },
    websiteNotes:   { type: "string" },
    seoScore:       { type: "string", enum: ["strong", "moderate", "weak", "none"] },
    seoNotes:       { type: "string" },
    googleBusinessProfile: {
      type: "string",
      enum: ["verified", "unverified", "missing"],
    },
    googleReviewCount: { type: "number" },
    googleRating:      { type: "number" },
    socialMedia: {
      type: "object",
      properties: {
        facebook:  { type: "string" },
        instagram: { type: "string" },
        linkedin:  { type: "string" },
        twitter:   { type: "string" },
        tiktok:    { type: "string" },
        youtube:   { type: "string" },
      },
      required: ["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"],
      additionalProperties: false,
    },
    socialPresence: { type: "string", enum: ["strong", "moderate", "weak", "none"] },
    socialNotes:    { type: "string" },
    paidAds:        { type: "string", enum: ["active", "inactive", "unknown"] },
    adsNotes:       { type: "string" },
    painPoints:   { type: "array", items: { type: "string" } },
    opportunities: { type: "array", items: { type: "string" } },
    competitorGap: { type: "string" },
    estimatedMonthlyAdSpend: {
      type: "string",
      enum: ["none", "low (<$500)", "medium ($500-2k)", "high (>$2k)", "unknown"],
    },
    overallScore: { type: "number" },
    overallGrade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    summary: { type: "string" },
  },
  required: [
    "websiteStatus", "websiteUrl", "websiteQuality", "websiteNotes",
    "seoScore", "seoNotes", "googleBusinessProfile", "googleReviewCount", "googleRating",
    "socialMedia", "socialPresence", "socialNotes",
    "paidAds", "adsNotes", "painPoints", "opportunities", "competitorGap",
    "estimatedMonthlyAdSpend", "overallScore", "overallGrade", "summary",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a senior digital marketing analyst for Kootenay Signal, a full-service digital marketing agency in the Kootenays, BC.

Your job is to perform a thorough digital footprint analysis of a local business by searching the web for real data about them. You will analyze:
- Their website quality, mobile-friendliness, and load performance
- Their local SEO presence and Google rankings
- Their Google Business Profile completeness and review health
- Their social media presence across all channels
- Any visible paid advertising activity
- Specific pain points and missed opportunities that Kootenay Signal could address

Be specific, factual, and cite only real findings. If you cannot find data, say so. Your analysis will be used to craft a personalized sales pitch.`;

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: lead } = await supabase.from("Lead").select("*").eq("id", id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const businessName = lead.business || lead.name;
  const websiteHint = lead.websiteUrl ? `Website: ${lead.websiteUrl}` : "(no website on file — check if they have one)";

  const prompt = `Perform a complete digital marketing analysis for this business.

Business: ${businessName}
${websiteHint}
Industry: ${lead.industry || "local small business"}
Location: Kootenays, BC, Canada (or wherever they're actually based)
${lead.linkedinUrl ? `LinkedIn: ${lead.linkedinUrl}` : ""}

Use web search to find:
1. Their website — quality, mobile responsiveness, loading speed, design age
2. Google Business Profile — verified/unverified, review count, average rating
3. Google search rankings for local keywords related to their business
4. Social media accounts — Facebook, Instagram, LinkedIn, TikTok, YouTube — activity levels, follower counts
5. Any visible Google Ads or Facebook Ads campaigns
6. Digital marketing gaps vs. local competitors

Be thorough. Score their overall digital marketing health 0-100 (A=85+, B=70-84, C=50-69, D=30-49, F=<30).
Identify 3-5 specific pain points and 3-5 specific opportunities.`;

  try {
    const result = await chat(
      [{ role: "user", content: prompt }],
      {
        model: MODELS.SEARCH,
        system: SYSTEM_PROMPT,
        webSearch: true,
        maxWebResults: 8,
        reasoning: "medium",
        temperature: 0.2,
        maxTokens: 3000,
        jsonSchema: {
          name: "digital_footprint_analysis",
          schema: ANALYSIS_SCHEMA,
        },
      }
    );

    const analysis = JSON.parse(result.content) as Record<string, unknown>;

    // Persist to lead record
    const { data: updated, error } = await supabase
      .from("Lead")
      .update({ analysis, status: lead.status === "new" ? "qualified" : lead.status })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      analysis,
      lead: updated,
      meta: { model: result.model, tokens: result.usage?.total_tokens },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("402")) {
      return NextResponse.json({ error: "OpenRouter insufficient credits." }, { status: 402 });
    }
    if (message.includes("401")) {
      return NextResponse.json({ error: "Invalid OPENROUTER_API_KEY." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
