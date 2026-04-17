import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// Resend inbound webhook - receives incoming emails
// Configure in Resend dashboard: https://resend.com/webhooks
export async function POST(request: NextRequest) {
  const body = await request.json();

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

  const fromEmail = typeof from === "string" ? from : from.email || from;
  const fromName = typeof from === "object" ? from.name : undefined;
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
