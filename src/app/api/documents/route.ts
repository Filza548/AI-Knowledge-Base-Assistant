import { randomUUID } from "crypto";
import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptAtRest } from "@/lib/security/encryption";
import { indexDocument } from "@/lib/documents/indexer";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

const ALLOWED: Record<string, "pdf" | "docx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  try {
    await requireSession({ rateLimitKey: "documents-list" });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("knowledge_base")
      .select(
        "id, document_name, file_type, file_size, status, vector_collection_ref, uploaded_by, created_at, updated_at, error_message",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return jsonOk({ documents: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      roles: ["admin", "assistant"],
      rateLimitKey: "documents-upload",
      limit: 10,
      windowMs: 60_000,
    });

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "file is required", "validation_error");
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new ApiError(400, "File must be between 1 byte and 20MB", "validation_error");
    }

    const fileType = ALLOWED[file.type];
    if (!fileType) {
      throw new ApiError(400, "Only PDF and DOCX are allowed", "validation_error");
    }

    const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180);
    const documentId = randomUUID();
    const storagePath = `${session.user.id}/${documentId}/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const encryptedPath = encryptAtRest(storagePath);

    const { data: doc, error: insertError } = await supabase
      .from("knowledge_base")
      .insert({
        id: documentId,
        document_name: safeName,
        file_path: encryptedPath,
        file_type: fileType,
        file_size: file.size,
        uploaded_by: session.user.id,
        status: "processing",
      })
      .select(
        "id, document_name, file_type, file_size, status, uploaded_by, created_at",
      )
      .single();

    if (insertError) {
      try {
        await supabase.storage.from("documents").remove([storagePath]);
      } catch {
        // best-effort storage cleanup
      }
      throw insertError;
    }

    // Index in the background so large PDFs don't timeout the upload HTTP request.
    // Client polls GET /api/documents/[id] until status is ready | failed.
    void indexDocument(documentId, buffer, fileType).catch((err) => {
      console.error("[documents] background index failed", documentId, err);
    });

    void logActivity({
      user: session.user,
      action: "upload",
      details: {
        document_id: documentId,
        document_name: safeName,
        file_type: fileType,
        file_size: file.size,
      },
    });

    return jsonOk({ document: doc }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
