import type { ParsedPage } from "@/lib/documents/document-parser";

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number | null;
  text: string;
}

const CHUNK_SIZE_WORDS = 250;
const CHUNK_OVERLAP_WORDS = 40;

/** Page-aware word-window chunking (Safa RAG: 250 words / 40 overlap). */
export function chunkPages(pages: ParsedPage[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const words = page.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + CHUNK_SIZE_WORDS, words.length);
      const text = words.slice(start, end).join(" ");

      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        text,
      });

      if (end === words.length) break;
      start = end - CHUNK_OVERLAP_WORDS;
    }
  }

  return chunks;
}
