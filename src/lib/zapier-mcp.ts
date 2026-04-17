/**
 * Zapier MCP Client
 *
 * Communicates with Zapier's Model Context Protocol server
 * to control Gmail accounts for warmup automation.
 */

const ZAPIER_MCP_URL = process.env.ZAPIER_MCP_URL || "https://mcp.zapier.com/api/v1/connect";
const ZAPIER_MCP_TOKEN = process.env.ZAPIER_MCP_TOKEN || "";

interface McpResponse {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

let requestId = 0;

async function mcpCall(method: string, params: Record<string, unknown> = {}): Promise<McpResponse> {
  requestId++;

  const res = await fetch(ZAPIER_MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ZAPIER_MCP_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    }),
  });

  const text = await res.text();

  // Zapier returns SSE format: "event: message\ndata: {...}"
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr.startsWith("{")) {
        return JSON.parse(jsonStr) as McpResponse;
      }
    }
  }

  // Try parsing directly as JSON
  try {
    return JSON.parse(text) as McpResponse;
  } catch {
    throw new Error(`Invalid MCP response: ${text.slice(0, 200)}`);
  }
}

function extractContent(result: McpResponse): string {
  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`);
  }

  const content = result.result?.content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === "text")
      .map((c: Record<string, unknown>) => c.text)
      .join("\n");
  }

  return JSON.stringify(result.result);
}

// ── Gmail Operations ──

export async function gmailFindEmail(query: string, outputHint?: string): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_find_email",
    arguments: {
      instructions: `Find email matching: ${query}`,
      query,
      output_hint: outputHint || "message id, subject, from, date, snippet",
    },
  });

  return extractContent(response);
}

export async function gmailSendEmail(opts: {
  to: string[];
  subject: string;
  body: string;
  bodyType?: "plain" | "html";
  fromName?: string;
}): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_send_email",
    arguments: {
      instructions: `Send an email to ${opts.to.join(", ")} with subject "${opts.subject}"`,
      to: opts.to,
      subject: opts.subject,
      body: opts.body,
      body_type: opts.bodyType || "plain",
      output_hint: "message id and status",
      ...(opts.fromName && { from_name: opts.fromName }),
    },
  });

  return extractContent(response);
}

export async function gmailReplyToEmail(opts: {
  threadId: string;
  body: string;
  bodyType?: "plain" | "html";
  to?: string[];
}): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_reply_to_email",
    arguments: {
      instructions: `Reply to the email thread with a warm, natural response`,
      thread_id: opts.threadId,
      body: opts.body,
      body_type: opts.bodyType || "plain",
      output_hint: "message id and status",
      ...(opts.to && { to: opts.to }),
    },
  });

  return extractContent(response);
}

export async function gmailAddLabel(messageId: string, labelIds: string[]): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_add_label_to_email",
    arguments: {
      instructions: `Add labels to email ${messageId}`,
      message_id: messageId,
      new_label_ids: labelIds,
      output_hint: "status",
    },
  });

  return extractContent(response);
}

export async function gmailCreateLabel(name: string): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_create_label",
    arguments: {
      instructions: `Create a new Gmail label called "${name}"`,
      name,
      output_hint: "label id and name",
    },
  });

  return extractContent(response);
}

export async function gmailRemoveLabel(messageId: string, labelIds: string[]): Promise<string> {
  const response = await mcpCall("tools/call", {
    name: "gmail_remove_label_from_email",
    arguments: {
      instructions: `Remove labels from email ${messageId}`,
      message_id: messageId,
      label_ids: labelIds,
      output_hint: "status",
    },
  });

  return extractContent(response);
}

export function isConfigured(): boolean {
  return !!ZAPIER_MCP_TOKEN;
}
