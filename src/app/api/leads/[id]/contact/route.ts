import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { subject: customSubject, pitchHtml: customPitch } = body as {
    subject?: string;
    pitchHtml?: string;
  };

  const { data: lead } = await supabase.from("Lead").select("*").eq("id", id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const pitchHtml = customPitch || lead.pitchDraft;
  if (!pitchHtml) {
    return NextResponse.json(
      { error: "No pitch draft found. Generate a pitch first." },
      { status: 400 }
    );
  }

  // Extract subject line from HTML comment if present and not overridden
  const subjectMatch = pitchHtml.match(/<!--\s*SUBJECT:\s*(.+?)\s*-->/i);
  const subject: string =
    customSubject ||
    (subjectMatch ? subjectMatch[1] : `Grow ${lead.business || lead.name}'s Online Presence`);

  try {
    await sendEmail({
      to: lead.email as string,
      subject,
      html: pitchHtml,
      tags: [
        { name: "type", value: "lead_pitch" },
        { name: "lead_id", value: lead.id },
      ],
    });

    // Mark as pitched + update status
    const { data: updated, error } = await supabase
      .from("Lead")
      .update({
        pitchSentAt: new Date().toISOString(),
        status: "contacted",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, subject, lead: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
