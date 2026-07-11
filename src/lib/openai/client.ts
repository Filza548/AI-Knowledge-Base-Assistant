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

  const response = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
