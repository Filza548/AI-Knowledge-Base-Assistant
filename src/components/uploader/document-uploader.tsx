"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stage = "idle" | "uploading" | "indexing" | "done" | "failed";

export function DocumentUploader({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedId, setLastFailedId] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFile(accepted[0] ?? null);
    setError(null);
    setMessage(null);
    setStage("idle");
    setLastFailedId(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
    },
    maxSize: 20 * 1024 * 1024,
  });

  async function upload() {
    if (!file) return;
    setStage("uploading");
    setError(null);
    setMessage("Uploading file…");
    setLastFailedId(null);
    const body = new FormData();
    body.append("file", file);
    try {
      setStage("indexing");
      setMessage("Indexing & embedding…");
      const res = await fetch("/api/documents", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      const doc = json.document;
      if (doc?.status === "failed") {
        setStage("failed");
        setLastFailedId(doc.id);
        setError(doc.error_message ?? "Indexing failed");
        setMessage(null);
        return;
      }

      setStage("done");
      setMessage(`Ready: ${doc.document_name}`);
      setFile(null);
      onUploaded?.();
      router.refresh();
    } catch (err) {
      setStage("failed");
      setError(err instanceof Error ? err.message : "Upload failed");
      setMessage(null);
    }
  }

  async function retryReindex() {
    if (!lastFailedId) return;
    setStage("indexing");
    setError(null);
    setMessage("Re-indexing…");
    try {
      const res = await fetch(`/api/documents/${lastFailedId}/reindex`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Reindex failed");
      setStage("done");
      setMessage("Reindex complete");
      setLastFailedId(null);
      router.refresh();
    } catch (err) {
      setStage("failed");
      setError(err instanceof Error ? err.message : "Reindex failed");
    }
  }

  const busy = stage === "uploading" || stage === "indexing";

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-2xl border border-dashed border-border bg-surface-muted/60 p-10 text-center transition-all",
          isDragActive && "upload-pulse border-primary bg-primary/5 shadow-sm shadow-primary/10",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-sm font-semibold">
          {isDragActive
            ? "Drop file here"
            : "Drop PDFs or DOCX — we’ll index them for search and chat"}
        </p>
        <p className="mt-1 text-xs text-text-secondary">Max 20MB · PDF / DOCX</p>
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span>{file.name}</span>
          </div>
          <Button onClick={upload} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {stage === "uploading" ? "Uploading…" : "Indexing…"}
              </>
            ) : (
              "Upload & embed"
            )}
          </Button>
        </div>
      ) : null}

      {busy ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-danger">{error}</p>
          {lastFailedId ? (
            <Button size="sm" variant="outline" onClick={retryReindex} disabled={busy}>
              Retry reindex
            </Button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
