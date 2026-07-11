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

function confidenceLevel(score: number): ConfidenceLevel {
  if (score <= 0) return "none";
  if (score >= 0.72) return "high";
  if (score >= 0.5) return "medium";
  return "low";
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
  matchCountArg = 5,
): Promise<DocumentChunkMatch[]> {
  const opts: RetrieveOptions =
    typeof documentIdOrOptions === "string" || documentIdOrOptions == null
      ? { documentId: documentIdOrOptions, matchCount: matchCountArg }
      : documentIdOrOptions;

  const embedding = await embedQuery(query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: opts.matchCount ?? matchCountArg,
    filter_document_id: opts.documentId ?? null,
    filter_document_ids: opts.documentIds?.length ? opts.documentIds : null,
  });

  if (error) throw error;
  return (data ?? []) as DocumentChunkMatch[];
}

async function generateFollowUps(
  query: string,
  answer: string,
  citations: Citation[],
): Promise<string[]> {
  if (!citations.length) return [];

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
            "Suggest exactly 3 short follow-up questions the user might ask next, grounded in the answer and sources. Return JSON only: {\"followUps\":[\"...\"]}",
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
  options?: string | RetrieveOptions,
): Promise<RagAnswer> {
  const retrieveOpts: RetrieveOptions =
    typeof options === "string" || options == null
      ? { documentId: options }
      : options;

  const matches = await retrieveChunks(query, retrieveOpts);
  const citations = buildCitations(matches);
  const confidence =
    matches.length > 0
      ? Math.max(...matches.map((m) => m.similarity ?? 0))
      : 0;

  if (matches.length === 0) {
    return {
      answer: "I couldn't find this information.",
      citations: [],
      confidence: 0,
      confidenceLevel: "none",
      followUps: [],
    };
  }

  const context = matches
    .map(
      (m, i) =>
        `[${i + 1}] Source: ${m.document_name}, Page ${m.page_number ?? "n/a"}\n${m.content}`,
    )
    .join("\n\n");

  const openai = getOpenAI();
  const env = getEnv();

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Answer ONLY using the provided context. " +
          'If the answer does not exist in the context, say: "I couldn\'t find this information." ' +
          "Always mention source filename and page number when available, like (Source: file.pdf, Page N).",
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${query}`,
      },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() || "No answer generated.";
  const followUps = await generateFollowUps(query, answer, citations);

  return {
    answer,
    citations,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
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
