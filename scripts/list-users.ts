/**
 * List app + Auth users. Run: npx tsx scripts/list-users.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  console.log("Project:", url);
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: users, error } = await sb
    .from("users")
    .select("id, email, name, role, password_hash, created_at")
    .order("created_at", { ascending: false });

  console.log("public.users error:", error?.message ?? null);
  console.log(
    "public.users:",
    JSON.stringify(
      (users ?? []).map((u) => ({
        ...u,
        password_hash: u.password_hash ? "(set)" : null,
      })),
      null,
      2,
    ),
  );

  const { data: authList, error: authErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });
  console.log("auth error:", authErr?.message ?? null);
  console.log(
    "auth.users:",
    JSON.stringify(
      (authList?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        providers: u.app_metadata?.providers,
        provider: u.app_metadata?.provider,
        meta: u.user_metadata,
      })),
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
