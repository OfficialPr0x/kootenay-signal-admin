import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: message, error } = await supabase
    .from("EmailMessage")
    .select("*, EmailEvent(*), EmailCampaign(*)")
    .eq("id", id)
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Reshape
  const { EmailEvent, EmailCampaign, ...rest } = message;
  const shaped = { ...rest, events: EmailEvent || [], campaign: EmailCampaign || null };

  // Mark as read if inbound
  if (message.direction === "inbound" && !message.isRead) {
    await supabase.from("EmailMessage").update({ isRead: true }).eq("id", id);
  }

  return NextResponse.json(shaped);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowedFields = ["isRead", "isArchived", "isStarred", "status", "tags"];
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  const { data: message, error } = await supabase
    .from("EmailMessage")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(message);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("EmailMessage").delete().eq("id", id);
  return NextResponse.json({ success: true });
}

// Reply to a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { data: original, error: findErr } = await supabase
    .from("EmailMessage")
    .select("*")
    .eq("id", id)
    .single();
  if (findErr || !original) {
    return NextResponse.json({ error: "Original message not found" }, { status: 404 });
  }

  const { html, text, cc, bcc } = body;
  if (!html && !text) {
    return NextResponse.json({ error: "html or text is required" }, { status: 400 });
  }

  // Determine reply-to address
  const replyToEmail =
    original.direction === "inbound" ? original.fromEmail : original.toEmail;

  const result = await sendEmail({
    to: replyToEmail,
    subject: original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`,
    html: html || `<p>${text}</p>`,
    text,
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
    threadId: original.threadId || original.id,
    inReplyTo: original.resendId || undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, id: result.id, messageId: result.messageId },
    { status: 201 }
  );
}
