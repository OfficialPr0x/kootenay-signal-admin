import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import {
  gmailFindEmail,
  gmailReplyToEmail,
  gmailAddLabel,
  isConfigured,
} from "@/lib/zapier-mcp";

/*
 * POST /api/warmup/engage
 *
 * The recipient-side automation engine.
 * Uses Zapier MCP to control Gmail seed accounts:
 * 1. Finds warmup emails that arrived in seed Gmail
 * 2. Opens/reads them (marks as read)
 * 3. Replies to a natural % of them
 * 4. Adds labels / marks as important
 * 5. Updates warmup message status + job counters
 *
 * This creates the full closed loop:
 *   Resend sends → Gmail receives → Gmail replies → Resend gets reply signal
 */

const REPLY_TEMPLATES = [
  "Hey! Thanks for reaching out. I'd love to chat — what time works for you?",
  "Hi there! Great to hear from you. Let me check my schedule and get back to you.",
  "Thanks for the message! This sounds interesting. Let's connect this week.",
  "Appreciate you thinking of me! I'm definitely interested — let's discuss.",
  "Sounds great! I'm free later this week if you want to hop on a quick call.",
  "Thanks for following up! I've been meaning to reach out too. Let's sync soon.",
  "Hey, good to hear from you! I'll take a look and circle back shortly.",
  "This is exactly what I was thinking about. Thanks for sending — let's talk more!",
  "Sure thing! I have some ideas too. Coffee this week?",
  "Great timing! I was just working on something related. Let me know when you're free.",
  "Thanks! I'm on board. Let me review and I'll get back to you by tomorrow.",
  "Love this idea. Let's make it happen — when can we connect?",
  "Hey! Things are going well on my end. Thanks for checking in!",
  "Absolutely — happy to help. Fire away with any questions!",
  "Great update! Looking forward to seeing how this develops.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface EngageResult {
  emailsFound: number;
  emailsReplied: number;
  emailsLabeled: number;
  errors: string[];
  details: {
    warmupMessageId: string;
    action: string;
    success: boolean;
  }[];
}

export async function POST(request: NextRequest) {
  // Auth check
  const token = request.cookies.get("auth-token")?.value;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!token && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Zapier MCP not configured. Add ZAPIER_MCP_TOKEN to .env" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const replyRate = (body as Record<string, unknown>).replyRate ?? 0.4; // 40% default
  const maxToProcess = (body as Record<string, unknown>).maxToProcess ?? 20;

  const result: EngageResult = {
    emailsFound: 0,
    emailsReplied: 0,
    emailsLabeled: 0,
    errors: [],
    details: [],
  };

  // Find warmup messages that were sent but not yet engaged
  const { data: pendingMessages } = await supabase
    .from("WarmupMessage")
    .select("*, WarmupJob(*, WarmupProfile(*), EmailAccount(*))")
    .in("status", ["sent", "delivered"])
    .lt("sentAt", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order("sentAt", { ascending: true })
    .limit(maxToProcess as number);

  const msgList = (pendingMessages || []).map((m: Record<string, unknown>) => {
    const jobData = m.WarmupJob as Record<string, unknown>;
    const { WarmupProfile, EmailAccount, ...jobRest } = jobData;
    return {
      id: m.id as string,
      subject: m.subject as string,
      status: m.status as string,
      sentAt: m.sentAt as string,
      WarmupJob: undefined,
      job: { ...jobRest, profile: WarmupProfile, mailbox: EmailAccount },
      mailboxId: m.mailboxId as string,
      jobId: m.jobId as string,
    };
  });

  if (msgList.length === 0) {
    return NextResponse.json({
      message: "No pending warmup emails to engage with",
      ...result,
    });
  }

  result.emailsFound = msgList.length;

  for (const msg of msgList) {
    const senderEmail = (msg.job.mailbox as Record<string, unknown>).email as string;
    const senderDomain = senderEmail.split("@")[1];

    try {
      // Step 1: Find the email in Gmail
      const searchQuery = `from:(${senderDomain}) subject:(${msg.subject}) newer_than:3d`;
      const found = await gmailFindEmail(
        searchQuery,
        "message id, thread id, subject, from email, date"
      );

      if (!found || found.includes("No") || found.includes("no results") || found.includes("not found")) {
        // Email not found in Gmail yet — skip
        result.details.push({
          warmupMessageId: msg.id,
          action: "not_found_in_gmail",
          success: false,
        });
        continue;
      }

      // Try to extract thread ID from the response
      // Zapier returns structured text, look for common patterns
      const threadMatch = found.match(/thread[_ ]?id[:\s]*([a-zA-Z0-9]+)/i);
      const messageIdMatch = found.match(/message[_ ]?id[:\s]*([a-zA-Z0-9]+)/i)
        || found.match(/id[:\s]*([a-zA-Z0-9]{10,})/i);

      const gmailThreadId = threadMatch?.[1];
      const gmailMessageId = messageIdMatch?.[1];

      // Step 2: Mark as opened/delivered (the find already "opens" it)
      await supabase.from("WarmupMessage").update({ status: "opened" }).eq("id", msg.id);

      // Step 3: Try to add "Important" label
      if (gmailMessageId) {
        try {
          await gmailAddLabel(gmailMessageId, ["IMPORTANT"]);
          result.emailsLabeled++;
        } catch {
          // Label operation failed — not critical
        }
      }

      // Step 4: Decide whether to reply (based on reply rate)
      const shouldReply = Math.random() < (replyRate as number);

      if (shouldReply && gmailThreadId) {
        // Pick a natural reply
        const replyBody = pickRandom(REPLY_TEMPLATES);

        try {
          await gmailReplyToEmail({
            threadId: gmailThreadId,
            body: replyBody,
            to: [senderEmail],
          });

          // Mark as replied
          await supabase.from("WarmupMessage").update({ status: "replied" }).eq("id", msg.id);

          // Update job counters
          const { data: currentJob } = await supabase.from("WarmupJob").select("totalReplies").eq("id", msg.jobId).single();
          await supabase.from("WarmupJob").update({ totalReplies: (currentJob?.totalReplies || 0) + 1 }).eq("id", msg.jobId);

          result.emailsReplied++;
          result.details.push({
            warmupMessageId: msg.id,
            action: "replied",
            success: true,
          });
        } catch (err) {
          result.errors.push(`Reply failed for ${msg.id}: ${err instanceof Error ? err.message : "Unknown"}`);
          result.details.push({
            warmupMessageId: msg.id,
            action: "reply_failed",
            success: false,
          });
        }
      } else {
        result.details.push({
          warmupMessageId: msg.id,
          action: "opened_only",
          success: true,
        });
      }

      // Small delay between operations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    } catch (err) {
      result.errors.push(`Engage failed for ${msg.id}: ${err instanceof Error ? err.message : "Unknown"}`);
      result.details.push({
        warmupMessageId: msg.id,
        action: "error",
        success: false,
      });
    }
  }

  // Update trust scores for affected mailboxes
  const affectedMailboxIds = [...new Set(msgList.map(m => m.mailboxId))];
  for (const mailboxId of affectedMailboxIds) {
    const { count: totalMessages } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("mailboxId", mailboxId);
    const { count: totalReplied } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("mailboxId", mailboxId).eq("status", "replied");
    const { count: totalBounced } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("mailboxId", mailboxId).eq("status", "bounced");

    const msgCount = totalMessages || 0;
    const bounceRate = msgCount > 0 ? ((totalBounced || 0) / msgCount) * 100 : 0;
    const replyRateActual = msgCount > 0 ? ((totalReplied || 0) / msgCount) * 100 : 0;

    const trustScore = Math.min(100, Math.max(0,
      100 - (bounceRate * 5) + (replyRateActual * 2) - (msgCount < 10 ? 20 : 0)
    ));

    await supabase.from("EmailAccount").update({ trustScore }).eq("id", mailboxId);
  }

  return NextResponse.json({
    message: `Engagement cycle complete`,
    ...result,
    timestamp: new Date().toISOString(),
  });
}

// GET - Status check
export async function GET() {
  const configured = isConfigured();

  const { count: pending } = await supabase
    .from("WarmupMessage")
    .select("*", { count: "exact", head: true })
    .in("status", ["sent", "delivered"]);

  const { count: replied } = await supabase
    .from("WarmupMessage")
    .select("*", { count: "exact", head: true })
    .eq("status", "replied");

  const { count: opened } = await supabase
    .from("WarmupMessage")
    .select("*", { count: "exact", head: true })
    .eq("status", "opened");

  return NextResponse.json({
    zapierConfigured: configured,
    pendingEngagement: pending || 0,
    totalOpened: opened || 0,
    totalReplied: replied || 0,
  });
}
