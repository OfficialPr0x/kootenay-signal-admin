import { Resend } from "resend";
import { supabase } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);

// Strip HTML to plain text (improves deliverability — emails with both html+text score better)
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
  idempotencyKey?: string;
  campaignId?: string;
  threadId?: string;
  inReplyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  tags,
  idempotencyKey,
  campaignId,
  threadId,
  inReplyTo,
}: SendEmailOptions) {
  const from = process.env.FROM_EMAIL || "Kootenay Signal <onboarding@resend.dev>";
  const toArray = Array.isArray(to) ? to : [to];

  // Auto-generate plain text from HTML if not provided (improves spam score)
  const plainText = text || stripHtml(html);

  const { data, error } = await resend.emails.send({
    from,
    to: toArray,
    subject,
    html,
    text: plainText,
    replyTo: replyTo || process.env.ADMIN_EMAIL || "jaryd@kootenaysignal.com",
    headers: {
      "X-Entity-Ref-ID": `ks-${Date.now()}`,
      "List-Unsubscribe": `<mailto:${process.env.ADMIN_EMAIL || "jaryd@kootenaysignal.com"}?subject=unsubscribe>`,
    },
    ...(cc && cc.length > 0 && { cc }),
    ...(bcc && bcc.length > 0 && { bcc }),
    ...(tags && tags.length > 0 && { tags }),
    ...(idempotencyKey && { idempotencyKey }),
  });

  if (error) {
    console.error("Email send error:", error);
    // Log the failed message
    await supabase.from("EmailMessage").insert({
      direction: "outbound",
      fromEmail: from,
      fromName: from.split("<")[0]?.trim() || null,
      toEmail: toArray.join(", "),
      subject,
      bodyHtml: html,
      bodyText: text || null,
      cc: cc?.join(", ") || null,
      bcc: bcc?.join(", ") || null,
      status: "failed",
      tags: tags?.map((t) => `${t.name}:${t.value}`).join(", ") || null,
      campaignId: campaignId || null,
      threadId: threadId || null,
      inReplyTo: inReplyTo || null,
    });
    return { success: false, error: error.message };
  }

  // Save the sent message
  const { data: message } = await supabase
    .from("EmailMessage")
    .insert({
      resendId: data?.id || null,
      direction: "outbound",
      fromEmail: from,
      fromName: from.split("<")[0]?.trim() || null,
      toEmail: toArray.join(", "),
      subject,
      bodyHtml: html,
      bodyText: text || null,
      cc: cc?.join(", ") || null,
      bcc: bcc?.join(", ") || null,
      status: "sent",
      isRead: true,
      tags: tags?.map((t) => `${t.name}:${t.value}`).join(", ") || null,
      campaignId: campaignId || null,
      threadId: threadId || data?.id || null,
      inReplyTo: inReplyTo || null,
    })
    .select()
    .single();

  // Also log to legacy EmailLog for backwards compat
  await supabase.from("EmailLog").insert({
    to: toArray.join(", "),
    subject,
    body: html,
    status: "sent",
    resendId: data?.id || null,
  });

  return { success: true, id: data?.id, messageId: message.id };
}

export async function getEmailStats() {
  const [sentRes, receivedRes, bouncedRes, openedRes] = await Promise.all([
    supabase.from("EmailMessage").select("*", { count: "exact", head: true }).eq("direction", "outbound"),
    supabase.from("EmailMessage").select("*", { count: "exact", head: true }).eq("direction", "inbound"),
    supabase.from("EmailMessage").select("*", { count: "exact", head: true }).eq("status", "bounced"),
    supabase.from("EmailEvent").select("*", { count: "exact", head: true }).eq("type", "opened"),
  ]);

  const totalSent = sentRes.count || 0;
  const totalReceived = receivedRes.count || 0;
  const totalBounced = bouncedRes.count || 0;
  const totalOpened = openedRes.count || 0;

  return {
    totalSent,
    totalReceived,
    totalBounced,
    totalOpened,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
  };
}

export { resend };
