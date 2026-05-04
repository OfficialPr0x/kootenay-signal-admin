import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabase } from "@/lib/db";

// Resend inbound webhook - receives incoming emails
// Configure in Resend dashboard: https://resend.com/webhooks
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify Resend webhook signature if secret is configured
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 401 });
    }
    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);

  // Resend sends inbound emails with these fields
  const {
    from,
    to,
    subject,
    html,
    text,
    cc,
    headers,
  } = body;

  if (!from || !to) {
    return NextResponse.json({ error: "Invalid inbound payload" }, { status: 400 });
  }

  // Parse "Name <email@domain.com>" or plain "email@domain.com"
  let fromEmail: string;
  let fromName: string | undefined;
  if (typeof from === "object") {
    fromEmail = from.email || from;
    fromName = from.name;
  } else {
    const match = (from as string).match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      fromName = match[1].trim() || undefined;
      fromEmail = match[2].trim();
    } else {
      fromEmail = (from as string).trim();
    }
  }
  const toEmail = Array.isArray(to) ? to.join(", ") : to;

  // Extract thread info from headers
  const inReplyTo = headers?.["in-reply-to"] || headers?.["In-Reply-To"];
  const messageId = headers?.["message-id"] || headers?.["Message-ID"];

  // Try to find existing thread
  let threadId: string | null = null;
  if (inReplyTo) {
    const { data: parent } = await supabase
      .from("EmailMessage")
      .select("threadId")
      .eq("resendId", inReplyTo)
      .limit(1)
      .single();
    threadId = parent?.threadId || null;
  }

  const { data: message, error } = await supabase
    .from("EmailMessage")
    .insert({
      resendId: messageId || null,
      direction: "inbound",
      fromEmail,
      fromName: fromName || null,
      toEmail,
      subject: subject || "(No Subject)",
      bodyHtml: html || null,
      bodyText: text || null,
      cc: Array.isArray(cc) ? cc.join(", ") : cc || null,
      status: "received",
      isRead: false,
      threadId,
      inReplyTo: inReplyTo || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create contact if not exists
  await supabase
    .from("EmailContact")
    .upsert({
      email: fromEmail,
      name: fromName || null,
      status: "subscribed",
    }, { onConflict: "email" });

  return NextResponse.json({ success: true, id: message.id }, { status: 201 });
}
