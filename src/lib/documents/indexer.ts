import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embedTexts } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** LangChain splitter — ~1000 chars with overlap (MVP-friendly chunking). */
export async function chunkText(text: string): Promise<string[]> {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!cleaned) return [];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  return splitter.splitText(cleaned);
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: "pdf" | "docx",
): Promise<string> {
  if (fileType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

export async function indexDocument(
  documentId: string,
  buffer: Buffer,
  fileType: "pdf" | "docx",
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    const text = await extractTextFromBuffer(buffer, fileType);
    const chunks = await chunkText(text);

    if (chunks.length === 0) {
      await supabase
        .from("knowledge_base")
        .update({
          status: "failed",
          error_message: "No extractable text found in document",
        })
        .eq("id", documentId);
      return;
    }

    const embeddings = await embedTexts(chunks);

    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    const rows = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_index: index,
      content,
      page_number: null as number | null,
      embedding: embeddings[index],
    }));

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("document_chunks").insert(batch);
      if (error) throw error;
    }

    await supabase
      .from("knowledge_base")
      .update({
        status: "ready",
        vector_collection_ref: `document_chunks:${documentId}`,
        error_message: null,
      })
      .eq("id", documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    await supabase
      .from("knowledge_base")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);
    throw err;
  }
}
