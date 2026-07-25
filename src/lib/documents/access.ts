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

/** Admins may manage the full company library; everyone else only their uploads. */
export function canManageAllDocuments(role?: UserRole | string | null) {
  return role === "admin";
}

export async function listAccessibleDocuments(
  user: AccessUser,
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

  if (!canManageAllDocuments(user.role)) {
    query = query.eq("uploaded_by", user.id);
  }
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
 * Load a document only if the caller owns it (or is admin).
 * Returns 404 (not 403) to avoid leaking existence of others' files.
 */
export async function requireDocumentAccess(
  user: AccessUser,
  documentId: string,
): Promise<{
  supabase: ReturnType<typeof getSupabaseAdmin>;
  document: KnowledgeRow;
}> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    throw new ApiError(400, "Invalid document id", "validation_error");
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("knowledge_base")
    .select(
      "id, document_name, file_type, file_size, status, file_path, uploaded_by, created_at, updated_at, error_message, vector_collection_ref",
    )
    .eq("id", documentId);

  if (!canManageAllDocuments(user.role)) {
    query = query.eq("uploaded_by", user.id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Document not found", "not_found");
  return { supabase, document: data as KnowledgeRow };
}

/**
 * Constrain RAG / search to documents the user may read.
 * Collection filters are intersected with the caller's ACL.
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
      "No accessible documents in scope. Upload a document first.",
      "empty_scope",
    );
  }

  return { documentIds: scope };
}
