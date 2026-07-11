"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bot,
  Copy,
  Download,
  MessageSquarePlus,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CitationCard } from "@/components/chat/citation-card";
import { DocViewerModal } from "@/components/document/doc-viewer-modal";
import type { Citation, ConfidenceLevel, ConversationSummary } from "@/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: number | null;
  confidenceLevel?: ConfidenceLevel;
  followUps?: string[];
};

type CollectionOption = {
  id: string;
  name: string;
  document_count?: number;
};

function levelFromScore(score?: number | null): ConfidenceLevel {
  if (score == null || score <= 0) return "none";
  if (score >= 0.72) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function confidenceLabel(level: ConfidenceLevel) {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  if (level === "low") return "Low confidence";
  return "No sources";
}

function exportMarkdown(content: string, citations?: Citation[]) {
  const lines = [
    content,
    "",
    "## Sources",
    ...(citations?.length
      ? citations.map(
          (c) =>
            `- ${c.document_name}${c.page != null ? ` (p. ${c.page})` : ""}: ${c.snippet}`,
        )
      : ["- None"]),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "answer.md";
  a.click();
  URL.revokeObjectURL(url);
}

export function ChatPanel({
  documentId,
  showHistory = true,
  showCollectionPicker = true,
}: {
  documentId?: string;
  showHistory?: boolean;
  showCollectionPicker?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionId, setCollectionId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{
    documentId: string;
    page: number | null;
    snippet: string;
  } | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!showHistory) return;
    const res = await fetch("/api/conversations");
    const json = await res.json();
    if (res.ok) setConversations(json.conversations ?? []);
  }, [showHistory]);

  useEffect(() => {
    refreshConversations().catch(() => undefined);
    if (showCollectionPicker && !documentId) {
      fetch("/api/collections")
        .then((r) => r.json())
        .then((j) => setCollections(j.collections ?? []))
        .catch(() => undefined);
    }
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((j) => setSuggestions(j.suggestions ?? []))
      .catch(() => undefined);
  }, [documentId, refreshConversations, showCollectionPicker]);

  async function loadConversation(id: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load chat");
      setConversationId(id);
      setCollectionId(json.conversation?.collection_id ?? "");
      setMessages(
        (json.messages ?? []).map(
          (m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            citations?: Citation[];
            confidence?: number | null;
          }) => ({
            ...m,
            confidenceLevel: levelFromScore(m.confidence),
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setQuery("");
  }

  async function deleteConversation(id: string) {
    if (!confirm("Delete this conversation?")) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    if (conversationId === id) startNewChat();
    await refreshConversations();
  }

  async function sendQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          documentId,
          collectionId: !documentId && collectionId ? collectionId : undefined,
          conversationId: conversationId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Chat failed");

      if (json.conversationId) {
        setConversationId(json.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: json.answer,
          citations: json.citations ?? [],
          confidence: json.confidence,
          confidenceLevel: json.confidenceLevel ?? levelFromScore(json.confidence),
          followUps: json.followUps ?? [],
        },
      ]);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await sendQuery(query);
  }

  return (
    <>
      <div className={`grid gap-4 ${showHistory ? "lg:grid-cols-[220px_1fr]" : ""}`}>
        {showHistory ? (
          <Card className="h-[calc(100vh-10rem)] overflow-hidden">
            <CardHeader className="space-y-3 border-b border-zinc-100 p-4">
              <CardTitle className="text-base">Chats</CardTitle>
              <Button size="sm" className="w-full" onClick={startNewChat}>
                <MessageSquarePlus className="h-4 w-4" />
                New chat
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 overflow-y-auto p-2">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${
                    conversationId === c.id
                      ? "bg-zinc-900 text-white"
                      : "hover:bg-zinc-100"
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => loadConversation(c.id)}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    className={`shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 ${
                      conversationId === c.id
                        ? "hover:bg-zinc-700"
                        : "hover:bg-zinc-200"
                    }`}
                    onClick={() => deleteConversation(c.id)}
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!conversations.length ? (
                <p className="px-2 py-4 text-xs text-zinc-500">No saved chats yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="flex h-[calc(100vh-10rem)] flex-col">
          <CardHeader className="border-b border-zinc-100 space-y-3">
            <div>
              <CardTitle>Knowledge Chat</CardTitle>
              <p className="text-sm text-zinc-500">
                Ask questions — answers cite your uploaded documents.
              </p>
            </div>
            {showCollectionPicker && !documentId ? (
              <select
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                disabled={Boolean(conversationId)}
              >
                <option value="">All documents</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.document_count != null ? ` (${c.document_count})` : ""}
                  </option>
                ))}
              </select>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-0">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {(suggestions.length ? suggestions : ["What is the leave policy?"]).map(
                      (s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendQuery(s)}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-xs text-zinc-700 hover:border-zinc-400 hover:bg-white"
                        >
                          {s}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" ? (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 bg-white text-zinc-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                        <Badge>
                          {confidenceLabel(m.confidenceLevel ?? "none")}
                          {m.confidence != null && m.confidence > 0
                            ? ` · ${(m.confidence * 100).toFixed(0)}%`
                            : ""}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(m.content)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => exportMarkdown(m.content, m.citations)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </Button>
                      </div>
                    ) : null}
                    {m.citations && m.citations.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                        <Badge>Sources</Badge>
                        {m.citations.map((c) => (
                          <CitationCard
                            key={`${c.document_id}-${c.page}-${c.snippet.slice(0, 12)}`}
                            citation={c}
                            onOpen={(citation) =>
                              setViewer({
                                documentId: citation.document_id,
                                page: citation.page,
                                snippet: citation.snippet,
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                    {m.followUps && m.followUps.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                        {m.followUps.map((f) => (
                          <button
                            key={f}
                            type="button"
                            disabled={loading}
                            onClick={() => sendQuery(f)}
                            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 hover:bg-white"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {m.role === "user" ? (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200">
                      <User className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <p className="text-sm text-zinc-500">Searching knowledge base…</p>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <form onSubmit={onSubmit} className="border-t border-zinc-100 p-4">
              <div className="flex gap-2">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about company policies, processes, docs…"
                  className="min-h-[52px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="h-[52px] px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

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
