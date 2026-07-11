import { handleRouteError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const FALLBACK = [
  "What is the leave policy?",
  "Summarize onboarding requirements",
  "What are the security guidelines?",
  "Who approves expense claims?",
];

export async function GET() {
  try {
    await requireSession({ rateLimitKey: "suggestions" });
    const supabase = getSupabaseAdmin();

    const [{ data: docs }, { data: logs }] = await Promise.all([
      supabase
        .from("knowledge_base")
        .select("document_name")
        .eq("status", "ready")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("search_logs")
        .select("query_text")
        .eq("had_hits", true)
        .order("timestamp", { ascending: false })
        .limit(8),
    ]);

    const fromDocs = (docs ?? []).map(
      (d) => `What does ${d.document_name} cover?`,
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
