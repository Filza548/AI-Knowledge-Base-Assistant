import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

/** Server-only Supabase client with service role (bypasses RLS). Never import in client components. */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const env = getEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return adminClient;
}
