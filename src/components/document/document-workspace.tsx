"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/chat/chat-panel";

type Doc = {
  id: string;
  document_name: string;
  status: string;
  file_type: string;
  created_at: string;
};

export function DocumentWorkspace({ documents }: { documents: Doc[] }) {
  const [selected, setSelected] = useState<Doc | null>(documents[0] ?? null);
  const [summary, setSummary] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<string | null>(null);
  const [loading, setLoading] = useState<"summary" | "extract" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "summarize" | "extract") {
    if (!selected) return;
    setLoading(action === "summarize" ? "summary" : "extract");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${selected.id}/${action}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      if (action === "summarize") setSummary(json.summary);
      else setMetadata(json.extraction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  if (!documents.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-semibold tracking-tight">No documents yet</p>
          <p className="max-w-md text-sm text-text-secondary">
            An admin needs to upload and index company PDFs or DOCX. Once status
            is ready, everyone can summarize, extract metadata, and ask questions
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit max-lg:max-h-64">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="max-h-48 space-y-2 overflow-y-auto lg:max-h-none">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                setSelected(doc);
                setSummary(null);
                setMetadata(null);
              }}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                selected?.id === doc.id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-foreground hover:bg-surface-muted"
              }`}
            >
              <p className="truncate font-medium">{doc.document_name}</p>
              <p
                className={
                  selected?.id === doc.id
                    ? "text-white/70"
                    : "text-text-secondary"
                }
              >
                {doc.file_type.toUpperCase()} · {doc.status}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {selected ? (
          <>
            <Card>
              <CardHeader className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="break-words">
                    {selected.document_name}
                  </CardTitle>
                  <Badge className="mt-2">{selected.status}</Badge>
                  {selected.status !== "ready" ? (
                    <p className="mt-2 text-xs text-text-secondary">
                      Wait until status is <strong>ready</strong> before
                      summarize / extract / chat.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading !== null || selected.status !== "ready"}
                    onClick={() => run("summarize")}
                    className="flex-1 sm:flex-none"
                  >
                    {loading === "summary" ? "Summarizing…" : "Summarize"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading !== null || selected.status !== "ready"}
                    onClick={() => run("extract")}
                    className="flex-1 sm:flex-none"
                  >
                    {loading === "extract" ? "Extracting…" : "Extract Metadata"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Summary
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-text-secondary">
                    {summary ?? "Click Summarize to generate bullet points."}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Metadata
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-text-secondary">
                    {metadata ??
                      "Click Extract Metadata for structured fields."}
                  </p>
                </div>
                {error ? (
                  <p className="text-sm text-danger md:col-span-2" role="alert">
                    {error}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <ChatPanel
              key={selected.id}
              documentId={selected.id}
              showHistory={false}
              showCollectionPicker={false}
              readyDocumentCount={selected.status === "ready" ? 1 : 0}
            />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-text-secondary">
              Select a document to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
