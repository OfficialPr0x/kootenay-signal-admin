import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabase } from "@/lib/db";

// Resend delivery events webhook
// Events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained
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
  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const resendId = data.email_id;
  if (!resendId) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  // Map Resend event types to our status
  const statusMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "sent",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "bounced",
  };

  const newStatus = statusMap[type];

  // Check if this is a warmup message
  const { data: warmupMessage } = await supabase
    .from("WarmupMessage")
    .select("id, status, jobId")
    .eq("resendId", resendId)
    .limit(1)
    .single();

  if (warmupMessage && newStatus) {
    // Update warmup message status
    const warmupPriority = ["sent", "delivered", "opened", "replied", "bounced"];
    const currentIdx = warmupPriority.indexOf(warmupMessage.status);
    const newIdx = warmupPriority.indexOf(newStatus);

    if (newStatus === "bounced" || newIdx > currentIdx) {
      await supabase.from("WarmupMessage").update({ status: newStatus }).eq("id", warmupMessage.id);

      // Update warmup job counters
      if (newStatus === "bounced") {
        const { data: job } = await supabase.from("WarmupJob").select("totalBounces").eq("id", warmupMessage.jobId).single();
        await supabase.from("WarmupJob").update({ totalBounces: (job?.totalBounces || 0) + 1 }).eq("id", warmupMessage.jobId);
      } else if (newStatus === "replied") {
        const { data: job } = await supabase.from("WarmupJob").select("totalReplies").eq("id", warmupMessage.jobId).single();
        await supabase.from("WarmupJob").update({ totalReplies: (job?.totalReplies || 0) + 1 }).eq("id", warmupMessage.jobId);
      }
    }

    return NextResponse.json({ success: true, warmup: true });
  }

  // Find the regular message by resendId
  const { data: message } = await supabase
    .from("EmailMessage")
    .select("id, status")
    .eq("resendId", resendId)
    .limit(1)
    .single();

  if (!message) {
    // Event for an email we don't track - still accept the webhook
    return NextResponse.json({ success: true, skipped: true });
  }

  // Create event record
  await supabase.from("EmailEvent").insert({
    messageId: message.id,
    type: type.replace("email.", ""),
    metadata: JSON.stringify(data),
  });

  // Update message status (only upgrade, never downgrade)
  const statusPriority = ["failed", "sent", "delivered", "opened", "clicked", "bounced"];
  if (newStatus) {
    const currentPriority = statusPriority.indexOf(message.status);
    const newPriority = statusPriority.indexOf(newStatus);

    // Bounced always overrides; otherwise only upgrade
    if (newStatus === "bounced" || newPriority > currentPriority) {
      await supabase.from("EmailMessage").update({ status: newStatus }).eq("id", message.id);
    }
  }

  return NextResponse.json({ success: true });
}
