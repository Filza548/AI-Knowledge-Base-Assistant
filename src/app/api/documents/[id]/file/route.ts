import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { decryptAtRest } from "@/lib/security/encryption";
import { requireDocumentAccess } from "@/lib/documents/access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      rateLimitKey: "documents-file",
      limit: 40,
    });

    const { id } = await params;
    const { supabase, document } = await requireDocumentAccess(session.user, id);

    const storagePath = decryptAtRest(String(document.file_path));
    const { data: signed, error: signError } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60);

    if (signError || !signed?.signedUrl) {
      throw new ApiError(500, "Could not create file URL", "signed_url_failed");
    }

    return jsonOk({
      url: signed.signedUrl,
      fileType: document.file_type,
      documentName: document.document_name,
      documentId: document.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
