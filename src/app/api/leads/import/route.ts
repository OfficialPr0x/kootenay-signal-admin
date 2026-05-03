import { NextRequest, NextResponse } from "next/server";
import { chat, MODELS } from "@/lib/openrouter";

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// ─── Known aliases (fast path — no AI call needed) ─────────────────────────────

const KNOWN_ALIASES: Record<string, string> = {
  name: "name", full_name: "name", contact_name: "name", first_name: "name", owner: "name",
  contact: "name", "contact person": "name",
  email: "email", email_address: "email", "e-mail": "email", "e mail": "email",
  phone: "phone", phone_number: "phone", mobile: "phone", telephone: "phone", cell: "phone",
  business: "business", company: "business", company_name: "business", "business name": "business",
  organisation: "business", organization: "business", "business/organization": "business",
  website: "websiteUrl", website_url: "websiteUrl", url: "websiteUrl", web: "websiteUrl",
  "website url": "websiteUrl", "business website": "websiteUrl",
  industry: "industry", sector: "industry", category: "industry", type: "industry",
  "business type": "industry", "business category": "industry",
  linkedin: "linkedinUrl", linkedin_url: "linkedinUrl", "linkedin url": "linkedinUrl",
  notes: "notes", note: "notes", message: "notes", comments: "notes", description: "notes",
  address: "notes", location: "notes",
};

function tryFastMap(headers: string[]): Record<string, string> | null {
  const mapping: Record<string, string> = {};
  let matched = 0;
  for (const h of headers) {
    const key = h.toLowerCase().replace(/[^a-z0-9 _]/g, "").trim();
    if (KNOWN_ALIASES[key]) {
      mapping[h] = KNOWN_ALIASES[key];
      matched++;
    } else {
      mapping[h] = "ignore";
    }
  }
  // Use fast path if we matched at least name or business
  const hasNameOrBusiness = Object.values(mapping).some((v) => v === "name" || v === "business");
  return hasNameOrBusiness ? mapping : null;
}

// ─── AI Column Mapping ────────────────────────────────────────────────────────

const MAPPING_SCHEMA = {
  type: "object",
  properties: {
    columnMappings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          csvColumn: { type: "string" },
          field: {
            type: "string",
            enum: ["name", "email", "phone", "business", "websiteUrl", "industry", "linkedinUrl", "notes", "ignore"],
          },
        },
        required: ["csvColumn", "field"],
        additionalProperties: false,
      },
    },
  },
  required: ["columnMappings"],
  additionalProperties: false,
};

async function getAIMapping(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<Record<string, string>> {
  const sampleText = sampleRows
    .slice(0, 3)
    .map((r) => headers.map((h) => `${h}: ${r[h] || ""}`).join(" | "))
    .join("\n");

  const result = await chat(
    [
      {
        role: "user",
        content: `Map these CSV columns to the correct lead CRM fields.

CSV Headers: ${headers.join(", ")}

Sample data:
${sampleText}

Available fields:
- name: Person's name or contact name
- email: Email address
- phone: Phone number
- business: Business/company name
- websiteUrl: Website URL
- industry: Business category or industry
- linkedinUrl: LinkedIn profile URL
- notes: Any additional notes, address, or description
- ignore: Column not relevant to a lead record

Map every header to exactly one field.`,
      },
    ],
    {
      model: MODELS.MICRO,
      jsonSchema: { name: "column_mapping", schema: MAPPING_SCHEMA },
      temperature: 0,
      maxTokens: 512,
    }
  );

  const parsed = JSON.parse(result.content) as { columnMappings: { csvColumn: string; field: string }[] };
  const mapping: Record<string, string> = {};
  for (const { csvColumn, field } of parsed.columnMappings) {
    mapping[csvColumn] = field;
  }
  return mapping;
}

// ─── Apply Mapping ────────────────────────────────────────────────────────────

interface MappedLead {
  name: string;
  email: string;
  phone: string;
  business: string;
  websiteUrl: string;
  industry: string;
  linkedinUrl: string;
  notes: string;
}

function applyMapping(rows: Record<string, string>[], mapping: Record<string, string>): MappedLead[] {
  return rows
    .map((row) => {
      const lead: Record<string, string> = { name: "", email: "", phone: "", business: "", websiteUrl: "", industry: "", linkedinUrl: "", notes: "" };
      for (const [col, field] of Object.entries(mapping)) {
        if (field === "ignore") continue;
        const val = row[col]?.trim() ?? "";
        if (val && lead[field] !== undefined) {
          // Concatenate multiple columns that map to the same field
          lead[field] = lead[field] ? `${lead[field]}, ${val}` : val;
        }
      }
      return lead as MappedLead;
    })
    .filter((l) => l.name || l.business || l.email); // keep rows with at least something useful
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
    }

    // Try fast alias mapping first (no AI needed for standard CSVs)
    let mapping = tryFastMap(headers);

    // Fall back to AI if columns are non-standard
    if (!mapping) {
      mapping = await getAIMapping(headers, rows);
    }

    const preview = applyMapping(rows, mapping);

    if (preview.length === 0) {
      return NextResponse.json(
        { error: "Could not extract any usable lead data from this CSV. Check that it contains business or contact information." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      preview,
      rawCount: rows.length,
      mapping,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


/** Simple CSV parser — handles quoted fields with commas inside */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Map CSV column aliases to our canonical field names */
const FIELD_MAP: Record<string, string> = {
  name: "name",
  full_name: "name",
  contact_name: "name",
  email: "email",
  email_address: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  business: "business",
  company: "business",
  company_name: "business",
  organisation: "business",
  organization: "business",
  website: "websiteUrl",
  website_url: "websiteUrl",
  url: "websiteUrl",
  industry: "industry",
  sector: "industry",
  linkedin: "linkedinUrl",
  linkedin_url: "linkedinUrl",
  notes: "notes",
  message: "message",
  source: "source",
};
