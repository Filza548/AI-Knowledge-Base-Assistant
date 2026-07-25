/**
 * One-off DB health check. Run: npx tsx scripts/check-db.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

config({ path: resolve(process.cwd(), ".env.local") });

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
}
function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.startsWith("http")) {
    fail("env.NEXT_PUBLIC_SUPABASE_URL", "must be a https://…supabase.co URL");
  } else {
    pass("env.NEXT_PUBLIC_SUPABASE_URL", url.replace(/^https?:\/\//, "").split(".")[0] + ".supabase.co");
  }

  if (!key || key.length < 20) {
    fail("env.SUPABASE_SERVICE_ROLE_KEY", "missing or too short");
  } else {
    pass("env.SUPABASE_SERVICE_ROLE_KEY", "present");
  }

  if (!url || !key) {
    printReport();
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Core tables readable
  for (const table of ["users", "knowledge_base", "document_chunks", "search_logs"] as const) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) fail(`table.${table}`, error.message);
    else pass(`table.${table}`, `rows=${count ?? 0}`);
  }

  // 2) Admin user exists (and has a password for email login)
  const { data: admin, error: adminErr } = await supabase
    .from("users")
    .select("id, email, role, password_hash")
    .eq("email", "admin@example.com")
    .maybeSingle();
  if (adminErr) fail("users.admin_row", adminErr.message);
  else if (!admin) fail("users.admin_row", "admin@example.com not found — run npm run seed:admin");
  else if (admin.role !== "admin") fail("users.admin_row", `role=${admin.role}`);
  else if (!admin.password_hash) {
    fail(
      "users.admin_password",
      "password_hash is null — Google-only or unseeded; run npm run seed:admin",
    );
  } else pass("users.admin_row", `${admin.email} (${admin.role}, password set)`);

  // 3) Supabase Auth mirror
  const { data: authList, error: authErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });
  if (authErr) fail("auth.listUsers", authErr.message);
  else {
    const authAdmin = authList.users.find(
      (u) => u.email?.toLowerCase() === "admin@example.com",
    );
    if (!authAdmin) fail("auth.admin_user", "not in Authentication → Users");
    else pass("auth.admin_user", `id matches app=${authAdmin.id === admin?.id}`);
  }

  // 4) RPC match_document_chunks exists (empty vector call)
  const zero = Array(1536).fill(0);
  const { error: rpcErr } = await supabase.rpc("match_document_chunks", {
    query_embedding: zero,
    match_count: 1,
    filter_document_id: null,
  });
  if (rpcErr) fail("rpc.match_document_chunks", rpcErr.message);
  else pass("rpc.match_document_chunks", "callable (pgvector OK)");

  // 5) Write + cleanup smoke test on search_logs
  const probeId = randomUUID();
  const { error: insertErr } = await supabase.from("search_logs").insert({
    id: probeId,
    user_id: admin?.id ?? null,
    query_text: "__db_health_check__",
    documents_accessed: [],
  });
  if (insertErr) fail("write.search_logs", insertErr.message);
  else {
    const { error: delErr } = await supabase
      .from("search_logs")
      .delete()
      .eq("id", probeId);
    if (delErr) fail("delete.search_logs", delErr.message);
    else pass("write.search_logs", "insert + delete OK");
  }

  // 6) Storage bucket
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) fail("storage.buckets", bucketErr.message);
  else if (!buckets.some((b) => b.id === "documents")) {
    fail("storage.documents_bucket", "bucket missing — re-run migration insert");
  } else {
    pass("storage.documents_bucket", "private documents bucket exists");
  }

  printReport();
  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
}

function printReport() {
  console.log("\n=== Database health check ===\n");
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(
    `\nResult: ${failed === 0 ? "ALL OK — database is healthy" : `${failed} check(s) failed`}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
