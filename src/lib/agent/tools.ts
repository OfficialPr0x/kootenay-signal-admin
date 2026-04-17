/**
 * Agent Tool Registry
 *
 * Every tool the AI agent can call. Each tool is:
 * - typed with JSON schema
 * - permission-scoped
 * - logged
 * - independently testable
 */

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  items?: { type: string };
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  group: string;
  description: string;
  parameters: ToolParameter[];
  requiresApproval: boolean;
  dangerLevel: "safe" | "moderate" | "dangerous";
}

// ── CONTACTS TOOLS ──

export const CONTACT_TOOLS: ToolDefinition[] = [
  {
    name: "find_contacts",
    group: "contacts",
    description: "Search contacts by name, email, company, tag, or stage. Returns matching contacts with their current pipeline stage and lead score.",
    parameters: [
      { name: "query", type: "string", description: "Search query — name, email, company, or tag", required: true },
      { name: "stage", type: "string", description: "Filter by pipeline stage", enum: ["new", "contacted", "replied", "qualified", "meeting_booked", "proposal", "won", "lost"] },
      { name: "status", type: "string", description: "Filter by status", enum: ["subscribed", "unsubscribed", "bounced"] },
      { name: "limit", type: "number", description: "Max results to return (default 20)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "get_contact",
    group: "contacts",
    description: "Get full details of a specific contact by ID or email, including activity history and campaign memberships.",
    parameters: [
      { name: "id", type: "string", description: "Contact ID" },
      { name: "email", type: "string", description: "Contact email (alternative to ID)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "update_contact_tags",
    group: "contacts",
    description: "Add or remove tags from a contact.",
    parameters: [
      { name: "contactId", type: "string", description: "Contact ID", required: true },
      { name: "addTags", type: "array", description: "Tags to add", items: { type: "string" } },
      { name: "removeTags", type: "array", description: "Tags to remove", items: { type: "string" } },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "move_contact_stage",
    group: "contacts",
    description: "Move a contact to a different pipeline stage.",
    parameters: [
      { name: "contactId", type: "string", description: "Contact ID", required: true },
      { name: "stage", type: "string", description: "New pipeline stage", required: true, enum: ["new", "contacted", "replied", "qualified", "meeting_booked", "proposal", "won", "lost"] },
    ],
    requiresApproval: false,
    dangerLevel: "moderate",
  },
  {
    name: "list_prospect_list",
    group: "contacts",
    description: "List the current prospect list — all contacts in early pipeline stages (new, contacted) that are subscribed and not bounced.",
    parameters: [
      { name: "limit", type: "number", description: "Max results (default 50)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
];

// ── EMAIL SEND TOOLS ──

export const EMAIL_TOOLS: ToolDefinition[] = [
  {
    name: "compose_email_draft",
    group: "email",
    description: "Compose an email draft with subject and body. Does NOT send — just creates a preview.",
    parameters: [
      { name: "to", type: "array", description: "Recipient email addresses", items: { type: "string" }, required: true },
      { name: "subject", type: "string", description: "Email subject", required: true },
      { name: "body", type: "string", description: "Email body (HTML)", required: true },
      { name: "fromMailbox", type: "string", description: "Sending mailbox email address" },
      { name: "tags", type: "array", description: "Tags for tracking", items: { type: "string" } },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "send_single_email",
    group: "email",
    description: "Send a single email to one recipient.",
    parameters: [
      { name: "to", type: "string", description: "Recipient email address", required: true },
      { name: "subject", type: "string", description: "Email subject", required: true },
      { name: "body", type: "string", description: "Email body (HTML)", required: true },
      { name: "fromMailbox", type: "string", description: "Sending mailbox email" },
      { name: "tags", type: "array", description: "Tags", items: { type: "string" } },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
  {
    name: "send_bulk_email_batch",
    group: "email",
    description: "Send emails to a list of contacts. Requires approval. Will stagger sends and respect mailbox health.",
    parameters: [
      { name: "contactIds", type: "array", description: "List of contact IDs to email", items: { type: "string" }, required: true },
      { name: "subject", type: "string", description: "Email subject", required: true },
      { name: "body", type: "string", description: "Email body (HTML)", required: true },
      { name: "fromMailbox", type: "string", description: "Sending mailbox" },
      { name: "tags", type: "array", description: "Tags", items: { type: "string" } },
      { name: "staggerMinutes", type: "number", description: "Minutes between batches (default 5)" },
    ],
    requiresApproval: true,
    dangerLevel: "dangerous",
  },
  {
    name: "pause_campaign",
    group: "email",
    description: "Pause an active email campaign.",
    parameters: [
      { name: "campaignId", type: "string", description: "Campaign ID", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
  {
    name: "resume_campaign",
    group: "email",
    description: "Resume a paused email campaign.",
    parameters: [
      { name: "campaignId", type: "string", description: "Campaign ID", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
];

// ── INBOX TOOLS ──

export const INBOX_TOOLS: ToolDefinition[] = [
  {
    name: "search_inbox_threads",
    group: "inbox",
    description: "Search inbox threads by keyword, sender, date, or status. Returns thread summaries.",
    parameters: [
      { name: "query", type: "string", description: "Search query" },
      { name: "direction", type: "string", description: "Filter by direction", enum: ["inbound", "outbound"] },
      { name: "status", type: "string", description: "Filter by status", enum: ["sent", "delivered", "opened", "clicked", "bounced", "received"] },
      { name: "since", type: "string", description: "ISO date — only messages after this date" },
      { name: "limit", type: "number", description: "Max results" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "get_thread",
    group: "inbox",
    description: "Get full thread details including all messages and events.",
    parameters: [
      { name: "threadId", type: "string", description: "Thread ID", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "draft_reply",
    group: "inbox",
    description: "Draft a reply to an inbox message. Does not send.",
    parameters: [
      { name: "messageId", type: "string", description: "Message ID to reply to", required: true },
      { name: "body", type: "string", description: "Reply body (HTML)", required: true },
      { name: "subject", type: "string", description: "Override subject (optional)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "send_reply",
    group: "inbox",
    description: "Send a reply to an inbox message.",
    parameters: [
      { name: "messageId", type: "string", description: "Message ID to reply to", required: true },
      { name: "body", type: "string", description: "Reply body (HTML)", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
];

// ── WARMUP / DELIVERABILITY TOOLS ──

export const WARMUP_TOOLS: ToolDefinition[] = [
  {
    name: "list_mailboxes",
    group: "warmup",
    description: "List all email accounts/mailboxes with their warmup status, trust score, and health data.",
    parameters: [],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "get_mailbox_health",
    group: "warmup",
    description: "Get detailed health data for a specific mailbox — trust score, bounce rate, reply rate, DNS status.",
    parameters: [
      { name: "mailboxId", type: "string", description: "Mailbox ID", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "pause_warmup",
    group: "warmup",
    description: "Pause warmup on a specific mailbox.",
    parameters: [
      { name: "mailboxId", type: "string", description: "Mailbox ID", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
  {
    name: "resume_warmup",
    group: "warmup",
    description: "Resume warmup on a paused mailbox.",
    parameters: [
      { name: "mailboxId", type: "string", description: "Mailbox ID", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "set_warmup_volume",
    group: "warmup",
    description: "Change the daily warmup volume cap for a mailbox.",
    parameters: [
      { name: "mailboxId", type: "string", description: "Mailbox ID", required: true },
      { name: "dailyVolume", type: "number", description: "New daily volume cap", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "moderate",
  },
  {
    name: "get_domain_health",
    group: "warmup",
    description: "Get deliverability health summary for a domain — SPF, DKIM, DMARC, bounce rate, risk alerts.",
    parameters: [
      { name: "domain", type: "string", description: "Domain name", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
];

// ── INVOICE TOOLS ──

export const INVOICE_TOOLS: ToolDefinition[] = [
  {
    name: "find_client",
    group: "invoicing",
    description: "Find a client by name, email, or business name.",
    parameters: [
      { name: "query", type: "string", description: "Client name, email, or business", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "create_invoice_draft",
    group: "invoicing",
    description: "Create a draft invoice for a client based on their active plan and monthly rate.",
    parameters: [
      { name: "clientId", type: "string", description: "Client ID", required: true },
      { name: "amount", type: "number", description: "Invoice amount (defaults to client's monthlyRate)" },
      { name: "description", type: "string", description: "Invoice description" },
      { name: "dueDate", type: "string", description: "Due date (ISO string, default 30 days from now)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "send_invoice",
    group: "invoicing",
    description: "Send an invoice notification email to the client. Requires approval.",
    parameters: [
      { name: "invoiceId", type: "string", description: "Invoice ID", required: true },
    ],
    requiresApproval: true,
    dangerLevel: "dangerous",
  },
  {
    name: "list_unpaid_invoices",
    group: "invoicing",
    description: "List all unpaid (pending or overdue) invoices.",
    parameters: [
      { name: "clientId", type: "string", description: "Filter by client ID (optional)" },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
];

// ── ANALYTICS / REPORTING TOOLS ──

export const ANALYTICS_TOOLS: ToolDefinition[] = [
  {
    name: "get_campaign_metrics",
    group: "analytics",
    description: "Get metrics for a campaign — sends, opens, clicks, replies, bounces.",
    parameters: [
      { name: "campaignId", type: "string", description: "Campaign ID", required: true },
    ],
    requiresApproval: false,
    dangerLevel: "safe",
  },
  {
    name: "get_dashboard_stats",
    group: "analytics",
    description: "Get dashboard overview stats — lead counts, client counts, revenue, email stats, warmup status.",
    parameters: [],
    requiresApproval: false,
    dangerLevel: "safe",
  },
];

// ── ALL TOOLS ──

export const ALL_TOOLS: ToolDefinition[] = [
  ...CONTACT_TOOLS,
  ...EMAIL_TOOLS,
  ...INBOX_TOOLS,
  ...WARMUP_TOOLS,
  ...INVOICE_TOOLS,
  ...ANALYTICS_TOOLS,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(t => t.name === name);
}

export function getToolsByGroup(group: string): ToolDefinition[] {
  return ALL_TOOLS.filter(t => t.group === group);
}

/**
 * Format tools for Claude's tool_use API format
 */
export function formatToolsForClaude(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        tool.parameters.map(p => [
          p.name,
          {
            type: p.type,
            description: p.description,
            ...(p.enum ? { enum: p.enum } : {}),
            ...(p.items ? { items: p.items } : {}),
          },
        ])
      ),
      required: tool.parameters.filter(p => p.required).map(p => p.name),
    },
  }));
}
