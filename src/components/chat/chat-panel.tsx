"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Copy,
  Download,
  MessageSquarePlus,
  Send,
  Square,
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { selectFieldClassName } from "@/lib/field-styles";
import { apiFetch } from "@/lib/client-api";
import { toast } from "sonner";
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

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-2 text-sm text-text-secondary"
      aria-live="polite"
    >
      <span className="sr-only">Assistant is typing</span>
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
  readyDocumentCount,
}: {
  documentId?: string;
  showHistory?: boolean;
  showCollectionPicker?: boolean;
  readyDocumentCount?: number;
}) {
  const confirm = useConfirm();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
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

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadSeqRef = useRef(0);

  const refreshConversations = useCallback(async () => {
    if (!showHistory) return;
    const res = await apiFetch("/api/conversations");
    const json = await res.json();
    if (res.ok) setConversations(json.conversations ?? []);
  }, [showHistory]);

  useEffect(() => {
    refreshConversations().catch(() => undefined);
    if (showCollectionPicker && !documentId) {
      apiFetch("/api/collections")
        .then(async (r) => {
          if (!r.ok) return;
          const j = await r.json();
          setCollections(j.collections ?? []);
        })
        .catch(() => undefined);
    }
    apiFetch("/api/suggestions")
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setSuggestions(j.suggestions ?? []);
      })
      .catch(() => undefined);
  }, [documentId, refreshConversations, showCollectionPicker]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function loadConversation(id: string) {
    const seq = ++loadSeqRef.current;
    abortRef.current?.abort();
    setError(null);
    setLastFailedQuery(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/conversations/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load chat");
      if (seq !== loadSeqRef.current) return;
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
      if (seq !== loadSeqRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLastFailedQuery(null);
    setQuery("");
    setCollectionId("");
  }

  async function deleteConversation(id: string) {
    const ok = await confirm({
      title: "Delete this conversation?",
      description: "This chat and its messages will be removed permanently.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete conversation");
      toast.error("Could not delete conversation");
      return;
    }
    toast.success("Conversation deleted");
    if (conversationId === id) startNewChat();
    await refreshConversations();
  }

  function stopGenerating() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function sendQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = {
      id: newId(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    setError(null);
    setLastFailedQuery(null);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          documentId,
          collectionId: !documentId && collectionId ? collectionId : undefined,
          conversationId: conversationId ?? undefined,
        }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Chat failed");

      if (json.conversationId) {
        setConversationId(json.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: json.answer,
          citations: json.citations ?? [],
          confidence: json.confidence,
          confidenceLevel:
            json.confidenceLevel ?? levelFromScore(json.confidence),
          followUps: json.followUps ?? [],
        },
      ]);
      await refreshConversations();
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Generation stopped");
        return;
      }
      setLastFailedQuery(trimmed);
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await sendQuery(query);
  }

  const kbEmpty = readyDocumentCount === 0;
  const chips =
    kbEmpty
      ? []
      : suggestions.length > 0
        ? suggestions
        : [
            "What is the leave policy?",
            "Summarize onboarding steps",
            "Where is the reimbursement process?",
          ];

  return (
    <>
      <div
        className={`grid gap-4 ${showHistory ? "lg:grid-cols-[240px_1fr]" : ""}`}
      >
        {showHistory ? (
          <Card className="h-[calc(100dvh-10rem)] overflow-hidden max-lg:order-2 max-lg:h-auto max-lg:max-h-48 sm:max-lg:max-h-56">
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
                    className={`shrink-0 rounded p-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 ${
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
                  No saved chats yet. Ask a question to start one.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="flex h-[min(70dvh,32rem)] flex-col overflow-hidden max-lg:order-1 sm:h-[min(70dvh,36rem)] lg:h-[calc(100dvh-10rem)]">
          <CardHeader className="space-y-3 border-b border-border">
            <div>
              <CardTitle>Knowledge Chat</CardTitle>
              <p className="text-sm text-text-secondary">
                Ask questions — answers cite your uploaded documents.
              </p>
            </div>
            {showCollectionPicker && !documentId ? (
              <div className="space-y-1">
                <label htmlFor="chat-collection" className="sr-only">
                  Collection scope
                </label>
                <select
                  id="chat-collection"
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
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-0">
            <div
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6"
            >
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
                      {kbEmpty
                        ? "No indexed documents yet. Upload PDFs or DOCX from Documents — once status is ready, chat can answer from your knowledge base."
                        : "Ask about policies, SOPs, or product docs — answers include citations when sources exist."}
                    </p>
                  </div>
                  {chips.length > 0 ? (
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
                  ) : null}
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
                      <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white sm:flex">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[min(85%,28rem)] break-words rounded-2xl px-3 py-3 text-sm leading-relaxed sm:px-4 ${
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
                            onClick={() => {
                              void navigator.clipboard
                                ?.writeText(m.content)
                                .catch(() =>
                                  setError("Clipboard permission denied"),
                                );
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              exportMarkdown(m.content, m.citations)
                            }
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
                      <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted sm:flex">
                        <User className="h-4 w-4" />
                      </div>
                    ) : null}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading ? <TypingIndicator /> : null}
              {error ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-danger">{error}</p>
                  {lastFailedQuery && !loading ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => sendQuery(lastFailedQuery)}
                    >
                      Retry last question
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-border p-3 sm:p-4"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="chat-composer" className="sr-only">
                  Message
                </label>
                <Textarea
                  id="chat-composer"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask the knowledge base…"
                  className="min-h-[52px] min-w-0 flex-1 resize-none"
                  maxLength={4000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e);
                    }
                  }}
                />
                {loading ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[52px] shrink-0 px-4"
                    aria-label="Stop generating"
                    onClick={stopGenerating}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!query.trim()}
                    className="h-[52px] shrink-0 px-4"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
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
