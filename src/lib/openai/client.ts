import OpenAI from "openai";
import { getEnv } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const env = getEnv();
  const openai = getOpenAI();
  const batchSize = 96;
  const embeddings: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: batch,
    });
    for (const row of response.data) {
      embeddings[i + row.index] = row.embedding;
    }
  }

  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
