import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { conversationCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await requireSession({ rateLimitKey: "conversations-list" });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, title, document_id, collection_id, created_at, updated_at",
      )
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return jsonOk({ conversations: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      rateLimitKey: "conversations-create",
      limit: 30,
    });
    const body = await req.json().catch(() => ({}));
    const parsed = conversationCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: session.user.id,
        title: parsed.data.title ?? "New chat",
        document_id: parsed.data.documentId ?? null,
        collection_id: parsed.data.collectionId ?? null,
      })
      .select("id, title, document_id, collection_id, created_at, updated_at")
      .single();

    if (error) throw error;
    return jsonOk({ conversation: data }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
