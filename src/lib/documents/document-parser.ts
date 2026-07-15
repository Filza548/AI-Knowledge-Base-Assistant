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
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text,
    }));
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedPage[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return [{ pageNumber: null, text: result.value }];
}
