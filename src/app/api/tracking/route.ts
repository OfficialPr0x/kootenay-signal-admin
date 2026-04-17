import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/tracking - Get email tracking analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7d";

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default: // 7d
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const startISO = startDate.toISOString();

  // Get all events in period
  const { data: events } = await supabase
    .from("EmailEvent")
    .select("type, createdAt, messageId")
    .gte("createdAt", startISO);

  // Get outbound messages in period
  const { data: messages } = await supabase
    .from("EmailMessage")
    .select("id, subject, createdAt, status")
    .eq("direction", "outbound")
    .gte("createdAt", startISO);

  const msgList = messages || [];
  const evtList = events || [];

  const sent = msgList.length;
  const eventCounts: Record<string, number> = {};
  for (const e of evtList) {
    eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
  }

  const delivered = eventCounts["delivered"] || 0;
  const opened = eventCounts["opened"] || 0;
  const clicked = eventCounts["clicked"] || 0;
  const bounced = eventCounts["bounced"] || 0;
  const complained = eventCounts["complained"] || 0;

  // Count replies (inbound messages that are replies)
  const { count: replies } = await supabase
    .from("EmailMessage")
    .select("*", { count: "exact", head: true })
    .eq("direction", "inbound")
    .not("inReplyTo", "is", null)
    .gte("createdAt", startISO);

  const replyCount = replies || 0;

  const stats = {
    sent,
    delivered,
    opened,
    clicked,
    replied: replyCount,
    bounced,
    unsubscribed: 0,
    complained,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
    replyRate: sent > 0 ? (replyCount / sent) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
  };

  // Top subjects by open rate
  const subjectMap = new Map<string, { sent: number; opens: number; clicks: number; replies: number }>();
  const messageSubjects = new Map<string, string>();
  for (const m of msgList) {
    messageSubjects.set(m.id, m.subject);
    const existing = subjectMap.get(m.subject) || { sent: 0, opens: 0, clicks: 0, replies: 0 };
    existing.sent++;
    subjectMap.set(m.subject, existing);
  }

  for (const e of evtList) {
    const subject = messageSubjects.get(e.messageId);
    if (!subject) continue;
    const existing = subjectMap.get(subject);
    if (!existing) continue;
    if (e.type === "opened") existing.opens++;
    if (e.type === "clicked") existing.clicks++;
  }

  const topSubjects = Array.from(subjectMap.entries())
    .map(([subject, data]) => ({
      subject,
      sent: data.sent,
      opens: data.opens,
      clicks: data.clicks,
      replies: data.replies,
      openRate: data.sent > 0 ? (data.opens / data.sent) * 100 : 0,
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10);

  // Mailbox performance
  const { data: mailboxRows } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*)");

  const mailboxPerformance = (mailboxRows || []).map((mb: Record<string, unknown>) => {
    const snapshots = (mb.MailboxHealthSnapshot as Array<Record<string, unknown>> || []);
    const health = snapshots[0];
    return {
      email: mb.email,
      sent: mb.currentVolume,
      bounceRate: (health?.bounceRate as number) || 0,
      replyRate: (health?.replyRate as number) || 0,
      trustScore: mb.trustScore,
    };
  });

  // Daily volume (aggregate by day)
  const dayMap = new Map<string, { sent: number; delivered: number; bounced: number }>();
  for (const m of msgList) {
    const day = new Date(m.createdAt).toISOString().split("T")[0];
    const existing = dayMap.get(day) || { sent: 0, delivered: 0, bounced: 0 };
    existing.sent++;
    dayMap.set(day, existing);
  }
  for (const e of evtList) {
    const day = new Date(e.createdAt).toISOString().split("T")[0];
    const existing = dayMap.get(day);
    if (!existing) continue;
    if (e.type === "delivered") existing.delivered++;
    if (e.type === "bounced") existing.bounced++;
  }

  const dailyVolume = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    stats,
    topSubjects,
    mailboxPerformance,
    dailyVolume,
  });
}
