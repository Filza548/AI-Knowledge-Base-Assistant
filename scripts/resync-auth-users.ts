/**
 * Align Supabase Auth user UUIDs with public.users.
 * Usage: npx tsx scripts/resync-auth-users.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  upsertSupabaseAuthUser,
  upsertSupabaseOAuthUser,
} from "../src/lib/supabase/auth-users";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: appUsers, error } = await sb
    .from("users")
    .select("id, email, name, role, password_hash");
  if (error) throw error;

  for (const app of appUsers ?? []) {
    if (app.password_hash) {
      await upsertSupabaseAuthUser(
        {
          id: app.id,
          email: app.email,
          password: process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow1!",
          name: app.name,
          role: app.role,
        },
        sb,
      );
      console.log("Synced password user:", app.email, app.id);
    } else {
      await upsertSupabaseOAuthUser(
        {
          id: app.id,
          email: app.email,
          name: app.name,
          role: app.role,
          provider: "google",
        },
        sb,
      );
      console.log("Synced OAuth user:", app.email, app.id);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
