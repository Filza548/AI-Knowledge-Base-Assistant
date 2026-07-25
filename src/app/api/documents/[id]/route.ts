import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { decryptAtRest } from "@/lib/security/encryption";
import { requireDocumentAccess } from "@/lib/documents/access";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({ rateLimitKey: "documents-get" });
    const { id } = await params;
    const { document } = await requireDocumentAccess(session.user, id);

    return jsonOk({
      document: {
        id: document.id,
        document_name: document.document_name,
        file_type: document.file_type,
        file_size: document.file_size,
        status: document.status,
        vector_collection_ref: document.vector_collection_ref,
        uploaded_by: document.uploaded_by,
        created_at: document.created_at,
        updated_at: document.updated_at,
        error_message: document.error_message,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "documents-delete",
      limit: 20,
    });

    const { id } = await params;
    const { supabase, document } = await requireDocumentAccess(session.user, id);

    try {
      const storagePath = decryptAtRest(String(document.file_path));
      await supabase.storage.from("documents").remove([storagePath]);
    } catch {
      // continue deleting DB rows even if storage cleanup fails
    }

    const { error: deleteError } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    void logActivity({
      user: session.user,
      action: "delete_document",
      details: {
        document_id: id,
        document_name: document.document_name,
      },
    });

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
