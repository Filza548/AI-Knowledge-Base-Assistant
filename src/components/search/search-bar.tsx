"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocViewerModal } from "@/components/document/doc-viewer-modal";
import { selectFieldClassName } from "@/lib/field-styles";

type SearchResult = {
  document_id: string;
  document_name: string;
  page: number | null;
  snippet: string;
  similarity: number;
  citation: string;
};

type CollectionOption = {
  id: string;
  name: string;
  document_count?: number;
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [viewer, setViewer] = useState<{
    documentId: string;
    page: number | null;
    snippet: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((j) => setCollections(j.collections ?? []))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          collectionId: collectionId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Search failed");
      setResults(json.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Semantic Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <select
              className={`${selectFieldClassName} h-10 sm:w-48`}
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">All documents</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.document_count != null ? ` (${c.document_count})` : ""}
                </option>
              ))}
            </select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across indexed documents…"
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="space-y-2">
            {results.map((r) => (
              <button
                key={`${r.document_id}-${r.page}-${r.snippet.slice(0, 24)}`}
                type="button"
                className="w-full rounded-xl border border-border bg-surface p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-surface-muted"
                onClick={() =>
                  setViewer({
                    documentId: r.document_id,
                    page: r.page,
                    snippet: r.snippet,
                  })
                }
              >
                <p className="font-medium text-foreground">{r.citation}</p>
                <p className="mt-1 text-text-secondary">{r.snippet}</p>
                <p className="mt-1 text-xs text-text-secondary/80">
                  Similarity: {(r.similarity * 100).toFixed(1)}% · Click to open
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <DocViewerModal
        open={Boolean(viewer)}
        documentId={viewer?.documentId ?? null}
        page={viewer?.page}
        snippet={viewer?.snippet}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
