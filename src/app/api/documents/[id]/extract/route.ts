import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { extractDocumentInfo } from "@/lib/openai/rag";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireSession({
      rateLimitKey: "extract",
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
      throw new ApiError(409, "Document is not ready for extraction", "not_ready");
    }

    const extraction = await extractDocumentInfo(id);
    return jsonOk({
      document_id: id,
      document_name: doc.document_name,
      extraction,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
