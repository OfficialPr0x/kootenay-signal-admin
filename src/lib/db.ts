import { createClient, SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as { supabase: SupabaseClient };

// Supabase v2 new-format keys start with sb_secret_ or sb_publishable_
// Fall back chain: SUPABASE_SECRET_KEY (new format) → SUPABASE_SERVICE_ROLE_KEY (old JWT) → publishable
function resolveSupabaseKey(): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (secret && secret.length > 20) return secret;

  // Old JWT format must have 3 segments — if truncated, skip it
  if (serviceRole && serviceRole.split(".").length === 3 && serviceRole.length > 100) return serviceRole;

  if (publishable && publishable.length > 20) {
    console.warn("[db] Using publishable key — add SUPABASE_SECRET_KEY (sb_secret_...) to .env for full access");
    return publishable;
  }

  throw new Error("No valid Supabase key found. Add SUPABASE_SECRET_KEY=sb_secret_... to your .env");
}

function createSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    resolveSupabaseKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Lazy proxy — the real client is only instantiated on first property access,
// so missing env vars during `next build` (page-data collection phase) won't
// throw at module evaluation time.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!globalForSupabase.supabase) {
      const client = createSupabaseClient();
      if (process.env.NODE_ENV !== "production") globalForSupabase.supabase = client;
      return Reflect.get(client, prop, client);
    }
    return Reflect.get(globalForSupabase.supabase, prop, globalForSupabase.supabase);
  },
});

/** Throw on Supabase query errors */
export function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
