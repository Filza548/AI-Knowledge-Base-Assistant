import { getEnv } from "@/lib/env";
import { getOpenAI, embedQuery } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  Citation,
  ConfidenceLevel,
  DocumentChunkMatch,
  RagAnswer,
} from "@/types";

export type RetrieveOptions = {
  documentId?: string;
  documentIds?: string[];
  matchCount?: number;
};

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AnswerOptions = RetrieveOptions & {
  /** Prior turns for multi-turn chat (not used for retrieval). */
  history?: ChatHistoryTurn[];
  /** Second LLM call — keep off the critical path unless explicitly requested. */
  includeFollowUps?: boolean;
};

/** Cosine distance cutoff. distance = 1 - similarity. */
const MAX_RELEVANT_DISTANCE = 0.72; // keep chunks with similarity >= ~0.28
/** If nothing clears the main cutoff, still use these weaker-but-best hits. */
const MIN_FALLBACK_SIMILARITY = 0.18;
const DEFAULT_MATCH_COUNT = 10;

const SYSTEM_PROMPT = `You are an internal knowledge assistant embedded in a company dashboard.

- If the user's message is a greeting, thanks, or casual small talk (e.g. "hi", "hello", "thank you"), reply briefly and warmly in your own words. Do not mention documents, context, or citations for these.
- For substantive questions, answer using ONLY the context excerpts provided below.
- Synthesize a clear, helpful answer from related excerpts — paraphrase is fine. Combine multiple excerpts when needed.
- Prefer answering when the context is even partially related to the question. Do not refuse just because the wording differs.
- Every claim in a substantive answer must cite its source inline in the format (Source: <document name>, Page <page number>). If a chunk has no page number, cite just (Source: <document name>).
- Only if the context is empty or clearly unrelated, respond exactly: "I can only answer questions related to the documentation."
- Never invent facts that are not supported by the context.`;

const NOT_FOUND_ANSWER =
  "I can only answer questions related to the documentation.";

function confidenceLevel(score: number): ConfidenceLevel {
  if (score <= 0) return "none";
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function isSubstantiveChunk(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length >= 20;
}

function selectRelevantMatches(
  matches: DocumentChunkMatch[],
): DocumentChunkMatch[] {
  const primary = matches.filter((m) => {
    const distance = 1 - (m.similarity ?? 0);
    return distance <= MAX_RELEVANT_DISTANCE;
  });

  let selected =
    primary.length > 0
      ? primary
      : matches
          .filter((m) => (m.similarity ?? 0) >= MIN_FALLBACK_SIMILARITY)
          .slice(0, 6);

  // Prefer longer excerpts when available (title/contact lines often score high but lack substance).
  const substantive = selected.filter((m) => isSubstantiveChunk(m.content));
  if (substantive.length >= 2) {
    selected = substantive;
  }

  return selected.slice(0, DEFAULT_MATCH_COUNT);
}

function buildCitations(matches: DocumentChunkMatch[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const m of matches) {
    const key = `${m.document_id}:${m.page_number ?? "na"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      document_id: m.document_id,
      document_name: m.document_name,
      page: m.page_number,
      snippet: m.content.slice(0, 240),
    });
  }

  return citations;
}

function buildContextBlock(matches: DocumentChunkMatch[]): string {
  return matches
    .map((m, i) => {
      const location = m.page_number != null ? `, Page ${m.page_number}` : "";
      return `[Excerpt ${i + 1}] (Source: ${m.document_name}${location})\n${m.content}`;
    })
    .join("\n\n");
}

export async function resolveCollectionDocumentIds(
  collectionId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("collection_documents")
    .select("document_id")
    .eq("collection_id", collectionId);

  if (error) throw error;
  return (data ?? []).map((row) => row.document_id as string);
}

export async function retrieveChunks(
  query: string,
  documentIdOrOptions?: string | RetrieveOptions,
  matchCountArg = DEFAULT_MATCH_COUNT,
): Promise<DocumentChunkMatch[]> {
  const opts: RetrieveOptions =
    typeof documentIdOrOptions === "string" || documentIdOrOptions == null
      ? { documentId: documentIdOrOptions, matchCount: matchCountArg }
      : documentIdOrOptions;

  const embedding = await embedQuery(query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: Math.max(opts.matchCount ?? matchCountArg, DEFAULT_MATCH_COUNT),
    filter_document_id: opts.documentId ?? null,
    filter_document_ids: opts.documentIds?.length ? opts.documentIds : null,
  });

  if (error) throw error;

  return selectRelevantMatches((data ?? []) as DocumentChunkMatch[]);
}

async function generateFollowUps(
  query: string,
  answer: string,
  citations: Citation[],
): Promise<string[]> {
  if (!citations.length) return [];
  if (answer === NOT_FOUND_ANSWER) return [];

  try {
    const openai = getOpenAI();
    const env = getEnv();
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            'Suggest exactly 3 short follow-up questions the user might ask next, grounded in the answer and sources. Return JSON only: {"followUps":["..."]}',
        },
        {
          role: "user",
          content: `Question: ${query}\nAnswer: ${answer.slice(0, 1500)}\nSources: ${citations
            .map((c) => c.document_name)
            .join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { followUps?: unknown };
    if (!Array.isArray(parsed.followUps)) return [];
    return parsed.followUps
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim().slice(0, 160))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function answerWithRag(
  query: string,
  options?: string | AnswerOptions,
): Promise<RagAnswer> {
  const opts: AnswerOptions =
    typeof options === "string" || options == null
      ? { documentId: options }
      : options;

  const matches = await retrieveChunks(query, opts);
  const citations = buildCitations(matches);
  const confidence =
    matches.length > 0
      ? Math.max(...matches.map((m) => m.similarity ?? 0))
      : 0;

  const context =
    matches.length > 0
      ? buildContextBlock(matches)
      : "(No relevant documents were found in the knowledge base for this query.)";

  const openai = getOpenAI();
  const env = getEnv();

  const history = (opts.history ?? [])
    .filter((t) => t.content?.trim())
    .slice(-6)
    .map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content.slice(0, 4000),
    }));

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.35,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${query}\n\nWrite a clear answer from the context above. If the context is related, answer helpfully with citations.`,
      },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() || NOT_FOUND_ANSWER;

  const isNotFound =
    answer === NOT_FOUND_ANSWER ||
    answer.toLowerCase().includes("only answer questions related to the documentation") ||
    answer.toLowerCase().includes("couldn't find this information");
  const finalCitations = isNotFound ? [] : citations;
  const finalConfidence = isNotFound ? 0 : confidence;
  const followUps = opts.includeFollowUps
    ? await generateFollowUps(query, answer, finalCitations)
    : [];

  return {
    answer,
    citations: finalCitations,
    confidence: finalConfidence,
    confidenceLevel: confidenceLevel(finalConfidence),
    followUps,
  };
}

export async function summarizeDocument(documentId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("content, page_number")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) throw error;
  if (!chunks?.length) {
    return "No indexed content available for this document yet.";
  }

  const text = chunks.map((c) => c.content).join("\n\n").slice(0, 24000);
  const openai = getOpenAI();
  const env = getEnv();

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Summarize the document in concise bullet points. Stay faithful to the source.",
      },
      { role: "user", content: text },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "No summary.";
}

export async function extractDocumentInfo(
  documentId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) throw error;
  if (!chunks?.length) {
    return "No indexed content available for this document yet.";
  }

  const text = chunks.map((c) => c.content).join("\n\n").slice(0, 24000);
  const openai = getOpenAI();
  const env = getEnv();

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Extract structured metadata from the document using these fields when possible: Effective Date, Department, Responsibilities, Version, Review Date, Active Clauses. Use bullet points. If unknown, write N/A.",
      },
      { role: "user", content: text },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "No extraction.";
}
