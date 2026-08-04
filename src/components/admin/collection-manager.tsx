"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Collection = {
  id: string;
  name: string;
  description: string | null;
  document_ids: string[];
  document_count: number;
};

type Doc = {
  id: string;
  document_name: string;
  status: string;
};

export function CollectionManager({
  collections: initial,
  documents,
}: {
  collections: Collection[];
  documents: Doc[];
}) {
  const t = useTranslations("CollectionManager");
  const router = useRouter();
  const confirm = useConfirm();
  const [collections, setCollections] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const readyDocs = useMemo(
    () => documents.filter((d) => d.status === "ready"),
    [documents],
  );

  function toggleDoc(id: string) {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function createCollection(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          documentIds: selectedDocs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("createFailed"));
      setCollections((prev) => [...prev, json.collection]);
      setName("");
      setDescription("");
      setSelectedDocs([]);
      toast.success(t("collectionCreated"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("createFailed");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDocs(id: string, documentIds: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("updateFailed"));
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? json.collection : c)),
      );
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("deleteFailed"));
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast.success(t("collectionDeleted"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("deleteFailed");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        onSubmit={createCollection}
        className="space-y-3 rounded-2xl border border-border bg-surface p-4"
      >
        <p className="text-sm font-medium text-foreground">{t("createTitle")}</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          required
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
        />
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface-muted/50 p-2">
          {readyDocs.map((d) => (
            <label
              key={d.id}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground hover:bg-surface"
            >
              <input
                type="checkbox"
                checked={selectedDocs.includes(d.id)}
                onChange={() => toggleDoc(d.id)}
                className="shrink-0"
              />
              <span className="truncate">{d.document_name}</span>
            </label>
          ))}
          {!readyDocs.length ? (
            <p className="text-xs text-text-secondary">{t("noReadyDocuments")}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          {t("createButton")}
        </Button>
      </form>

      <div className="space-y-3">
        {collections.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-border bg-surface px-4 py-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.name}
                </p>
                {c.description ? (
                  <p className="text-xs text-text-secondary">{c.description}</p>
                ) : null}
                <div className="mt-2">
                  <Badge>{t("docsCount", { count: c.document_count })}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(editingId === c.id ? null : c.id);
                    setSelectedDocs(c.document_ids ?? []);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  {t("editDocs")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {editingId === c.id ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {readyDocs.map((d) => (
                    <label
                      key={d.id}
                      className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground hover:bg-surface-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(d.id)}
                        onChange={() => toggleDoc(d.id)}
                        className="shrink-0"
                      />
                      <span className="truncate">{d.document_name}</span>
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => saveDocs(c.id, selectedDocs)}
                >
                  {t("saveDocuments")}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {!collections.length ? (
          <p className="text-sm text-text-secondary">{t("noCollections")}</p>
        ) : null}
      </div>
    </div>
  );
}
