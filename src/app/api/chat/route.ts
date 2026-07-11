import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import {
  answerWithRag,
  resolveCollectionDocumentIds,
} from "@/lib/openai/rag";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chatSchema } from "@/lib/validations";

function titleFromQuery(query: string) {
  const t = query.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || "New chat";
}

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      rateLimitKey: "chat",
      limit: 20,
      windowMs: 60_000,
    });

    const body = await req.json();
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
    }

    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: query,
    });

    const result = await answerWithRag(query, {
      documentId,
      documentIds,
    });

    const similarities = result.citations.length
      ? result.confidence
      : 0;

    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
      confidence: result.confidence,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId);

    // If still default title on first message of existing empty conv — refresh title
    await supabase
      .from("conversations")
      .update({ title: titleFromQuery(query) })
      .eq("id", activeConversationId)
      .eq("title", "New chat");

    await supabase.from("search_logs").insert({
      user_id: session.user.id,
      query_text: query.slice(0, 4000),
      documents_accessed: result.citations.map((c) => c.document_id),
      source: "chat",
      had_hits: result.citations.length > 0,
      avg_similarity: similarities || null,
    });

    return jsonOk({
      ...result,
      conversationId: activeConversationId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
