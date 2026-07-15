"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { LogoMark } from "@/components/brand/logo-mark";
import { selectFieldClassName } from "@/lib/field-styles";
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

function confidenceClass(level: ConfidenceLevel) {
  if (level === "high") return "border-accent/30 bg-accent/15 text-accent";
  if (level === "medium") return "border-primary/30 bg-primary/10 text-primary";
  if (level === "low") return "border-warning/30 bg-warning/10 text-warning";
  return "";
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-text-secondary">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface px-3 py-2">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
      </div>
    </div>
  );
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

  const chips =
    suggestions.length > 0
      ? suggestions
      : [
          "What is the leave policy?",
          "Summarize onboarding steps",
          "Where is the reimbursement process?",
        ];

  return (
    <>
      <div className={`grid gap-4 ${showHistory ? "lg:grid-cols-[240px_1fr]" : ""}`}>
        {showHistory ? (
          <Card className="h-[calc(100vh-10rem)] overflow-hidden">
            <CardHeader className="space-y-3 border-b border-border p-4">
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
                  className={`group flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition-colors ${
                    conversationId === c.id
                      ? "bg-primary text-white"
                      : "hover:bg-surface-muted"
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
                    className={`shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                      conversationId === c.id
                        ? "hover:bg-primary-hover"
                        : "hover:bg-border"
                    }`}
                    onClick={() => deleteConversation(c.id)}
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!conversations.length ? (
                <p className="px-2 py-4 text-xs text-text-secondary">
                  No saved chats yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden">
          <CardHeader className="space-y-3 border-b border-border">
            <div>
              <CardTitle>Knowledge Chat</CardTitle>
              <p className="text-sm text-text-secondary">
                Ask questions — answers cite your uploaded documents.
              </p>
            </div>
            {showCollectionPicker && !documentId ? (
              <select
                className={`${selectFieldClassName} h-10`}
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
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center gap-5 py-10 text-center"
                >
                  <LogoMark size={56} animated />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold tracking-tight">
                      Ask the knowledge base
                    </p>
                    <p className="max-w-md text-sm text-text-secondary">
                      The knowledge base is ready. Ask about policies, SOPs, or
                      product docs.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {chips.map((s, i) => (
                      <motion.button
                        key={s}
                        type="button"
                        custom={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.07 }}
                        onClick={() => sendQuery(s)}
                        className="rounded-full border border-border bg-surface-muted px-3.5 py-1.5 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-surface hover:shadow-sm"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : null}

              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.35 }}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "assistant" ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-chat-user text-foreground"
                          : "border border-border bg-chat-assistant text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.role === "assistant" ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
                        >
                          <Badge
                            className={confidenceClass(
                              m.confidenceLevel ?? "none",
                            )}
                          >
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
                        </motion.div>
                      ) : null}
                      {m.citations && m.citations.length > 0 ? (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <Badge className="border-primary/20 bg-primary/10 text-primary">
                            Sources
                          </Badge>
                          {m.citations.map((c, idx) => (
                            <motion.div
                              key={`${c.document_id}-${c.page}-${c.snippet.slice(0, 12)}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 * idx }}
                            >
                              <CitationCard
                                citation={c}
                                onOpen={(citation) =>
                                  setViewer({
                                    documentId: citation.document_id,
                                    page: citation.page,
                                    snippet: citation.snippet,
                                  })
                                }
                              />
                            </motion.div>
                          ))}
                        </div>
                      ) : null}
                      {m.followUps && m.followUps.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                          {m.followUps.map((f, i) => (
                            <motion.button
                              key={f}
                              type="button"
                              disabled={loading}
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.08 * i }}
                              onClick={() => sendQuery(f)}
                              className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-foreground hover:border-primary/40 hover:bg-surface"
                            >
                              {f}
                            </motion.button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {m.role === "user" ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                        <User className="h-4 w-4" />
                      </div>
                    ) : null}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading ? <TypingIndicator /> : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>

            <form onSubmit={onSubmit} className="border-t border-border p-4">
              <div className="flex gap-2">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask the knowledge base…"
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
                  aria-label="Send"
                >
                  <motion.span
                    animate={loading ? { rotate: 180 } : { rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="inline-flex"
                  >
                    <Send className="h-4 w-4" />
                  </motion.span>
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
