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
          "cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center transition-colors",
          isDragActive && "border-zinc-900 bg-zinc-100",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop file here" : "Drag & drop PDF or DOCX"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Max 20MB</p>
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
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
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-zinc-900" />
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {lastFailedId ? (
            <Button size="sm" variant="outline" onClick={retryReindex} disabled={busy}>
              Retry reindex
            </Button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  );
}
