"use client";

import { useEffect, useState } from "react";
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
        if (!res.ok) throw new Error(json?.error ?? "Could not open file");
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
          setError(err instanceof Error ? err.message : "Could not open file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  if (!open) return null;

  const viewerUrl =
    state?.fileType === "pdf" && page
      ? `${state.url}#page=${page}`
      : state?.url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {state?.documentName ?? "Document"}
              {page != null ? ` · Page ${page}` : ""}
            </p>
            {snippet ? (
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{snippet}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {state?.url ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={state.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={state.url} download={state.documentName}>
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              </>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 bg-zinc-50">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Loading document…</p>
          ) : null}
          {error ? <p className="p-6 text-sm text-red-600">{error}</p> : null}
          {state?.fileType === "pdf" && viewerUrl ? (
            <iframe title={state.documentName} src={viewerUrl} className="h-full w-full border-0" />
          ) : null}
          {state?.fileType === "docx" && state.url ? (
            <div className="space-y-4 p-6">
              <p className="text-sm text-zinc-600">
                In-browser DOCX preview is limited. Download the file, or use the cited snippet below.
              </p>
              {snippet ? (
                <blockquote className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                  {snippet}
                </blockquote>
              ) : null}
              <Button asChild>
                <a href={state.url} download={state.documentName}>
                  <Download className="h-4 w-4" />
                  Download DOCX
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
