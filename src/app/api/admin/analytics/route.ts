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
        "id, user_id, user_email, user_role, query_text, documents_accessed, source, had_hits, avg_similarity, timestamp",
      )
      .gte("timestamp", since7d)
      .order("timestamp", { ascending: false })
      .limit(2000);

    if (error) throw error;

    const { data: activities } = await supabase
      .from("activity_logs")
      .select("id, user_email, user_role, action, details, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(40);

    const rows = logs ?? [];
    const todayCount = rows.filter((r) => r.timestamp >= since1d).length;
    const weekCount = rows.length;
    const unanswered = rows.filter((r) => r.had_hits === false);
    const activeUsers = new Set(
      rows.map((r) => r.user_id).filter(Boolean),
    ).size;
    const adminActions = (activities ?? []).filter((a) => a.user_role === "admin").length;
    const assistantActions = (activities ?? []).filter(
      (a) => a.user_role === "assistant",
    ).length;

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
        adminActions7d: adminActions,
        assistantActions7d: assistantActions,
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
        user_role: r.user_role,
        user_email: r.user_email,
      })),
      recentActivity: (activities ?? []).map((a) => ({
        action: a.action,
        user_role: a.user_role,
        user_email: a.user_email,
        details: a.details,
        created_at: a.created_at,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
