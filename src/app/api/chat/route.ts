import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { parseJsonBody, getRequestLocale } from "@/lib/http";
import { requireSession } from "@/lib/session";
import {
  answerWithRag,
  resolveCollectionDocumentIds,
} from "@/lib/openai/rag";
import { matchSmallTalk, smallTalkAnswer } from "@/lib/chat/small-talk";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chatSchema } from "@/lib/validations";
import { logActivity, searchLogActorFields } from "@/lib/activity";
import { resolveReadableDocumentScope } from "@/lib/documents/access";

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
    const smallTalk = matchSmallTalk(query);

    let collectionDocumentIds: string[] | undefined;
    if (collectionId && !smallTalk) {
      collectionDocumentIds = await resolveCollectionDocumentIds(collectionId);
      if (!collectionDocumentIds.length) {
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
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!existing) {
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
      createdConversationId = created.id;
    }

    // Greetings / thanks / etc. — reply locally, zero OpenAI tokens
    if (smallTalk) {
      const result = smallTalkAnswer(smallTalk);

      const { error: userMsgError } = await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        role: "user",
        content: query,
      });
      if (userMsgError) throw userMsgError;

      const { error: assistantMsgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          role: "assistant",
          content: result.answer,
          citations: [],
          confidence: 0,
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

      void logActivity({
        user: session.user,
        action: "chat_small_talk",
        details: {
          query: query.slice(0, 200),
          conversation_id: activeConversationId,
          kind: smallTalk,
        },
      });

      return jsonOk({
        ...result,
        conversationId: activeConversationId,
      });
    }

    let history: { role: "user" | "assistant"; content: string }[] = [];
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

    const scope = await resolveReadableDocumentScope(session.user, {
      documentId,
      collectionDocumentIds,
    });

    const result = await answerWithRag(query, {
      documentId: scope.documentId,
      documentIds: scope.documentIds,
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
