import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptAtRest } from "@/lib/security/encryption";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession({ rateLimitKey: "documents-file", limit: 40 });

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid document id", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error } = await supabase
      .from("knowledge_base")
      .select("id, document_name, file_type, file_path, status")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!doc) throw new ApiError(404, "Document not found", "not_found");

    const storagePath = decryptAtRest(doc.file_path);
    const { data: signed, error: signError } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60);

    if (signError || !signed?.signedUrl) {
      throw new ApiError(500, "Could not create file URL", "signed_url_failed");
    }

    return jsonOk({
      url: signed.signedUrl,
      fileType: doc.file_type,
      documentName: doc.document_name,
      documentId: doc.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
