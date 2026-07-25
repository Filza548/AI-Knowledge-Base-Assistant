"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Doc = {
  id: string;
  document_name: string;
  status: string;
  file_type: string;
  created_at: string;
  error_message?: string | null;
};

export function DocumentAdminList({ documents }: { documents: Doc[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this document and its embeddings?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reindex(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/reindex`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Reindex failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reindex failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {doc.document_name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge>{doc.file_type}</Badge>
              <Badge>{doc.status}</Badge>
            </div>
            {doc.status === "failed" && doc.error_message ? (
              <p className="mt-1 break-words text-xs text-danger">
                {/pdf-parse|DOMMatrix/i.test(doc.error_message)
                  ? "Old PDF engine failed — click Reindex to process with the new fix."
                  : doc.error_message}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {(doc.status === "failed" || doc.status === "ready") && (
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === doc.id}
                onClick={() => reindex(doc.id)}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sm:inline">Reindex</span>
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={busyId === doc.id}
              onClick={() => remove(doc.id)}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      ))}
      {!documents.length ? (
        <p className="text-sm text-text-secondary">No documents uploaded yet.</p>
      ) : null}
    </div>
  );
}
