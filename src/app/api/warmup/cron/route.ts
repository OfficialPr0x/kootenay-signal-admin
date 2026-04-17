import { NextRequest, NextResponse } from "next/server";

/**
 * Autonomous Warmup Cron
 *
 * GET  /api/warmup/cron — Status of the autonomous warmup system
 * POST /api/warmup/cron — Execute one full warmup cycle (send + engage)
 *
 * This endpoint is designed to be called by:
 *   - Vercel Cron Jobs (vercel.json)
 *   - External cron (GitHub Actions, Zapier Scheduled Trigger, etc.)
 *   - The in-app "Start Autonomous Warmup" button (uses internal scheduler)
 *
 * Auth: Requires CRON_SECRET in Authorization header, or valid session cookie.
 *
 * Cycle flow:
 *   1. POST /api/warmup/execute — Send warmup emails via Resend
 *   2. POST /api/warmup/engage  — Check Gmail via Zapier MCP, open/reply/label
 *   3. Return combined results
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

async function internalFetch(path: string, method: string, body?: unknown, cookies?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward cron secret for internal auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }
  // Forward cookie for UI-triggered calls
  if (cookies) {
    headers["Cookie"] = cookies;
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}

// POST /api/warmup/cron — Run one full autonomous cycle
export async function POST(request: NextRequest) {
  // Auth: cron secret or session cookie
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = request.cookies.get("auth-token")?.value;
  const cookies = request.headers.get("cookie") || "";

  if (!token && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: {
    phase: string;
    success: boolean;
    data: Record<string, unknown>;
    durationMs: number;
  }[] = [];

  // Phase 1: Execute warmup sends
  try {
    const t0 = Date.now();
    const execResult = await internalFetch("/api/warmup/execute", "POST", {}, cookies);
    results.push({
      phase: "execute",
      success: !execResult.error,
      data: execResult,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    results.push({
      phase: "execute",
      success: false,
      data: { error: err instanceof Error ? err.message : "Unknown error" },
      durationMs: Date.now() - startTime,
    });
  }

  // Phase 2: Gmail engagement (check inbox + spam, open, reply, label)
  try {
    const t0 = Date.now();
    const engageResult = await internalFetch(
      "/api/warmup/engage",
      "POST",
      { replyRate: 0.4, maxToProcess: 20 },
      cookies
    );
    results.push({
      phase: "engage",
      success: !engageResult.error,
      data: engageResult,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    results.push({
      phase: "engage",
      success: false,
      data: { error: err instanceof Error ? err.message : "Unknown error" },
      durationMs: Date.now() - startTime,
    });
  }

  const totalDuration = Date.now() - startTime;

  return NextResponse.json({
    message: "Warmup cron cycle complete",
    totalDurationMs: totalDuration,
    results,
    timestamp: new Date().toISOString(),
  });
}

// GET /api/warmup/cron — Status of the autonomous warmup system
export async function GET() {
  const cronSecret = process.env.CRON_SECRET;

  return NextResponse.json({
    configured: !!cronSecret,
    cronSecret: cronSecret ? "set" : "not set",
    baseUrl: BASE_URL,
    instructions: {
      vercel: "Add to vercel.json: { \"crons\": [{ \"path\": \"/api/warmup/cron\", \"schedule\": \"*/3 * * * *\" }] }",
      curl: `curl -X POST ${BASE_URL}/api/warmup/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`,
      github_actions: "Use a scheduled workflow that calls this endpoint every 3 minutes",
    },
  });
}
