import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: campaign, error } = await supabase
    .from("EmailCampaign")
    .select("*, CampaignStep(*), EmailMessage(*, EmailEvent(*))")
    .eq("id", id)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Reshape
  const { CampaignStep, EmailMessage, ...rest } = campaign;
  const steps = (CampaignStep as Array<Record<string, unknown>> || []).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) => (a.stepOrder as number) - (b.stepOrder as number)
  );
  const messages = (EmailMessage as Array<Record<string, unknown>> || [])
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    )
    .slice(0, 50)
    .map((m: Record<string, unknown>) => {
      const { EmailEvent, ...mRest } = m;
      return { ...mRest, events: EmailEvent || [] };
    });

  return NextResponse.json({ ...rest, steps, messages });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { data: campaign, error } = await supabase
    .from("EmailCampaign")
    .update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.subject !== undefined && { subject: body.subject }),
      ...(body.bodyHtml !== undefined && { bodyHtml: body.bodyHtml }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.status !== undefined && { status: body.status }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(campaign);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("EmailCampaign").delete().eq("id", id);
  return NextResponse.json({ success: true });
}

// Send campaign to a list of contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { contactIds, contactEmails } = body;

  const { data: campaign, error: campErr } = await supabase
    .from("EmailCampaign")
    .select("*, CampaignStep(*)")
    .eq("id", id)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const steps = (campaign.CampaignStep as Array<Record<string, unknown>> || []).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) => (a.stepOrder as number) - (b.stepOrder as number)
  );

  // Get target emails
  let emails: string[] = contactEmails || [];
  if (contactIds && contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("EmailContact")
      .select("email")
      .in("id", contactIds)
      .eq("status", "subscribed");
    emails = [...emails, ...(contacts || []).map((c: { email: string }) => c.email)];
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
  }

  // Use the first step or campaign subject/body
  const subject = steps[0]?.subject as string || campaign.subject;
  const bodyHtml = steps[0]?.bodyHtml as string || campaign.bodyHtml;

  if (!subject || !bodyHtml) {
    return NextResponse.json(
      { error: "Campaign has no subject or body content" },
      { status: 400 }
    );
  }

  // Send to each recipient
  const results = [];
  for (const email of emails) {
    const result = await sendEmail({
      to: email,
      subject,
      html: bodyHtml,
      tags: [{ name: "campaign", value: campaign.name }],
      campaignId: campaign.id,
    });
    results.push({ email, ...result });
  }

  // Mark campaign as active
  await supabase.from("EmailCampaign").update({ status: "active" }).eq("id", id);

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    success: true,
    sent: successCount,
    failed: results.length - successCount,
    results,
  });
}
