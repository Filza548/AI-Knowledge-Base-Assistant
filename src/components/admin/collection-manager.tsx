"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const router = useRouter();
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
      if (!res.ok) throw new Error(json?.error ?? "Create failed");
      setCollections((prev) => [...prev, json.collection]);
      setName("");
      setDescription("");
      setSelectedDocs([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
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
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? json.collection : c)),
      );
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this collection?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      setCollections((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form onSubmit={createCollection} className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <p className="text-sm font-medium">Create collection</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. HR Policies)"
          required
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-zinc-100 p-2">
          {readyDocs.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedDocs.includes(d.id)}
                onChange={() => toggleDoc(d.id)}
              />
              {d.document_name}
            </label>
          ))}
          {!readyDocs.length ? (
            <p className="text-xs text-zinc-500">No ready documents yet.</p>
          ) : null}
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          Create collection
        </Button>
      </form>

      <div className="space-y-3">
        {collections.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                {c.description ? (
                  <p className="text-xs text-zinc-500">{c.description}</p>
                ) : null}
                <div className="mt-2">
                  <Badge>{c.document_count} docs</Badge>
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
                >
                  Edit docs
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
              <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {readyDocs.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(d.id)}
                        onChange={() => toggleDoc(d.id)}
                      />
                      {d.document_name}
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => saveDocs(c.id, selectedDocs)}
                >
                  Save documents
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {!collections.length ? (
          <p className="text-sm text-zinc-500">No collections yet.</p>
        ) : null}
      </div>
    </div>
  );
}
