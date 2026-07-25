import { handleRouteError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAccessibleDocuments } from "@/lib/documents/access";

const FALLBACK = [
  "What is covered in the company documents?",
  "Summarize the main points",
  "What key policies should I know?",
  "List important dates or deadlines",
];

export async function GET() {
  try {
    const session = await requireSession({ rateLimitKey: "suggestions" });
    const supabase = getSupabaseAdmin();

    const docs = await listAccessibleDocuments(session.user, {
      readyOnly: true,
      limit: 4,
    });

    const { data: logs } = await supabase
      .from("search_logs")
      .select("query_text")
      .eq("had_hits", true)
      .eq("user_id", session.user.id)
      .order("timestamp", { ascending: false })
      .limit(8);

    const fromDocs = (docs ?? []).map(
      (d) => `What does ${d.document_name ?? "this document"} cover?`,
    );
    const fromLogs = (logs ?? [])
      .map((l) => l.query_text?.trim())
      .filter((q): q is string => Boolean(q) && q.length < 120);

    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const q of [...fromLogs, ...fromDocs, ...FALLBACK]) {
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(q);
      if (suggestions.length >= 6) break;
    }

    return jsonOk({ suggestions });
  } catch (err) {
    return handleRouteError(err);
  }
}
