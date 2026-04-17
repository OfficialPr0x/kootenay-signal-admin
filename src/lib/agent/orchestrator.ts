/**
 * Agent Orchestrator
 *
 * Core engine that:
 * 1. Receives natural language commands
 * 2. Plans tool sequences via rule-based matching (upgradeable to LLM)
 * 3. Checks approval requirements
 * 4. Executes tools sequentially
 * 5. Returns structured results
 */

import { supabase } from "@/lib/db";
import { ALL_TOOLS, getToolByName, type ToolDefinition } from "./tools";
import { executeTool, type ToolResult } from "./executor";

// ── Types ──

export type PlanStep = {
  toolName: string;
  input: Record<string, unknown>;
  description: string;
};

export type AgentPlan = {
  intentType: string;
  steps: PlanStep[];
  requiresApproval: boolean;
  approvalSummary?: string;
};

export type RunStatus = "planning" | "needs_approval" | "running" | "completed" | "failed" | "cancelled";

// ── Planner ──

export function planCommand(command: string): AgentPlan {
  const lower = command.toLowerCase().trim();

  // ── Dashboard / Analytics queries ──
  if (matches(lower, ["dashboard", "overview", "stats", "how are we doing", "summary", "status"])) {
    return {
      intentType: "analytics",
      steps: [{ toolName: "get_dashboard_stats", input: {}, description: "Fetching dashboard overview" }],
      requiresApproval: false,
    };
  }

  // ── Find contacts ──
  if (matches(lower, ["find contact", "search contact", "look up contact", "who is"])) {
    const query = extractAfter(lower, ["find contact", "search contact", "look up contact", "who is", "find", "search"]);
    return {
      intentType: "contact_search",
      steps: [{ toolName: "find_contacts", input: { query: query || command }, description: `Searching contacts: ${query}` }],
      requiresApproval: false,
    };
  }

  // ── Prospect list ──
  if (matches(lower, ["prospect", "prospect list", "prospects", "new leads ready"])) {
    return {
      intentType: "contact_search",
      steps: [{ toolName: "list_prospect_list", input: { limit: 50 }, description: "Listing current prospect list" }],
      requiresApproval: false,
    };
  }

  // ── Contact details ──
  if (matches(lower, ["get contact", "contact details", "show contact"])) {
    const query = extractAfter(lower, ["get contact", "contact details", "show contact"]);
    const isEmail = query.includes("@");
    return {
      intentType: "contact_detail",
      steps: [{
        toolName: "get_contact",
        input: isEmail ? { email: query } : { id: query },
        description: `Getting contact details: ${query}`,
      }],
      requiresApproval: false,
    };
  }

  // ── Tag contacts ──
  if (matches(lower, ["tag contact", "add tag", "remove tag", "untag"])) {
    const parts = parseTagCommand(command);
    return {
      intentType: "contact_update",
      steps: [{
        toolName: "update_contact_tags",
        input: parts,
        description: `Updating tags on contact`,
      }],
      requiresApproval: false,
    };
  }

  // ── Mailboxes ──
  if (matches(lower, ["list mailbox", "show mailbox", "mailboxes", "email accounts", "warmup status"])) {
    return {
      intentType: "warmup_status",
      steps: [{ toolName: "list_mailboxes", input: {}, description: "Listing all mailboxes with warmup status" }],
      requiresApproval: false,
    };
  }

  // ── Mailbox health ──
  if (matches(lower, ["mailbox health", "trust score", "health check"])) {
    const id = extractId(command);
    if (id) {
      return {
        intentType: "warmup_detail",
        steps: [{ toolName: "get_mailbox_health", input: { mailboxId: id }, description: `Getting mailbox health: ${id}` }],
        requiresApproval: false,
      };
    }
    return {
      intentType: "warmup_status",
      steps: [{ toolName: "list_mailboxes", input: {}, description: "Listing all mailboxes" }],
      requiresApproval: false,
    };
  }

  // ── Pause warmup ──
  if (matches(lower, ["pause warmup", "stop warmup"])) {
    const id = extractId(command);
    return {
      intentType: "warmup_control",
      steps: [{ toolName: "pause_warmup", input: { mailboxId: id || "unknown" }, description: "Pausing warmup" }],
      requiresApproval: true,
      approvalSummary: `Pause warmup for mailbox ${id || "(specify mailbox)"}`,
    };
  }

  // ── Resume warmup ──
  if (matches(lower, ["resume warmup", "start warmup", "unpause warmup"])) {
    const id = extractId(command);
    return {
      intentType: "warmup_control",
      steps: [{ toolName: "resume_warmup", input: { mailboxId: id || "unknown" }, description: "Resuming warmup" }],
      requiresApproval: false,
    };
  }

  // ── Domain health ──
  if (matches(lower, ["domain health", "domain status", "dns", "deliverability"])) {
    const domain = extractDomain(command);
    return {
      intentType: "deliverability",
      steps: [{ toolName: "get_domain_health", input: { domain: domain || "kootenaysignal.com" }, description: `Checking domain health: ${domain}` }],
      requiresApproval: false,
    };
  }

  // ── Compose email ──
  if (matches(lower, ["compose", "draft email", "write email", "create email draft"])) {
    const parsed = parseEmailCommand(command);
    return {
      intentType: "email_compose",
      steps: [{ toolName: "compose_email_draft", input: parsed, description: "Composing email draft" }],
      requiresApproval: false,
    };
  }

  // ── Send email ──
  if (matches(lower, ["send email to", "email to", "send to"])) {
    const parsed = parseEmailCommand(command);
    return {
      intentType: "email_send",
      steps: [{ toolName: "send_single_email", input: parsed, description: `Sending email to ${parsed.to}` }],
      requiresApproval: true,
      approvalSummary: `Send email to ${parsed.to}: "${parsed.subject}"`,
    };
  }

  // ── Search inbox ──
  if (matches(lower, ["inbox", "search inbox", "search emails", "recent emails", "check inbox", "show emails"])) {
    const query = extractAfter(lower, ["inbox", "search inbox", "search emails", "recent emails", "check inbox", "show emails"]);
    return {
      intentType: "inbox_search",
      steps: [{
        toolName: "search_inbox_threads",
        input: { query: query || undefined, limit: 20 },
        description: query ? `Searching inbox: ${query}` : "Showing recent inbox",
      }],
      requiresApproval: false,
    };
  }

  // ── Campaign metrics ──
  if (matches(lower, ["campaign metrics", "campaign stats", "campaign performance", "how is campaign"])) {
    const id = extractId(command);
    if (id) {
      return {
        intentType: "analytics",
        steps: [{ toolName: "get_campaign_metrics", input: { campaignId: id }, description: `Getting campaign metrics: ${id}` }],
        requiresApproval: false,
      };
    }
    return {
      intentType: "analytics",
      steps: [{ toolName: "get_dashboard_stats", input: {}, description: "Getting overall stats (no campaign specified)" }],
      requiresApproval: false,
    };
  }

  // ── Pause campaign ──
  if (matches(lower, ["pause campaign", "stop campaign"])) {
    const id = extractId(command);
    return {
      intentType: "campaign_control",
      steps: [{ toolName: "pause_campaign", input: { campaignId: id || "unknown" }, description: `Pausing campaign ${id}` }],
      requiresApproval: true,
      approvalSummary: `Pause campaign ${id || "(specify campaign)"}`,
    };
  }

  // ── Resume campaign ──
  if (matches(lower, ["resume campaign", "restart campaign", "unpause campaign"])) {
    const id = extractId(command);
    return {
      intentType: "campaign_control",
      steps: [{ toolName: "resume_campaign", input: { campaignId: id || "unknown" }, description: `Resuming campaign ${id}` }],
      requiresApproval: true,
      approvalSummary: `Resume campaign ${id || "(specify campaign)"}`,
    };
  }

  // ── Find client ──
  if (matches(lower, ["find client", "search client", "look up client", "client named"])) {
    const query = extractAfter(lower, ["find client", "search client", "look up client", "client named"]);
    return {
      intentType: "client_search",
      steps: [{ toolName: "find_client", input: { query: query || command }, description: `Finding client: ${query}` }],
      requiresApproval: false,
    };
  }

  // ── Create invoice ──
  if (matches(lower, ["create invoice", "invoice for", "bill client", "new invoice"])) {
    const query = extractAfter(lower, ["create invoice for", "invoice for", "bill client", "new invoice for"]);
    return {
      intentType: "invoice_create",
      steps: [
        { toolName: "find_client", input: { query: query || command }, description: `Finding client: ${query}` },
        { toolName: "create_invoice_draft", input: { clientId: "__FROM_STEP_0__" }, description: "Creating invoice draft" },
      ],
      requiresApproval: false,
    };
  }

  // ── Send invoice ──
  if (matches(lower, ["send invoice"])) {
    const id = extractId(command);
    return {
      intentType: "invoice_send",
      steps: [{ toolName: "send_invoice", input: { invoiceId: id || "unknown" }, description: `Sending invoice ${id}` }],
      requiresApproval: true,
      approvalSummary: `Send invoice ${id} to client via email`,
    };
  }

  // ── Unpaid invoices ──
  if (matches(lower, ["unpaid invoice", "outstanding invoice", "pending invoice", "overdue invoice"])) {
    return {
      intentType: "invoice_search",
      steps: [{ toolName: "list_unpaid_invoices", input: {}, description: "Listing unpaid invoices" }],
      requiresApproval: false,
    };
  }

  // ── Fallback — try keyword-based tool match ──
  const bestMatch = findBestToolMatch(lower);
  if (bestMatch) {
    return {
      intentType: "auto_match",
      steps: [{ toolName: bestMatch.name, input: { query: command }, description: `Running ${bestMatch.name}` }],
      requiresApproval: bestMatch.requiresApproval,
      approvalSummary: bestMatch.requiresApproval ? `Execute ${bestMatch.name}` : undefined,
    };
  }

  // ── No match ──
  return {
    intentType: "unknown",
    steps: [],
    requiresApproval: false,
  };
}

// ── Execution Engine ──

export async function executeRun(runId: string): Promise<void> {
  const { data: run } = await supabase.from("AgentRun").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");
  if (!run.planJson) throw new Error("No plan found");

  const plan = JSON.parse(run.planJson) as AgentPlan;
  const results: ToolResult[] = [];
  let lastResult: ToolResult | null = null;

  await supabase.from("AgentRun").update({ status: "running" }).eq("id", runId);

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    let input = { ...step.input };

    // Resolve cross-step references (e.g. __FROM_STEP_0__)
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "string" && value.startsWith("__FROM_STEP_")) {
        const stepIdx = parseInt(value.replace("__FROM_STEP_", "").replace("__", ""), 10);
        const prevResult = results[stepIdx];
        if (prevResult?.success && prevResult.data) {
          // Extract first ID-like value from previous result
          const data = prevResult.data as Record<string, unknown>;
          if (data.clients && Array.isArray(data.clients) && data.clients.length > 0) {
            input[key] = (data.clients[0] as Record<string, string>).id;
          } else if (data.id) {
            input[key] = data.id;
          }
        }
      }
    }

    // Create tool call record
    const { data: toolCall } = await supabase.from("AgentToolCall").insert({
      runId,
      toolName: step.toolName,
      toolInputJson: JSON.stringify(input),
      status: "running",
      startedAt: new Date().toISOString(),
    }).select().single();

    try {
      const result = await executeTool(step.toolName, input);
      lastResult = result;
      results.push(result);

      await supabase.from("AgentToolCall").update({
        status: result.success ? "completed" : "failed",
        toolOutputJson: JSON.stringify(result),
        finishedAt: new Date().toISOString(),
      }).eq("id", toolCall!.id);

      if (!result.success) {
        await supabase.from("AgentRun").update({
          status: "failed",
          errorJson: JSON.stringify({ step: i, toolName: step.toolName, error: result.error }),
          completedAt: new Date().toISOString(),
        }).eq("id", runId);
        return;
      }
    } catch (err) {
      await supabase.from("AgentToolCall").update({
        status: "failed",
        toolOutputJson: JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        finishedAt: new Date().toISOString(),
      }).eq("id", toolCall!.id);

      await supabase.from("AgentRun").update({
        status: "failed",
        errorJson: JSON.stringify({ step: i, error: err instanceof Error ? err.message : "Unknown" }),
        completedAt: new Date().toISOString(),
      }).eq("id", runId);
      return;
    }
  }

  // Summarize results
  const summary = buildSummary(plan, results, lastResult);

  await supabase.from("AgentRun").update({
    status: "completed",
    resultSummary: summary,
    completedAt: new Date().toISOString(),
  }).eq("id", runId);
}

// ── Helpers ──

function matches(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p));
}

function extractAfter(text: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    const idx = text.indexOf(prefix);
    if (idx !== -1) {
      return text.slice(idx + prefix.length).trim().replace(/^["']|["']$/g, "");
    }
  }
  return text;
}

function extractId(text: string): string | null {
  // Match CUID-like IDs or UUIDs
  const cuid = text.match(/[a-z0-9]{20,30}/);
  if (cuid) return cuid[0];
  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  return null;
}

function extractDomain(text: string): string {
  const domain = text.match(/[a-z0-9-]+\.[a-z]{2,}/i);
  return domain ? domain[0] : "";
}

function parseEmailCommand(text: string): Record<string, unknown> {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const subjectMatch = text.match(/subject[:\s]+["']?([^"'\n]+)["']?/i);
  const bodyMatch = text.match(/body[:\s]+["']?([^"'\n]+)["']?/i) || text.match(/saying[:\s]+["']?([^"'\n]+)["']?/i);
  
  let body = bodyMatch ? bodyMatch[1].trim() : "";
  let subject = subjectMatch ? subjectMatch[1].trim() : "";

  // If no explicit body, extract the intent and compose a real email from it
  if (!body && emailMatch) {
    const afterEmail = text.slice(text.indexOf(emailMatch[0]) + emailMatch[0].length).trim();
    const cleaned = afterEmail.replace(/^(and|to|about|regarding|with|,)\s+/i, "").trim();
    if (cleaned.length > 0) {
      const composed = composeEmailFromIntent(cleaned);
      body = composed.body;
      if (!subject) subject = composed.subject;
    }
  }

  if (!body) {
    body = "<p>Hi there,</p><p>I wanted to reach out and connect with you. Kootenay Signal is an AI-powered design and development agency that helps businesses scale through intelligent automation, modern web platforms, and strategic digital solutions.</p><p>Would love to explore how we can help you grow.</p><p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>";
  }
  if (!subject) subject = "Let's Connect — Kootenay Signal";

  return { to: emailMatch ? emailMatch[0] : "", subject, body };
}

/**
 * Takes a raw intent like "push them into wanting to hire Kootenay Signal"
 * and composes a professional email body + subject from it.
 */
function composeEmailFromIntent(intent: string): { subject: string; body: string } {
  const lower = intent.toLowerCase();

  // Detect common intents and generate appropriate professional emails
  if (lower.includes("hire") || lower.includes("work with") || lower.includes("services")) {
    return {
      subject: "Scale Your Business with Kootenay Signal",
      body: `<p>Hi there,</p>
<p>I hope this finds you well. I'm reaching out from <strong>Kootenay Signal</strong> — we're an AI-powered design and development agency specializing in helping businesses scale through intelligent automation and modern digital solutions.</p>
<p>Here's what sets us apart:</p>
<ul>
<li><strong>AI-Driven Development</strong> — We build smart platforms that automate workflows, reduce overhead, and accelerate growth</li>
<li><strong>Full-Stack Expertise</strong> — From sleek frontends to robust backends, we handle the entire stack</li>
<li><strong>Revenue-Focused Design</strong> — Every pixel and feature is built to convert and retain</li>
<li><strong>Rapid Delivery</strong> — We move fast without sacrificing quality</li>
</ul>
<p>Whether you need a complete platform build, AI integration, or a strategic digital overhaul — we'd love to show you what's possible.</p>
<p>Would you be open to a quick 15-minute call this week?</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Founder, Kootenay Signal<br/>jaryd@kootenaysignal.com</p>`,
    };
  }

  if (lower.includes("follow up") || lower.includes("checking in") || lower.includes("touch base")) {
    return {
      subject: "Following Up — Kootenay Signal",
      body: `<p>Hi there,</p>
<p>Just wanted to follow up on our previous conversation. I know things get busy, so I wanted to make sure this didn't slip through the cracks.</p>
<p>We're still excited about the possibility of working together and would love to pick up where we left off.</p>
<p>Let me know if you have any questions or would like to schedule a call.</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>`,
    };
  }

  if (lower.includes("intro") || lower.includes("introduce") || lower.includes("meet") || lower.includes("connect")) {
    return {
      subject: "Nice to Meet You — Kootenay Signal",
      body: `<p>Hi there,</p>
<p>I'm Jaryd from <strong>Kootenay Signal</strong> — an AI design and development agency. I came across your work and thought there might be a great opportunity for us to collaborate.</p>
<p>We specialize in building AI-powered platforms, automation systems, and high-converting digital experiences for growing businesses.</p>
<p>Would love to learn more about what you're working on. Open to a quick chat?</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>`,
    };
  }

  if (lower.includes("thank") || lower.includes("appreciate")) {
    return {
      subject: "Thank You!",
      body: `<p>Hi there,</p>
<p>Just wanted to say thank you — I really appreciate your time and consideration.</p>
<p>Looking forward to staying connected and exploring how Kootenay Signal can support your goals.</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>`,
    };
  }

  if (lower.includes("proposal") || lower.includes("quote") || lower.includes("pricing")) {
    return {
      subject: "Your Custom Proposal from Kootenay Signal",
      body: `<p>Hi there,</p>
<p>Thanks for your interest in working with Kootenay Signal. I've put together some thoughts on how we can help you achieve your goals.</p>
<p>I'd love to hop on a call to walk through the details and tailor a solution specifically for your needs.</p>
<p>When works best for you?</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>`,
    };
  }

  // Default: turn the intent into a professional email
  // Capitalize first letter of intent for subject
  const subjectFromIntent = intent.charAt(0).toUpperCase() + intent.slice(1, 60);
  return {
    subject: subjectFromIntent.length > 50 ? "A Message from Kootenay Signal" : subjectFromIntent,
    body: `<p>Hi there,</p>
<p>${intent.charAt(0).toUpperCase() + intent.slice(1)}.</p>
<p>At <strong>Kootenay Signal</strong>, we specialize in AI-powered design and development — building smart platforms, automation systems, and digital experiences that help businesses scale.</p>
<p>I'd love to connect and explore how we can work together.</p>
<p>Best regards,<br/>Jaryd Paquette<br/>Kootenay Signal</p>`,
  };
}

function parseTagCommand(text: string): Record<string, unknown> {
  const id = extractId(text);
  const addMatch = text.match(/add\s+tags?\s+["']?([^"'\n]+)["']?/i);
  const removeMatch = text.match(/remove\s+tags?\s+["']?([^"'\n]+)["']?/i);

  return {
    contactId: id || "",
    addTags: addMatch ? addMatch[1].split(",").map(t => t.trim()) : [],
    removeTags: removeMatch ? removeMatch[1].split(",").map(t => t.trim()) : [],
  };
}

function findBestToolMatch(text: string): ToolDefinition | null {
  let best: ToolDefinition | null = null;
  let bestScore = 0;

  for (const tool of ALL_TOOLS) {
    const words = tool.name.split("_");
    let score = 0;
    for (const word of words) {
      if (text.includes(word)) score++;
    }
    const descWords = tool.description.toLowerCase().split(" ");
    for (const word of descWords) {
      if (word.length > 4 && text.includes(word)) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = tool;
    }
  }

  return bestScore >= 2 ? best : null;
}

function buildSummary(plan: AgentPlan, results: ToolResult[], lastResult: ToolResult | null): string {
  if (results.length === 0) return "No actions were taken.";
  if (!lastResult?.success) return `Failed: ${lastResult?.error || "Unknown error"}`;

  const data = lastResult.data as Record<string, unknown>;

  switch (plan.intentType) {
    case "analytics":
      return formatAnalyticsSummary(data);
    case "contact_search":
      return formatContactSummary(data);
    case "warmup_status":
      return formatMailboxSummary(data);
    case "inbox_search":
      return formatInboxSummary(data);
    case "invoice_search":
      return formatInvoiceSummary(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatAnalyticsSummary(data: Record<string, unknown>): string {
  if (data.totalLeads !== undefined) {
    const d = data as Record<string, unknown>;
    const mb = d.mailboxes as Record<string, unknown> | undefined;
    return [
      `📊 Dashboard Overview`,
      `• ${d.totalLeads} leads, ${d.activeClients} active clients`,
      `• ${d.totalContacts} contacts, ${d.activeCampaigns} active campaigns`,
      `• ${d.unpaidInvoices} unpaid invoices ($${d.unpaidAmount})`,
      mb ? `• ${mb.total} mailboxes (avg trust: ${typeof mb.avgTrustScore === 'number' ? mb.avgTrustScore.toFixed(0) : 0}%)` : "",
    ].filter(Boolean).join("\n");
  }
  return JSON.stringify(data, null, 2);
}

function formatContactSummary(data: Record<string, unknown>): string {
  const contacts = data.contacts as Array<Record<string, unknown>> | undefined;
  if (!contacts) return JSON.stringify(data);
  return `Found ${contacts.length} contact(s):\n` +
    contacts.slice(0, 10).map(c => `• ${c.name || "Unknown"} — ${c.email} (${c.pipelineStage || "no stage"})`).join("\n");
}

function formatMailboxSummary(data: Record<string, unknown>): string {
  const mailboxes = (data.mailboxes as Array<Record<string, unknown>>) || [];
  return `${mailboxes.length} mailbox(es):\n` +
    mailboxes.map(m => `• ${m.email} — ${m.warmupStatus} (trust: ${m.trustScore}%)`).join("\n");
}

function formatInboxSummary(data: Record<string, unknown>): string {
  const threads = (data.threads as Array<Record<string, unknown>>) || [];
  if (threads.length === 0) return "No messages found.";
  return `${threads.length} message(s):\n` +
    threads.slice(0, 10).map(t => `• ${t.direction === "inbound" ? "←" : "→"} ${t.fromEmail} — "${t.subject}" (${t.status})`).join("\n");
}

function formatInvoiceSummary(data: Record<string, unknown>): string {
  const invoices = (data.invoices as Array<Record<string, unknown>>) || [];
  if (invoices.length === 0) return "No unpaid invoices.";
  return `${invoices.length} unpaid invoice(s):\n` +
    invoices.map(i => {
      const client = i.client as Record<string, string>;
      return `• $${i.amount} — ${client?.name || "Unknown"} (due: ${i.dueDate})`;
    }).join("\n");
}
