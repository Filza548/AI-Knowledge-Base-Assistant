/**
 * Read-only: which app users can email/password login.
 * Usage: npx tsx scripts/check-password-users.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("users")
    .select("email, role, password_hash")
    .order("email");

  if (error) throw error;

  console.log("\n=== Password login readiness ===\n");
  for (const u of data ?? []) {
    const canPassword = Boolean(u.password_hash);
    console.log(
      `${canPassword ? "YES" : "NO "}  ${u.email}  (${u.role})${
        canPassword ? "" : "  ← use Google button, or create password via Admin / seed:admin"
      }`,
    );
  }
  if (!data?.length) {
    console.log("(no users — run npm run seed:admin)");
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
