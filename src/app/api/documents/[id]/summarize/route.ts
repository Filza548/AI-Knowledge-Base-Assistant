import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { summarizeDocument } from "@/lib/openai/rag";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      rateLimitKey: "summarize",
      limit: 15,
      windowMs: 60_000,
    });

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid document id", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error } = await supabase
      .from("knowledge_base")
      .select("id, status, document_name")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!doc) throw new ApiError(404, "Document not found", "not_found");
    if (doc.status !== "ready") {
      throw new ApiError(409, "Document is not ready for summarization", "not_ready");
    }

    const summary = await summarizeDocument(id);

    void logActivity({
      user: session.user,
      action: "summarize",
      details: {
        document_id: id,
        document_name: doc.document_name,
      },
    });

    return jsonOk({
      document_id: id,
      document_name: doc.document_name,
      summary,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
