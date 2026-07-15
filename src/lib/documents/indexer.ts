import { chunkPages } from "@/lib/documents/chunking";
import { parseDocument } from "@/lib/documents/document-parser";
import { embedTexts } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function indexDocument(
  documentId: string,
  buffer: Buffer,
  fileType: "pdf" | "docx",
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    const pages = await parseDocument(buffer, fileType);
    const chunks = chunkPages(pages);

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

    const embeddings = await embedTexts(chunks.map((c) => c.text));

    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    const rows = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: chunk.chunkIndex ?? index,
      content: chunk.text,
      page_number: chunk.pageNumber,
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
