import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody, getRequestLocale } from "@/lib/http";
import { requireSession } from "@/lib/session";
import {
  answerWithRag,
  resolveCollectionDocumentIds,
} from "@/lib/openai/rag";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chatSchema } from "@/lib/validations";
import { logActivity, searchLogActorFields } from "@/lib/activity";

/** Vercel serverless timeout (Pro/Fluid; Hobby max may be lower). */
export const maxDuration = 60;

function titleFromQuery(query: string) {
  const t = query.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || "New chat";
}

export async function POST(req: Request) {
  let createdConversationId: string | null = null;

  try {
    const session = await requireSession({
      rateLimitKey: "chat",
      limit: 20,
      windowMs: 60_000,
    });

    const body = await parseJsonBody(req);
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { query, documentId, collectionId, conversationId } = parsed.data;
    const supabase = getSupabaseAdmin();

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

    let activeConversationId = conversationId;
    let history: { role: "user" | "assistant"; content: string }[] = [];

    if (activeConversationId) {
      const { data: existing, error } = await supabase
        .from("conversations")
        .select("id, user_id, title")
        .eq("id", activeConversationId)
        .maybeSingle();
      if (error) throw error;
      if (!existing || existing.user_id !== session.user.id) {
        throw new ApiError(404, "Conversation not found", "not_found");
      }

      const { data: prior, error: priorError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true })
        .limit(12);
      if (priorError) throw priorError;
      history = (prior ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
    } else {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({
          user_id: session.user.id,
          title: titleFromQuery(query),
          document_id: documentId ?? null,
          collection_id: collectionId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      activeConversationId = created.id;
      createdConversationId = created.id;
    }

    // Generate first — only persist turns after a successful answer
    const result = await answerWithRag(query, {
      documentId,
      documentIds,
      history,
      includeFollowUps: false,
      locale: getRequestLocale(req),
    });

    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: query,
    });
    if (userMsgError) throw userMsgError;

    const { error: assistantMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
      confidence: result.confidence,
    });
    if (assistantMsgError) throw assistantMsgError;

    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        title: titleFromQuery(query),
      })
      .eq("id", activeConversationId)
      .eq("title", "New chat");

    const uniqueDocIds = [
      ...new Set(result.citations.map((c) => c.document_id)),
    ];

    void supabase
      .from("search_logs")
      .insert({
        ...searchLogActorFields(session.user),
        query_text: query.slice(0, 4000),
        documents_accessed: uniqueDocIds,
        source: "chat",
        had_hits: result.citations.length > 0,
        avg_similarity: result.confidence || null,
      })
      .then(({ error }) => {
        if (error) console.error("[chat] search_logs insert failed", error);
      });

    void logActivity({
      user: session.user,
      action: "chat",
      details: {
        query: query.slice(0, 500),
        conversation_id: activeConversationId,
        citation_count: result.citations.length,
        document_ids: uniqueDocIds,
        confidence: result.confidence,
      },
    });

    return jsonOk({
      ...result,
      conversationId: activeConversationId,
    });
  } catch (err) {
    if (createdConversationId) {
      try {
        await getSupabaseAdmin()
          .from("conversations")
          .delete()
          .eq("id", createdConversationId);
      } catch {
        // best-effort cleanup of empty conversation
      }
    }
    return handleRouteError(err);
  }
}
