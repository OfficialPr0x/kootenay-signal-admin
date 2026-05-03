import { NextRequest, NextResponse } from "next/server";
import { chat, searchThenStructure, MODELS } from "@/lib/openrouter";

// ─── JSON Schema ──────────────────────────────────────────────────────────────

const LEAD_SCHEMA = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:        { type: "string", description: "Contact name if findable, otherwise empty" },
          email:       { type: "string", description: "Business email if findable, otherwise empty" },
          phone:       { type: "string", description: "Phone number if findable, otherwise empty" },
          business:    { type: "string", description: "Business name" },
          websiteUrl:  { type: "string", description: "Website URL if they have one, otherwise empty" },
          industry:    { type: "string", description: "Industry or business category" },
          linkedinUrl: { type: "string", description: "LinkedIn URL if found, otherwise empty" },
          notes:       { type: "string", description: "1-2 sentence observation about digital marketing gaps" },
        },
        required: ["name", "email", "phone", "business", "websiteUrl", "industry", "linkedinUrl", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["leads"],
  additionalProperties: false,
};

const STRUCTURE_SYSTEM = `You are a data extraction assistant for Kootenay Signal marketing agency. 
Extract structured lead data from web research results. 
Be accurate — if a field is not found, use an empty string. Never fabricate email addresses.
Only include real businesses with verifiable information.`;

// ─── Route ────────────────────────────────────────────────────────────────────

interface FindLeadsBody {
  industry?: string;
  location?: string;
  keywords?: string;
  count?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: FindLeadsBody = await request.json();
    const {
      industry = "",
      location = "Kootenays, BC, Canada",
      keywords = "",
      count = 10,
    } = body;

    if (!industry && !keywords) {
      return NextResponse.json(
        { error: "Provide at least an industry or keywords to search for" },
        { status: 400 }
      );
    }

    const searchPrompt = `Find real local businesses for a digital marketing agency to prospect.

Search criteria:
- Industry/Type: ${industry || "any local small business"}
- Location: ${location}
- Additional signals: ${keywords || "businesses that could benefit from digital marketing"}
- Find: ${count} businesses

Search the web for real businesses in this area. For each business, try to find:
- Their actual website (or note if they don't have one)
- Contact email addresses
- Phone numbers
- LinkedIn presence
- Any observable weakness in their digital marketing (outdated site, few Google reviews, no social media, etc.)

Be specific and factual. Return only real, verifiable businesses.`;

    const structureUserPrompt = (searchText: string) =>
      `Based on the following web research, extract up to ${count} real business leads as structured JSON.

RESEARCH RESULTS:
${searchText}

Extract real businesses found in the research. For businesses without a discoverable email, use empty string — never fabricate contact info.`;

    const data = await searchThenStructure<{ leads: unknown[] }>(
      searchPrompt,
      STRUCTURE_SYSTEM,
      structureUserPrompt,
      { name: "lead_list", schema: LEAD_SCHEMA },
      { searchModel: MODELS.SEARCH, structureModel: MODELS.SEARCH, maxWebResults: 8 }
    );

    return NextResponse.json({
      leads: data.leads ?? [],
      query: { industry, location, keywords, count },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Surface OpenRouter credit/auth errors clearly
    if (message.includes("402")) {
      return NextResponse.json({ error: "OpenRouter account has insufficient credits. Top up at openrouter.ai/credits." }, { status: 402 });
    }
    if (message.includes("401")) {
      return NextResponse.json({ error: "Invalid OPENROUTER_API_KEY. Check your .env file." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow testing the web search connectivity
export async function GET() {
  try {
    const result = await chat(
      [{ role: "user", content: "What is the current date? One sentence only." }],
      { model: MODELS.MICRO, maxTokens: 50 }
    );
    return NextResponse.json({ ok: true, response: result.content, model: result.model });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}


