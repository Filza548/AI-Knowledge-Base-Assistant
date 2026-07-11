import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptAtRest } from "@/lib/security/encryption";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession({ rateLimitKey: "documents-get" });
    const { id } = await params;

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid document id", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("knowledge_base")
      .select(
        "id, document_name, file_type, file_size, status, vector_collection_ref, uploaded_by, created_at, updated_at, error_message",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError(404, "Document not found", "not_found");

    return jsonOk({ document: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "documents-delete",
      limit: 20,
    });

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid document id", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error } = await supabase
      .from("knowledge_base")
      .select("id, file_path")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!doc) throw new ApiError(404, "Document not found", "not_found");

    try {
      const storagePath = decryptAtRest(doc.file_path);
      await supabase.storage.from("documents").remove([storagePath]);
    } catch {
      // continue deleting DB rows even if storage cleanup fails
    }

    const { error: deleteError } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
