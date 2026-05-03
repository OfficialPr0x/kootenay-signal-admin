import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { chat, MODELS } from "@/lib/openrouter";

// ─── Agent Persona ────────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are the Kootenay Signal AI Marketing Director — a world-class digital marketing strategist and copywriter for Kootenay Signal, a premium digital marketing agency based in Nelson, BC.

Your personality:
- Confident, direct, and results-focused
- Knowledgeable about local Kootenay businesses and community
- Empathetic — you understand business owners' struggles
- You write like a human expert, not a robot
- No fluff, no generic platitudes — every line is specific to THIS business

Your company's services:
- SignalCore ($1,500/mo): Website + SEO + Google Business + Monthly reporting
- SignalGrow ($2,500/mo): Core + paid ads (Google/Meta) + social media management
- SignalPro ($4,000/mo): Grow + content creation + email marketing + conversion optimization
- Custom packages available

Writing style for cold outreach:
- Subject line: curiosity-driven, specific to their business weakness
- Opening: reference something SPECIFIC you found about their business (from the analysis)
- Problem: articulate the pain they feel but haven't fixed yet
- Solution: position Kootenay Signal as the obvious answer
- Offer: soft CTA — a free 20-minute marketing audit, no pressure
- Sign-off: personal, from Jaryd (founder)
- Length: 200-300 words in the email body
- Tone: trusted advisor reaching out, not a salesperson

Return ONLY the HTML for the email (with inline styles for email client compatibility).
Include the subject line as an HTML comment at the very top: <!-- SUBJECT: Your subject line here -->`;

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: lead } = await supabase.from("Lead").select("*").eq("id", id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const businessName = lead.business || lead.name;
  const analysis = lead.analysis as Record<string, unknown> | null;

  const analysisContext = analysis
    ? `Digital Footprint Analysis:
- Website: ${analysis.websiteStatus} (${analysis.websiteQuality} quality) — ${analysis.websiteNotes}
- SEO: ${analysis.seoScore} — ${analysis.seoNotes}
- Google Business: ${analysis.googleBusinessProfile} | ${analysis.googleReviewCount} reviews | ${analysis.googleRating}★
- Social Media: ${analysis.socialPresence} — ${analysis.socialNotes}
- Paid Ads: ${analysis.paidAds} — ${analysis.adsNotes}
- Overall Grade: ${analysis.overallGrade} (${analysis.overallScore}/100)
- Key Pain Points: ${(analysis.painPoints as string[])?.join(" | ")}
- Opportunities: ${(analysis.opportunities as string[])?.join(" | ")}
- Competitor Gap: ${analysis.competitorGap}
- Summary: ${analysis.summary}`
    : `No analysis on file. Write a compelling pitch based on what you know about ${lead.industry || "local"} businesses in the Kootenays.`;

  const prompt = `Write a cold outreach pitch email for this prospect.

Contact: ${lead.name}
Business: ${businessName}
Industry: ${lead.industry || "local business"}
Website: ${lead.websiteUrl || "unknown"}
Email: ${lead.email || "unknown"}
Location: Kootenays, BC, Canada

${analysisContext}

Craft the most compelling, personalized HTML pitch email possible. Reference the specific pain points from the analysis. Recommend the appropriate Kootenay Signal package tier based on their business size and current digital gaps. Close with an invitation for a free 20-minute marketing audit call — low pressure, high value.`;

  try {
    const result = await chat(
      [{ role: "user", content: prompt }],
      {
        model: MODELS.PRO,
        system: AGENT_SYSTEM_PROMPT,
        reasoning: "high",
        temperature: 0.75,
        maxTokens: 2500,
      }
    );

    const content = result.content;

    // Save pitch draft to lead
    const { data: updated, error } = await supabase
      .from("Lead")
      .update({ pitchDraft: content })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Extract subject from HTML comment
    const subjectMatch = content.match(/<!--\s*SUBJECT:\s*(.+?)\s*-->/i);
    const subject = subjectMatch
      ? subjectMatch[1].trim()
      : `Grow ${businessName}'s Online Presence — Kootenay Signal`;

    return NextResponse.json({
      pitchDraft: content,
      subject,
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
