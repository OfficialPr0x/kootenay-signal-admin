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

export const supabase =
  globalForSupabase.supabase ||
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    resolveSupabaseKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

if (process.env.NODE_ENV !== "production") globalForSupabase.supabase = supabase;

/** Throw on Supabase query errors */
export function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
