"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Doc = {
  id: string;
  document_name: string;
  status: string;
  file_type: string;
  created_at: string;
  error_message?: string | null;
};

export function DocumentAdminList({ documents }: { documents: Doc[] }) {
  const t = useTranslations("DocumentAdminList");
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("deleteFailed"));
      toast.success(t("documentDeleted"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("deleteFailed");
      setError(message);
      toast.error(message);
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
      if (!res.ok) throw new Error(json?.error ?? t("reindexFailed"));
      toast.success(t("reindexComplete"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("reindexFailed");
      setError(message);
      toast.error(message);
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
                  ? t("oldPdfEngineFailed")
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
                <span className="sm:inline">{t("reindex")}</span>
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
              <span className="sm:inline">{t("delete")}</span>
            </Button>
          </div>
        </div>
      ))}
      {!documents.length ? (
        <p className="text-sm text-text-secondary">{t("noDocuments")}</p>
      ) : null}
    </div>
  );
}
