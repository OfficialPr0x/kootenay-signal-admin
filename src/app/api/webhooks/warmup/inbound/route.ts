import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

/*
 * POST /api/webhooks/warmup/inbound
 *
 * Zapier calls this when a warmup email arrives at a seed Gmail account.
 * 
 * Zapier flow:
 *   1. Gmail trigger: "New email matching search" (from:@yourdomain.com subject:warmup keywords)
 *   2. Zapier sends POST to this endpoint with email details
 *   3. We match it to a WarmupMessage, mark as opened/delivered
 *   4. We return a generated reply for Zapier to send back via Gmail
 *   5. Zapier uses "Send Email" action in Gmail with our reply content
 *
 * Expected payload from Zapier:
 * {
 *   "from": "jaryd@mail.kootenaysignal.com",     // sender (our warmup mailbox)
 *   "to": "seedaccount@gmail.com",                // recipient (the seed Gmail)
 *   "subject": "Quick question about your availability",
 *   "messageId": "<resend-message-id>",           // optional: Resend message ID from headers
 *   "receivedAt": "2026-04-16T10:30:00Z",         // optional
 *   "action": "received" | "opened" | "reply_request"  // what happened
 * }
 *
 * Response includes a generated reply if action is "reply_request"
 */

// Natural reply templates — these look like genuine human responses
const REPLY_TEMPLATES = [
  {
    pattern: /availability|chat|connect/i,
    replies: [
      "Hey! Thanks for reaching out. I'm pretty open this week — how about Thursday afternoon?",
      "Hi there! Yes, I'd love to chat. What time works best for you?",
      "Sure thing! I'm free Wednesday or Friday. Just let me know.",
      "Thanks for the message! I could do a quick call tomorrow if that works?",
    ],
  },
  {
    pattern: /follow.?up|conversation|discussed/i,
    replies: [
      "Thanks for following up! I've been thinking about this too. Let's definitely keep the conversation going.",
      "Great to hear from you again! I agree there's a lot of potential here.",
      "Hey! Yes, I was just about to reach out. Would love to reconnect this week.",
      "Thanks for the nudge! Let me take another look and get back to you by end of day.",
    ],
  },
  {
    pattern: /interesting|thought|remind/i,
    replies: [
      "Thanks for sharing! This is really interesting. I'd love to discuss more.",
      "Appreciate you thinking of me! This is right up my alley.",
      "Oh cool, thanks for sending this over! Definitely want to dig into this.",
      "This is great — exactly what I was looking for. Thanks!",
    ],
  },
  {
    pattern: /check.?in|how.?are|going/i,
    replies: [
      "Hey! Things are going great on my end. Thanks for checking in!",
      "Doing well, thanks! How about yourself? Anything exciting happening?",
      "All good here! Just been heads down on a few projects. Hope you're well too!",
      "Thanks for thinking of me! Everything's moving along nicely.",
    ],
  },
  {
    pattern: /project|update|progress|next.?steps/i,
    replies: [
      "Good to hear there's been progress! Looking forward to syncing up about next steps.",
      "Thanks for the update! That sounds promising. Let me know when you're free to discuss.",
      "Great update! I have a few thoughts to share too. Let's connect soon.",
      "Awesome, sounds like things are on track. Happy to hop on a call when you're ready.",
    ],
  },
  {
    pattern: /favor|question|help/i,
    replies: [
      "Of course! Happy to help. What's the question?",
      "Sure, fire away! Always happy to lend a hand.",
      "Absolutely — ask away! I'll do my best to help out.",
      "No problem at all! What do you need?",
    ],
  },
  {
    pattern: /meeting|great.?to|nice.?to/i,
    replies: [
      "Likewise! Really enjoyed our conversation. Looking forward to what's next.",
      "Great meeting you too! Let's definitely stay in touch.",
      "The feeling is mutual! Excited about the possibilities here.",
      "Same here! Thanks for making the time. Let me know if you need anything.",
    ],
  },
  {
    pattern: /ideas|quarter|plan/i,
    replies: [
      "Love that you're thinking ahead! I have a few ideas too — let's compare notes.",
      "Sounds great! Coffee works for me. How about Wednesday at 10?",
      "I'm definitely interested! Send over what you have and I'll take a look.",
      "Yes! I've been brainstorming as well. Let's put our heads together.",
    ],
  },
];

const GENERIC_REPLIES = [
  "Thanks for reaching out! I'd love to continue this conversation. When works for you?",
  "Great to hear from you! Let me look into this and get back to you soon.",
  "Appreciate the message! This sounds interesting — let's connect this week.",
  "Thanks! I'll review and circle back shortly. Have a great day!",
  "Hey, thanks for this! Really appreciate you thinking of me. Let's chat soon.",
  "Sounds good to me! Looking forward to discussing further.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReply(subject: string): { replySubject: string; replyBody: string } {
  // Try to match subject to a specific template
  for (const template of REPLY_TEMPLATES) {
    if (template.pattern.test(subject)) {
      return {
        replySubject: `Re: ${subject}`,
        replyBody: pickRandom(template.replies),
      };
    }
  }

  // Fallback to generic
  return {
    replySubject: `Re: ${subject}`,
    replyBody: pickRandom(GENERIC_REPLIES),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from, to, subject, messageId, action } = body;

  if (!from || !to || !subject) {
    return NextResponse.json(
      { error: "Missing required fields: from, to, subject" },
      { status: 400 }
    );
  }

  const actionType = action || "received";

  // Try to match to a WarmupMessage
  // First try by resendId if provided
  let warmupMessage: Record<string, unknown> | null = null;
  if (messageId) {
    const { data } = await supabase
      .from("WarmupMessage")
      .select("*, WarmupJob(*)")
      .eq("resendId", messageId)
      .limit(1)
      .single();
    if (data) {
      const { WarmupJob, ...rest } = data;
      warmupMessage = { ...rest, job: WarmupJob };
    }
  }

  // Fall back to matching by subject + toEmail + fromEmail (sender = our mailbox)
  if (!warmupMessage) {
    const cleanSubject = subject.replace(/^Re:\s*/i, "").trim();
    const { data } = await supabase
      .from("WarmupMessage")
      .select("*, WarmupJob(*)")
      .eq("toEmail", to)
      .ilike("subject", `%${cleanSubject}%`)
      .in("status", ["sent", "delivered"])
      .order("sentAt", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      const { WarmupJob, ...rest } = data;
      warmupMessage = { ...rest, job: WarmupJob };
    }
  }

  if (!warmupMessage) {
    return NextResponse.json({
      matched: false,
      message: "No matching warmup message found — email may not be from warmup system",
      reply: null,
    });
  }

  // Update the warmup message status based on action
  if (actionType === "received" || actionType === "opened") {
    // Mark as delivered/opened
    const newStatus = warmupMessage.status === "sent" ? "delivered" : "opened";
    await supabase.from("WarmupMessage").update({ status: newStatus }).eq("id", warmupMessage.id);
  }

  // Generate a reply if requested
  let reply = null;
  if (actionType === "reply_request") {
    reply = generateReply(subject);

    // Mark the warmup message as replied
    await supabase.from("WarmupMessage").update({ status: "replied" }).eq("id", warmupMessage.id);

    // Increment reply count on the job
    const { data: currentJob } = await supabase.from("WarmupJob").select("totalReplies").eq("id", warmupMessage.jobId).single();
    await supabase.from("WarmupJob").update({ totalReplies: (currentJob?.totalReplies || 0) + 1 }).eq("id", warmupMessage.jobId);
  }

  // Return deliverability boost instructions for Zapier
  const boostActions = [
    "move_to_inbox",      // If in spam, move to primary inbox
    "mark_important",     // Star/mark as important
    "add_to_contacts",    // Add sender to contacts
  ];

  // Determine reply probability — not every email should get a reply (looks unnatural)
  // Aim for ~30-50% reply rate
  const shouldReply = actionType === "reply_request" || Math.random() < 0.4;

  return NextResponse.json({
    matched: true,
    warmupMessageId: warmupMessage.id,
    jobId: warmupMessage.jobId,
    status: warmupMessage.status,
    // Actions Zapier should perform on the Gmail side
    boostActions,
    // Reply content (if applicable)
    shouldReply,
    reply: shouldReply ? (reply || generateReply(subject)) : null,
    // Timing suggestion — stagger replies to look natural
    replyDelayMinutes: Math.floor(Math.random() * 45) + 5, // 5-50 min delay
  });
}

// GET /api/webhooks/warmup/inbound — Health check / info for Zapier setup
export async function GET() {
  return NextResponse.json({
    status: "active",
    description: "Warmup inbound webhook for Zapier integration",
    usage: {
      method: "POST",
      contentType: "application/json",
      requiredFields: ["from", "to", "subject"],
      optionalFields: ["messageId", "receivedAt", "action"],
      actions: ["received", "opened", "reply_request"],
    },
    zapierSetup: {
      step1: "Create a Zap with trigger: Gmail → New Email Matching Search",
      step2: "Search query: from:(@yourdomain.com) newer_than:1d",
      step3: "Add action: Webhooks by Zapier → POST to this URL",
      step4: "Map fields: from={{From Email}}, to={{To Email}}, subject={{Subject}}, action=reply_request",
      step5: "Add filter: Only continue if shouldReply is true",
      step6: "Add action: Gmail → Send Email using reply.replySubject and reply.replyBody",
      step7: "Add delay: Use replyDelayMinutes for natural timing",
    },
  });
}
