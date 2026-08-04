"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewerState = {
  url: string;
  fileType: string;
  documentName: string;
} | null;

export function DocViewerModal({
  documentId,
  page,
  snippet,
  open,
  onClose,
}: {
  documentId: string | null;
  page?: number | null;
  snippet?: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("DocViewer");
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<ViewerState>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setState(null);

    fetch(`/api/documents/${documentId}/file`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? t("couldNotOpen"));
        if (!cancelled) {
          setState({
            url: json.url,
            fileType: json.fileType,
            documentName: json.documentName,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("couldNotOpen"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const viewerUrl =
    state?.fileType === "pdf" && page
      ? `${state.url}#page=${page}`
      : state?.url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-dvh w-full max-w-5xl flex-col overflow-hidden rounded-none border-0 border-border bg-surface shadow-xl sm:h-[90vh] sm:rounded-2xl sm:border"
      >
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <p
              id={titleId}
              className="truncate text-sm font-medium text-foreground"
            >
              {state?.documentName ?? t("documentFallback")}
              {page != null ? t("page", { page }) : ""}
            </p>
            {snippet ? (
              <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
                {snippet}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {state?.url ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={state.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("open")}</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={state.url} download={state.documentName}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("download")}</span>
                  </a>
                </Button>
              </>
            ) : null}
            <Button
              ref={closeRef}
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label={t("closeViewer")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 bg-surface-muted/40">
          {loading ? (
            <p className="p-6 text-sm text-text-secondary">{t("loading")}</p>
          ) : null}
          {error ? (
            <p className="p-6 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {state?.fileType === "pdf" && viewerUrl ? (
            <iframe
              title={state.documentName}
              src={viewerUrl}
              className="h-full w-full border-0"
            />
          ) : null}
          {state?.fileType === "docx" && state.url ? (
            <div className="space-y-4 p-6">
              <p className="text-sm text-text-secondary">
                {t("docxPreviewLimited")}
              </p>
              {snippet ? (
                <blockquote className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
                  {snippet}
                </blockquote>
              ) : null}
              <Button asChild>
                <a href={state.url} download={state.documentName}>
                  <Download className="h-4 w-4" />
                  {t("downloadDocx")}
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
