"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocViewerModal } from "@/components/document/doc-viewer-modal";
import { selectFieldClassName } from "@/lib/field-styles";
import { apiFetch } from "@/lib/client-api";

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
  const t = useTranslations("Search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [viewer, setViewer] = useState<{
    documentId: string;
    page: number | null;
    snippet: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    apiFetch("/api/collections")
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setCollections(j.collections ?? []);
      })
      .catch(() => undefined);

    return () => abortRef.current?.abort();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await apiFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          collectionId: collectionId || undefined,
        }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("searchFailed"));
      setResults(json.results ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : t("searchFailed"));
      setResults([]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="search-collection" className="sr-only">
              {t("collectionFilterSrLabel")}
            </label>
            <select
              id="search-collection"
              className={`${selectFieldClassName} h-10 sm:w-48`}
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">{t("allDocuments")}</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.document_count != null ? ` (${c.document_count})` : ""}
                </option>
              ))}
            </select>
            <label htmlFor="search-query" className="sr-only">
              {t("searchQuerySrLabel")}
            </label>
            <Input
              id="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? t("searching") : t("search")}
            </Button>
          </form>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2" aria-live="polite">
            {loading ? (
              <p className="text-sm text-text-secondary">{t("searchingKnowledgeBase")}</p>
            ) : null}
            {!loading && hasSearched && results.length === 0 && !error ? (
              <p className="rounded-xl border border-dashed border-border bg-surface-muted/50 p-4 text-sm text-text-secondary">
                {t("noResults", { query: query.trim() })}
              </p>
            ) : null}
            {!loading && results.length > 0 ? (
              <p className="text-xs text-text-secondary">
                {t("resultCount", { count: results.length })}
              </p>
            ) : null}
            {results.map((r) => (
              <button
                key={`${r.document_id}-${r.page}-${r.snippet.slice(0, 24)}`}
                type="button"
                className="w-full rounded-xl border border-border bg-surface p-3 text-start text-sm transition-colors hover:border-primary/40 hover:bg-surface-muted"
                onClick={() =>
                  setViewer({
                    documentId: r.document_id,
                    page: r.page,
                    snippet: r.snippet,
                  })
                }
              >
                <p className="break-words font-medium text-foreground">
                  {r.citation}
                </p>
                <p className="mt-1 line-clamp-3 break-words text-text-secondary">
                  {r.snippet}
                </p>
                <p className="mt-1 text-xs text-text-secondary/80">
                  {t("matchOpenSource", {
                    percent: (r.similarity * 100).toFixed(0),
                  })}
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
