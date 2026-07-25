import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { decryptAtRest } from "@/lib/security/encryption";
import { indexDocument } from "@/lib/documents/indexer";
import { requireDocumentAccess } from "@/lib/documents/access";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "reindex",
      limit: 10,
    });

    const { id } = await params;
    const { supabase, document: doc } = await requireDocumentAccess(
      session.user,
      id,
    );

    const storagePath = decryptAtRest(String(doc.file_path));
    const { data: file, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError || !file) {
      throw new ApiError(500, "Failed to download document for re-index", "storage_error");
    }

    await supabase
      .from("knowledge_base")
      .update({ status: "processing", error_message: null })
      .eq("id", id);

    const buffer = Buffer.from(await file.arrayBuffer());
    await indexDocument(id, buffer, doc.file_type as "pdf" | "docx");

    const { data: refreshed } = await supabase
      .from("knowledge_base")
      .select(
        "id, document_name, status, vector_collection_ref, updated_at, error_message",
      )
      .eq("id", id)
      .single();

    return jsonOk({ document: refreshed });
  } catch (err) {
    return handleRouteError(err);
  }
}
