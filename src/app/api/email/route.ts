import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendEmail, getEmailStats } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view"); // inbox, sent, all, stats
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const isArchived = searchParams.get("archived") === "true";
  const isStarred = searchParams.get("starred") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (view === "stats") {
    const stats = await getEmailStats();
    return NextResponse.json(stats);
  }

  // Build query
  let query = supabase
    .from("EmailMessage")
    .select("*, EmailEvent(*), EmailCampaign(id, name)", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  if (view === "inbox") {
    query = query.eq("direction", "inbound").eq("isArchived", isArchived);
  } else if (view === "sent") {
    query = query.eq("direction", "outbound");
  }

  if (isStarred) query = query.eq("isStarred", true);
  if (status) query = query.eq("status", status);

  if (search) {
    query = query.or(`subject.ilike.%${search}%,fromEmail.ilike.%${search}%,toEmail.ilike.%${search}%,bodyText.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reshape: rename EmailEvent -> events, EmailCampaign -> campaign, limit events to 5
  const messages = (data || []).map((m: Record<string, unknown>) => {
    const { EmailEvent, EmailCampaign, ...rest } = m;
    return {
      ...rest,
      events: (EmailEvent as unknown[] || []).slice(0, 5),
      campaign: EmailCampaign || null,
    };
  });

  // Unread count
  const { count: unreadCount } = await supabase
    .from("EmailMessage")
    .select("*", { count: "exact", head: true })
    .eq("direction", "inbound")
    .eq("isRead", false)
    .eq("isArchived", false);

  return NextResponse.json({ messages, total: count || 0, unreadCount: unreadCount || 0 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { to, subject, html, text, cc, bcc, replyTo, tags, threadId, inReplyTo } = body;

  if (!to || !subject || (!html && !text)) {
    return NextResponse.json(
      { error: "to, subject, and html or text are required" },
      { status: 400 }
    );
  }

  const toArray = Array.isArray(to) ? to : [to];
  const tagArray = tags
    ? tags.map((t: string | { name: string; value: string }) => {
        if (typeof t === "object" && t.name) return t;
        const [name, value] = String(t).split(":");
        return { name: name || String(t), value: value || String(t) };
      })
    : undefined;

  const result = await sendEmail({
    to: toArray,
    subject,
    html: html || `<p>${text}</p>`,
    text,
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
    replyTo,
    tags: tagArray,
    threadId,
    inReplyTo,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, id: result.id, messageId: result.messageId },
    { status: 201 }
  );
}
