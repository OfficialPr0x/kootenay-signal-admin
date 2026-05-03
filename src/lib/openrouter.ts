/**
 * OpenRouter client — OpenAI-compatible SDK pointed at OpenRouter.
 * Uses the `openai` npm package as a drop-in; supports:
 *   - Gemini 2.5 Flash/Pro/Lite via google/ model IDs
 *   - Web search plugin (replaces googleSearch grounding)
 *   - Structured JSON Schema outputs
 *   - Reasoning / thinking mode
 *   - Exponential-backoff retry
 *   - Provider routing + zero-data-retention
 *
 * Docs: https://openrouter.ai/docs
 */

import OpenAI from "openai";

// ─── Model Registry ───────────────────────────────────────────────────────────

export const MODELS = {
  /** Web search + complex reasoning — default workhorse */
  SEARCH: "google/gemini-2.5-flash",
  /** Deep analysis, dossiers, multi-step reasoning */
  PRO: "google/gemini-2.5-pro",
  /** Fast summarization, simple text — cheapest Gemini 2.5 */
  FAST: "google/gemini-2.5-flash-lite",
  /** Trivial one-shot tasks (classification, timezone) — ultra cheap */
  MICRO: "google/gemini-2.0-flash-001",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ─── Client Factory ───────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://kootenaysignal.com",
      "X-Title": "Kootenay Signal Admin",
    },
  });

  return _client;
}

// ─── Retry Wrapper ────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        (err as { status?: number })?.status ??
        (err as { response?: { status?: number } })?.response?.status;

      // Hard-fail on auth/bad-request errors — retrying won't help
      if (status === 401 || status === 400 || status === 402 || status === 422) {
        throw err;
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, initialDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

// ─── Provider Options ─────────────────────────────────────────────────────────

/** Standard provider options: prefer Google infra, deny data collection */
export const PROVIDER_OPTS = {
  order: ["Google", "Google AI Studio"] as string[],
  allow_fallbacks: true,
  data_collection: "deny" as const,
};

// ─── Core Chat Call ───────────────────────────────────────────────────────────

interface ChatOptions {
  model?: ModelId | string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean;
  maxWebResults?: number;
  reasoning?: "low" | "medium" | "high" | false;
  /** Standard JSON Schema object for strict structured outputs */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
  /** Simple JSON mode (valid JSON, no schema) */
  jsonMode?: boolean;
}

interface ChatResult {
  content: string;
  reasoning?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
}

export async function chat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  const client = getClient();
  const {
    model = MODELS.SEARCH,
    system,
    temperature = 0.7,
    maxTokens = 4096,
    webSearch = false,
    maxWebResults = 5,
    reasoning = false,
    jsonSchema,
    jsonMode = false,
  } = options;

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  // Build the request body — OpenRouter extensions need ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    messages: allMessages,
    temperature,
    max_tokens: maxTokens,
    provider: PROVIDER_OPTS,
  };

  if (webSearch) {
    body.plugins = [{ id: "web", max_results: maxWebResults }];
  }

  if (reasoning) {
    body.reasoning = { effort: reasoning };
  }

  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        strict: true,
        schema: {
          ...jsonSchema.schema,
          additionalProperties: false,
        },
      },
    };
  } else if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await withRetry(() =>
    client.chat.completions.create(body as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)
  );

  const message = res.choices[0]?.message as OpenAI.Chat.ChatCompletionMessage & {
    reasoning?: string;
  };

  return {
    content: message?.content ?? "",
    reasoning: message?.reasoning,
    usage: res.usage
      ? {
          prompt_tokens: res.usage.prompt_tokens,
          completion_tokens: res.usage.completion_tokens,
          total_tokens: res.usage.total_tokens,
        }
      : undefined,
    model: res.model,
  };
}

// ─── Two-Step Search + Structure ──────────────────────────────────────────────

/**
 * Standard two-call pattern:
 * 1. Web-grounded search for raw intelligence
 * 2. Structured JSON extraction from that intelligence
 */
export async function searchThenStructure<T>(
  searchPrompt: string,
  structureSystemPrompt: string,
  structureUserPrompt: (searchText: string) => string,
  jsonSchema: { name: string; schema: Record<string, unknown> },
  opts: { searchModel?: string; structureModel?: string; maxWebResults?: number } = {}
): Promise<T> {
  const {
    searchModel = MODELS.SEARCH,
    structureModel = MODELS.SEARCH,
    maxWebResults = 8,
  } = opts;

  // Step 1: Live web research
  const searchResult = await chat(
    [{ role: "user", content: searchPrompt }],
    { model: searchModel, webSearch: true, maxWebResults, temperature: 0.3 }
  );

  // Step 2: Extract structured data
  const structuredResult = await chat(
    [{ role: "user", content: structureUserPrompt(searchResult.content) }],
    {
      model: structureModel,
      system: structureSystemPrompt,
      jsonSchema,
      temperature: 0.1,
      maxTokens: 2048,
    }
  );

  return JSON.parse(structuredResult.content) as T;
}

// ─── JSON Parse Helper ────────────────────────────────────────────────────────

/** Safely parse JSON from an AI response — strips markdown fences if present. */
export function parseJsonFromAI<T = unknown>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(raw) as T;
}

// ─── Legacy compat shim (used by old callOpenRouter callers) ──────────────────

/** @deprecated Use `chat()` directly */
export async function callOpenRouter(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options: {
    model?: string;
    webSearch?: boolean;
    maxWebResults?: number;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const result = await chat(messages as OpenAI.Chat.ChatCompletionMessageParam[], {
    model: options.model,
    webSearch: options.webSearch,
    maxWebResults: options.maxWebResults,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  return { content: result.content, usage: result.usage };
}

