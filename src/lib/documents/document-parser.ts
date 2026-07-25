export interface ParsedPage {
  pageNumber: number | null;
  text: string;
}

export async function parseDocument(
  buffer: Buffer,
  fileType: "pdf" | "docx",
): Promise<ParsedPage[]> {
  if (fileType === "pdf") {
    return parsePdf(buffer);
  }

  if (fileType === "docx") {
    return parseDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  // unpdf ships a serverless PDF.js build (no canvas / DOMMatrix dependency).
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: false,
  });

  const pages = Array.isArray(text) ? text : [text];
  return pages
    .map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText ?? "",
    }))
    .filter((page) => page.text.trim().length > 0);
}

async function parseDocx(buffer: Buffer): Promise<ParsedPage[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return [{ pageNumber: null, text: result.value }];
}
