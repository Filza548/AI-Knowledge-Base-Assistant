/**
 * Seed first admin user.
 * Usage: npx tsx scripts/seed-admin.ts
 *
 * Requires .env.local with Supabase + AUTH vars loaded.
 */
import { config } from "dotenv";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { upsertSupabaseAuthUser } from "../src/lib/supabase/auth-users";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow1!";
  const name = process.env.SEED_ADMIN_NAME || "System Admin";

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        name,
        email,
        password_hash,
        role: "admin",
      },
      { onConflict: "email" },
    )
    .select("id, email, role, name")
    .single();

  if (error) throw error;

  // Promote every *password* user to admin; leave Google assistants alone
  const { error: promoteError } = await supabase
    .from("users")
    .update({ role: "admin" })
    .not("password_hash", "is", null)
    .neq("role", "admin");
  if (promoteError) {
    console.warn("Could not promote password users to admin:", promoteError.message);
  } else {
    console.log("Password users promoted to admin (re-login to refresh session)");
  }

  // Ensure Google-only rows stay assistants
  const { error: demoteError } = await supabase
    .from("users")
    .update({ role: "assistant" })
    .is("password_hash", null)
    .neq("role", "assistant");
  if (demoteError) {
    console.warn("Could not set Google users to assistant:", demoteError.message);
  }

  await upsertSupabaseAuthUser(
    {
      id: data.id,
      email: data.email,
      password,
      name: data.name,
      role: data.role,
    },
    supabase,
  );

  console.log("Admin ready:", { id: data.id, email: data.email, role: data.role });
  console.log("Synced to Supabase Auth (Authentication → Users)");
  console.log("Login with:", email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
