import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: campaigns, error } = await supabase
    .from("EmailCampaign")
    .select("*, CampaignStep(*), EmailMessage(id)")
    .order("updatedAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape: steps sorted, add _count.messages
  const shaped = (campaigns || []).map((c: Record<string, unknown>) => {
    const { CampaignStep, EmailMessage, ...rest } = c;
    const steps = (CampaignStep as Array<Record<string, unknown>> || []).sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) => (a.stepOrder as number) - (b.stepOrder as number)
    );
    return { ...rest, steps, _count: { messages: (EmailMessage as unknown[] || []).length } };
  });

  return NextResponse.json(shaped);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, subject, bodyHtml, tags, steps } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Create campaign first
  const { data: campaign, error } = await supabase
    .from("EmailCampaign")
    .insert({ name, description: description || null, subject: subject || null, bodyHtml: bodyHtml || null, tags: tags || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create steps if provided
  let stepData: unknown[] = [];
  if (steps && steps.length > 0) {
    const stepRows = steps.map(
      (step: { subject: string; bodyHtml: string; delayDays?: number }, index: number) => ({
        campaignId: campaign.id,
        stepOrder: index + 1,
        subject: step.subject,
        bodyHtml: step.bodyHtml,
        delayDays: step.delayDays || 0,
      })
    );
    const { data: insertedSteps } = await supabase.from("CampaignStep").insert(stepRows).select();
    stepData = insertedSteps || [];
  }

  return NextResponse.json({ ...campaign, steps: stepData }, { status: 201 });
}
