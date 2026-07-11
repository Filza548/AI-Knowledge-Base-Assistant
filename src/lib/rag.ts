/** Re-export RAG pipeline (architecture: lib/rag.ts). */
export {
  answerWithRag,
  retrieveChunks,
  resolveCollectionDocumentIds,
  summarizeDocument,
  extractDocumentInfo,
} from "@/lib/openai/rag";
