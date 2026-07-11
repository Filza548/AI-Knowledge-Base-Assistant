import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { conversationUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

async function ownedConversation(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new ApiError(400, "Invalid conversation id", "validation_error");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, document_id, collection_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.user_id !== userId) {
    throw new ApiError(404, "Conversation not found", "not_found");
  }
  return { supabase, conversation: data };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({ rateLimitKey: "conversations-get" });
    const { id } = await params;
    const { supabase, conversation } = await ownedConversation(
      session.user.id,
      id,
    );

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, role, content, citations, confidence, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return jsonOk({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        document_id: conversation.document_id,
        collection_id: conversation.collection_id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations ?? [],
        confidence: m.confidence,
        created_at: m.created_at,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      rateLimitKey: "conversations-patch",
    });
    const { id } = await params;
    const { supabase } = await ownedConversation(session.user.id, id);

    const body = await req.json();
    const parsed = conversationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const { data, error } = await supabase
      .from("conversations")
      .update({ title: parsed.data.title })
      .eq("id", id)
      .select("id, title, document_id, collection_id, created_at, updated_at")
      .single();

    if (error) throw error;
    return jsonOk({ conversation: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      rateLimitKey: "conversations-delete",
    });
    const { id } = await params;
    const { supabase } = await ownedConversation(session.user.id, id);

    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) throw error;

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
