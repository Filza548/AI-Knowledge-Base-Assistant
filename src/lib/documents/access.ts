import { ApiError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

export type AccessUser = {
  id: string;
  role?: UserRole | string | null;
};

type KnowledgeRow = {
  id: string;
  document_name?: string;
  file_type?: string;
  file_size?: number | null;
  status?: string;
  file_path?: string;
  uploaded_by?: string | null;
  created_at?: string;
  updated_at?: string;
  error_message?: string | null;
  vector_collection_ref?: string | null;
};

/** Only admins may upload / delete / reindex the company knowledge base. */
export function canManageDocuments(role?: UserRole | string | null) {
  return role === "admin";
}

/** @deprecated use canManageDocuments */
export function canManageAllDocuments(role?: UserRole | string | null) {
  return canManageDocuments(role);
}

/**
 * Company knowledge base: every signed-in user can list / read documents.
 * Admins manage the library; assistants only consume it for Q&A.
 */
export async function listAccessibleDocuments(
  _user: AccessUser,
  opts?: { readyOnly?: boolean; limit?: number },
): Promise<KnowledgeRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("knowledge_base")
    .select(
      "id, document_name, file_type, file_size, status, vector_collection_ref, uploaded_by, created_at, updated_at, error_message",
    )
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (opts?.readyOnly) {
    query = query.eq("status", "ready");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as KnowledgeRow[];
}

export async function getAccessibleDocumentIds(
  user: AccessUser,
  opts?: { readyOnly?: boolean },
): Promise<string[]> {
  const rows = await listAccessibleDocuments(user, {
    readyOnly: opts?.readyOnly ?? true,
    limit: 500,
  });
  return rows.map((r) => r.id);
}

/**
 * Any authenticated user may read company documents.
 * Write operations stay admin-only at the route layer.
 */
export async function requireDocumentAccess(
  _user: AccessUser,
  documentId: string,
): Promise<{
  supabase: ReturnType<typeof getSupabaseAdmin>;
  document: KnowledgeRow;
}> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    throw new ApiError(400, "Invalid document id", "validation_error");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("knowledge_base")
    .select(
      "id, document_name, file_type, file_size, status, file_path, uploaded_by, created_at, updated_at, error_message, vector_collection_ref",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, "Document not found", "not_found");
  return { supabase, document: data as KnowledgeRow };
}

/**
 * Chat / search scope over the shared company library (ready docs).
 * Optional collection / single-document filters still apply.
 */
export async function resolveReadableDocumentScope(
  user: AccessUser,
  opts?: {
    documentId?: string;
    collectionDocumentIds?: string[];
  },
): Promise<{ documentId?: string; documentIds: string[] }> {
  const accessible = await getAccessibleDocumentIds(user, { readyOnly: true });
  const allowed = new Set(accessible);

  if (opts?.documentId) {
    if (!allowed.has(opts.documentId)) {
      throw new ApiError(404, "Document not found", "not_found");
    }
    return { documentId: opts.documentId, documentIds: [opts.documentId] };
  }

  let scope = accessible;
  if (opts?.collectionDocumentIds) {
    scope = opts.collectionDocumentIds.filter((id) => allowed.has(id));
  }

  if (!scope.length) {
    throw new ApiError(
      400,
      "No company documents are ready yet. An admin must upload and index documents first.",
      "empty_scope",
    );
  }

  return { documentIds: scope };
}
