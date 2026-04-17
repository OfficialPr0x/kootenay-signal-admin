import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Default warmup email content variants if profile has none configured
const DEFAULT_CONTENT_VARIANTS = [
  {
    subject: "Quick question about your availability",
    body: "<p>Hi there,</p><p>I wanted to reach out and see if you had a few minutes to chat this week about a potential collaboration.</p><p>Let me know what works for you.</p><p>Best regards</p>",
  },
  {
    subject: "Following up on our conversation",
    body: "<p>Hey,</p><p>Just wanted to follow up on what we discussed. I think there's a real opportunity here and would love to explore it further.</p><p>When would be a good time to reconnect?</p><p>Cheers</p>",
  },
  {
    subject: "Thought you might find this interesting",
    body: "<p>Hi,</p><p>I came across something that reminded me of our last chat and thought you'd appreciate it.</p><p>Would love to hear your thoughts when you get a chance.</p><p>Talk soon</p>",
  },
  {
    subject: "Checking in",
    body: "<p>Hey,</p><p>Hope you're doing well! Just checking in to see how things are going on your end.</p><p>Let me know if there's anything I can help with.</p><p>Best</p>",
  },
  {
    subject: "Re: Project update",
    body: "<p>Hi,</p><p>Wanted to give you a quick update on where things stand. We've made some good progress and I'd love to sync up about next steps.</p><p>Let me know your availability this week.</p><p>Thanks</p>",
  },
  {
    subject: "Quick favor to ask",
    body: "<p>Hey,</p><p>I have a quick question that I think you'd be the best person to answer. Do you have a minute to chat?</p><p>No rush at all — whenever you're free.</p><p>Appreciate it</p>",
  },
  {
    subject: "Great meeting you",
    body: "<p>Hi,</p><p>It was great connecting with you recently. I'm looking forward to working together on this.</p><p>Let me know if you need anything from my end.</p><p>Best regards</p>",
  },
  {
    subject: "Ideas for next quarter",
    body: "<p>Hey,</p><p>I've been thinking about some ideas for next quarter and wanted to run them by you before we formalize anything.</p><p>Would love to get your perspective. Coffee this week?</p><p>Cheers</p>",
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// POST /api/warmup/execute - Run one warmup cycle for all active jobs
// Can be called by cron, or manually via "Run Now" button
export async function POST(request: NextRequest) {
  // Simple auth: check for cron secret or valid session
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = request.cookies.get("auth-token")?.value;

  // Allow if: has valid session cookie (UI call), or has correct cron secret
  if (!token && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromEmail = process.env.FROM_EMAIL || "Kootenay Signal <onboarding@resend.dev>";

  // Find all active warmup jobs
  const { data: activeJobs } = await supabase
    .from("WarmupJob")
    .select("*, EmailAccount(*), WarmupProfile(*)")
    .eq("status", "active");

  if (!activeJobs || activeJobs.length === 0) {
    return NextResponse.json({ message: "No active warmup jobs", sent: 0 });
  }

  const results: {
    jobId: string;
    mailbox: string;
    emailsSent: number;
    errors: string[];
    newVolume: number;
  }[] = [];

  for (const job of activeJobs) {
    const mailbox = job.EmailAccount as Record<string, unknown>;
    const profile = job.WarmupProfile as Record<string, unknown>;

    // Skip if mailbox is paused
    if (mailbox.warmupStatus === "paused") continue;

    const jobResult = { jobId: job.id, mailbox: mailbox.email as string, emailsSent: 0, errors: [] as string[], newVolume: job.currentVolume };

    // Parse content variants from profile, or use defaults
    let contentVariants = DEFAULT_CONTENT_VARIANTS;
    if (profile.contentVariants) {
      try {
        const parsed = JSON.parse(profile.contentVariants as string);
        if (Array.isArray(parsed) && parsed.length > 0) contentVariants = parsed;
      } catch { /* use defaults */ }
    }

    // Parse seed addresses from profile
    let seedAddresses: string[] = [];
    if (profile.seedAddresses) {
      seedAddresses = (profile.seedAddresses as string)
        .split(",")
        .map((e: string) => e.trim())
        .filter((e: string) => e.includes("@"));
    }

    // If no seed addresses, we can't send warmup emails
    if (seedAddresses.length === 0) {
      jobResult.errors.push("No seed addresses configured on profile");
      results.push(jobResult);
      continue;
    }

    // Determine how many emails to send this cycle
    const emailsToSend = Math.min(job.currentVolume, mailbox.dailySendLimit as number);

    // Check against daily send limit — count today's sends
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todaySent } = await supabase
      .from("WarmupMessage")
      .select("*", { count: "exact", head: true })
      .eq("mailboxId", job.mailboxId)
      .gte("sentAt", todayStart.toISOString());

    const remaining = Math.max(0, emailsToSend - (todaySent || 0));
    if (remaining === 0) {
      jobResult.errors.push("Daily limit already reached");
      results.push(jobResult);
      continue;
    }

    // Send warmup emails
    for (let i = 0; i < remaining; i++) {
      const content = pickRandom(contentVariants);
      const toEmail = seedAddresses[i % seedAddresses.length];

      // Add some variation to subject to avoid spam filters
      const subjectVariation = `${content.subject}${Math.random() > 0.5 ? "" : " "}`;

      try {
        const { data, error } = await resend.emails.send({
          from: `${mailbox.name} <${mailbox.email}>`,
          to: [toEmail],
          subject: subjectVariation,
          html: content.body,
          text: stripHtml(content.body),
          headers: {
            "X-Entity-Ref-ID": `warmup-${job.id}-${Date.now()}-${i}`,
          },
          tags: [
            { name: "type", value: "warmup" },
            { name: "job_id", value: job.id },
          ],
        });

        if (error) {
          jobResult.errors.push(`Send failed to ${toEmail}: ${error.message}`);
          continue;
        }

        // Create WarmupMessage record
        await supabase.from("WarmupMessage").insert({
          jobId: job.id,
          mailboxId: job.mailboxId,
          toEmail,
          subject: content.subject,
          status: "sent",
          resendId: data?.id || null,
        });

        jobResult.emailsSent++;
      } catch (err) {
        jobResult.errors.push(`Send error to ${toEmail}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }

      // Small delay between sends to look more natural
      if (i < remaining - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
      }
    }

    // Update job counters
    const newTotalSent = job.totalSent + jobResult.emailsSent;

    // Ramp up volume for next cycle (capped at maxVolume)
    const newVolume = Math.min(
      job.currentVolume + (profile.rampIncrement as number),
      profile.maxVolume as number
    );
    jobResult.newVolume = newVolume;

    // Check if warmup is complete (at max volume and sufficient sends)
    const isComplete = newVolume >= (profile.maxVolume as number) && newTotalSent >= (profile.maxVolume as number) * 7;

    // Evaluate health — check bounce rate
    const { count: totalMessages } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("jobId", job.id);
    const { count: totalBounced } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("jobId", job.id).eq("status", "bounced");
    const { count: totalReplied } = await supabase.from("WarmupMessage").select("*", { count: "exact", head: true }).eq("jobId", job.id).eq("status", "replied");
    const msgCount = totalMessages || 0;
    const bouncedCount = totalBounced || 0;
    const repliedCount = totalReplied || 0;
    const bounceRate = msgCount > 0 ? (bouncedCount / msgCount) * 100 : 0;

    // Parse ramp conditions
    let maxBounceRate = 8;
    if (profile.rampCondition) {
      try {
        const cond = JSON.parse(profile.rampCondition as string);
        if (cond.maxBounceRate) maxBounceRate = cond.maxBounceRate;
      } catch { /* use default */ }
    }

    // Determine new warmup status
    let newWarmupStatus = mailbox.warmupStatus as string;
    if (bounceRate > maxBounceRate) {
      newWarmupStatus = "at_risk";
    } else if (isComplete) {
      newWarmupStatus = "stable";
    } else {
      newWarmupStatus = "warming";
    }

    // Calculate trust score
    const replyRate = msgCount > 0 ? (repliedCount / msgCount) * 100 : 0;
    const trustScore = Math.min(100, Math.max(0,
      100 - (bounceRate * 5) + (replyRate * 2) - (msgCount < 10 ? 20 : 0)
    ));

    await supabase.from("WarmupJob").update({
      totalSent: newTotalSent,
      totalBounces: bouncedCount,
      totalReplies: repliedCount,
      currentVolume: newVolume,
      lastRunAt: new Date().toISOString(),
      status: isComplete ? "completed" : bounceRate > maxBounceRate * 2 ? "paused" : "active",
    }).eq("id", job.id);

    await supabase.from("EmailAccount").update({
      warmupStatus: newWarmupStatus,
      currentVolume: newVolume,
      trustScore,
    }).eq("id", job.mailboxId);

    // Create health snapshot
    await supabase.from("MailboxHealthSnapshot").insert({
      mailboxId: job.mailboxId,
      trustScore,
      bounceRate,
      replyRate,
      openRate: 0,
      dailyVolume: jobResult.emailsSent,
    });

    results.push(jobResult);
  }

  const totalSent = results.reduce((sum, r) => sum + r.emailsSent, 0);

  return NextResponse.json({
    message: `Warmup cycle complete`,
    jobsProcessed: results.length,
    totalSent,
    results,
    timestamp: new Date().toISOString(),
  });
}

// GET /api/warmup/execute - Check last run status
export async function GET() {
  const { data: lastRun } = await supabase
    .from("WarmupJob")
    .select("lastRunAt, totalSent, status")
    .not("lastRunAt", "is", null)
    .order("lastRunAt", { ascending: false })
    .limit(1)
    .single();

  const { count: activeJobs } = await supabase
    .from("WarmupJob")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todaySent } = await supabase
    .from("WarmupMessage")
    .select("*", { count: "exact", head: true })
    .gte("sentAt", todayStart.toISOString());

  return NextResponse.json({
    lastRunAt: lastRun?.lastRunAt || null,
    activeJobs: activeJobs || 0,
    todaySent: todaySent || 0,
  });
}
