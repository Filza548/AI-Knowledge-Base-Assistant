import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody } from "@/lib/http";
import { requireSession } from "@/lib/session";
import {
  resolveCollectionDocumentIds,
  retrieveChunks,
} from "@/lib/openai/rag";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { searchSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      rateLimitKey: "search",
      limit: 30,
      windowMs: 60_000,
    });

    const body = await parseJsonBody(req);
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { query, documentId, collectionId } = parsed.data;

    let documentIds: string[] | undefined;
    if (collectionId) {
      documentIds = await resolveCollectionDocumentIds(collectionId);
      if (!documentIds.length) {
        throw new ApiError(
          400,
          "This collection has no documents yet",
          "empty_collection",
        );
      }
    }

    const matches = await retrieveChunks(query, {
      documentId,
      documentIds,
      matchCount: 12,
    });

    const avgSimilarity =
      matches.length > 0
        ? matches.reduce((s, m) => s + m.similarity, 0) / matches.length
        : null;

    const supabase = getSupabaseAdmin();
    await supabase.from("search_logs").insert({
      user_id: session.user.id,
      query_text: query.slice(0, 4000),
      documents_accessed: [...new Set(matches.map((m) => m.document_id))],
      source: "search",
      had_hits: matches.length > 0,
      avg_similarity: avgSimilarity,
    });

    return jsonOk({
      results: matches.map((m) => ({
        document_id: m.document_id,
        document_name: m.document_name,
        page: m.page_number,
        snippet: m.content.slice(0, 400),
        similarity: m.similarity,
        citation: `Source: ${m.document_name}, Page ${m.page_number ?? "n/a"}`,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
