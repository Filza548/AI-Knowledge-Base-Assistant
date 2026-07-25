"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client-api";
import { toast } from "sonner";

type Stage = "idle" | "uploading" | "indexing" | "done" | "failed";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function DocumentUploader({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedId, setLastFailedId] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length) {
        const reason = rejections[0]?.errors[0];
        if (reason?.code === "file-too-large") {
          setError("File is too large (max 20MB)");
        } else if (reason?.code === "file-invalid-type") {
          setError("Only PDF and DOCX files are allowed");
        } else {
          setError(reason?.message ?? "File rejected");
        }
        setFile(null);
        setStage("failed");
        setMessage(null);
        setLastFailedId(null);
        return;
      }

      setFile(accepted[0] ?? null);
      setError(null);
      setMessage(null);
      setStage("idle");
      setLastFailedId(null);
    },
    [],
  );

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

  async function pollUntilSettled(documentId: string) {
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const res = await apiFetch(`/api/documents/${documentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not check index status");
      const status = json.document?.status as string | undefined;
      if (status === "ready") return json.document;
      if (status === "failed") {
        const err = new Error(
          json.document?.error_message ?? "Indexing failed",
        ) as Error & { documentId?: string };
        // Old Vercel pdf-parse failures — tell user to retry after fix deploy
        if (/pdf-parse|DOMMatrix/i.test(err.message)) {
          err.message =
            "PDF indexing failed on the old server build. Click Retry reindex (or upload again).";
        }
        err.documentId = documentId;
        throw err;
      }
    }
    throw new Error("Indexing is taking too long — refresh Admin to check status");
  }

  async function upload() {
    if (!file) return;
    setStage("uploading");
    setError(null);
    setMessage("Uploading file…");
    setLastFailedId(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await apiFetch("/api/documents", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      const doc = json.document;
      if (!doc?.id) throw new Error("Upload succeeded but no document was returned");

      if (doc.status === "failed") {
        setStage("failed");
        setLastFailedId(doc.id);
        const msg = doc.error_message ?? "Indexing failed";
        setError(msg);
        setMessage(null);
        toast.error(msg);
        return;
      }

      if (doc.status === "processing" || doc.status === "ready") {
        if (doc.status === "processing") {
          setStage("indexing");
          setMessage("Indexing & embedding in the background…");
          toast.message("Indexing document…");
          const ready = await pollUntilSettled(doc.id);
          setStage("done");
          setMessage(`Ready: ${ready.document_name}`);
          toast.success(`Ready: ${ready.document_name}`);
        } else {
          setStage("done");
          setMessage(`Ready: ${doc.document_name}`);
          toast.success(`Ready: ${doc.document_name}`);
        }
        setFile(null);
        onUploaded?.();
        router.refresh();
        return;
      }

      setStage("done");
      setMessage(`Uploaded: ${doc.document_name}`);
      toast.success(`Uploaded: ${doc.document_name}`);
      setFile(null);
      onUploaded?.();
      router.refresh();
    } catch (err) {
      setStage("failed");
      const failedId =
        err && typeof err === "object" && "documentId" in err
          ? String((err as { documentId?: string }).documentId)
          : null;
      if (failedId) setLastFailedId(failedId);
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setMessage(null);
      toast.error(message);
    }
  }

  async function retryReindex() {
    if (!lastFailedId) return;
    setStage("indexing");
    setError(null);
    setMessage("Re-indexing…");
    try {
      const res = await apiFetch(`/api/documents/${lastFailedId}/reindex`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Reindex failed");
      setStage("done");
      setMessage("Reindex complete");
      setLastFailedId(null);
      toast.success("Reindex complete");
      router.refresh();
    } catch (err) {
      setStage("failed");
      const message = err instanceof Error ? err.message : "Reindex failed";
      setError(message);
      toast.error(message);
    }
  }

  const busy = stage === "uploading" || stage === "indexing";

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-2xl border border-dashed border-border bg-surface-muted/60 p-6 text-center transition-all sm:p-10",
          isDragActive &&
            "upload-pulse border-primary bg-primary/5 shadow-sm shadow-primary/10",
        )}
      >
        <input {...getInputProps()} aria-label="Upload PDF or DOCX" />
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-sm font-semibold">
          {isDragActive
            ? "Drop file here"
            : "Drop PDFs or DOCX — we’ll index them for search and chat"}
        </p>
        <p className="mt-1 text-xs text-text-secondary">Max 20MB · PDF / DOCX</p>
      </div>

      {file ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{file.name}</span>
          </div>
          <Button
            onClick={upload}
            disabled={busy}
            className="w-full shrink-0 sm:w-auto"
          >
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
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full animate-pulse rounded-full bg-primary ${
                stage === "uploading" ? "w-1/3" : "w-2/3"
              }`}
            />
          </div>
          <p className="text-xs text-text-secondary">
            {stage === "uploading"
              ? "Uploading to storage…"
              : "Embedding chunks — you can leave this page open"}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-danger">{error}</p>
          {lastFailedId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={retryReindex}
              disabled={busy}
            >
              Retry reindex
            </Button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
