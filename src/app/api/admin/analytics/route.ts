import { handleRouteError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "admin-analytics",
    });

    const supabase = getSupabaseAdmin();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since1d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from("search_logs")
      .select(
        "id, user_id, query_text, documents_accessed, source, had_hits, avg_similarity, timestamp",
      )
      .gte("timestamp", since7d)
      .order("timestamp", { ascending: false })
      .limit(2000);

    if (error) throw error;

    const rows = logs ?? [];
    const todayCount = rows.filter((r) => r.timestamp >= since1d).length;
    const weekCount = rows.length;
    const unanswered = rows.filter((r) => r.had_hits === false);
    const activeUsers = new Set(
      rows.map((r) => r.user_id).filter(Boolean),
    ).size;

    const queryCounts = new Map<string, number>();
    for (const r of rows) {
      const key = r.query_text.trim().toLowerCase();
      if (!key) continue;
      queryCounts.set(key, (queryCounts.get(key) ?? 0) + 1);
    }
    const topQueries = [...queryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([query, count]) => ({ query, count }));

    const docCounts = new Map<string, number>();
    for (const r of rows) {
      for (const id of r.documents_accessed ?? []) {
        docCounts.set(id, (docCounts.get(id) ?? 0) + 1);
      }
    }
    const topDocIds = [...docCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    let topDocuments: { id: string; name: string; count: number }[] = [];
    if (topDocIds.length) {
      const { data: docs } = await supabase
        .from("knowledge_base")
        .select("id, document_name")
        .in(
          "id",
          topDocIds.map(([id]) => id),
        );
      const nameById = new Map(
        (docs ?? []).map((d) => [d.id, d.document_name]),
      );
      topDocuments = topDocIds.map(([id, count]) => ({
        id,
        name: nameById.get(id) ?? id,
        count,
      }));
    }

    return jsonOk({
      stats: {
        queriesToday: todayCount,
        queries7d: weekCount,
        unanswered7d: unanswered.length,
        activeUsers7d: activeUsers,
        chatShare:
          weekCount > 0
            ? rows.filter((r) => r.source === "chat").length / weekCount
            : 0,
      },
      topQueries,
      topDocuments,
      recentUnanswered: unanswered.slice(0, 10).map((r) => ({
        query: r.query_text,
        timestamp: r.timestamp,
        source: r.source,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
