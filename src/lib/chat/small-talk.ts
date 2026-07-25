import type { RagAnswer } from "@/types";

export type SmallTalkKind =
  | "greeting"
  | "thanks"
  | "goodbye"
  | "ack"
  | "help";

const SUGGESTIONS = [
  "What does our onboarding policy cover?",
  "Summarize the main points in the latest SOP",
  "Where can I find contact or support details?",
];

/**
 * Detect pure small-talk so we can reply without embeddings / LLM tokens.
 * Returns null when the message looks like a real knowledge question.
 */
export function matchSmallTalk(query: string): SmallTalkKind | null {
  const raw = query.trim();
  if (!raw || raw.length > 100) return null;

  // Strip common punctuation / emoji noise at edges
  const normalized = raw
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\w\s'?!]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!]+$/g, "")
    .trim();

  if (!normalized) return null;

  // If it looks like a multi-clause question about docs, skip
  if (
    /\b(what|where|when|why|how|who|which|explain|summarize|find|show|tell me about|policy|document|pdf)\b/i.test(
      normalized,
    ) &&
    normalized.split(/\s+/).length > 3
  ) {
    return null;
  }

  const greetings = new Set([
    "hi",
    "hii",
    "hiii",
    "hello",
    "helloo",
    "hey",
    "heyy",
    "heya",
    "hiya",
    "yo",
    "sup",
    "hi there",
    "hello there",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "morning",
    "evening",
    "howdy",
    "salaam",
    "salam",
    "assalamualaikum",
    "asalamualaikum",
    "aoa",
    "how are you",
    "how r you",
    "how's it going",
    "hows it going",
    "what's up",
    "whats up",
    "whatsup",
  ]);

  const thanks = new Set([
    "thanks",
    "thank you",
    "thank u",
    "thankyou",
    "thx",
    "ty",
    "tysm",
    "thanks a lot",
    "thank you so much",
    "thanks so much",
    "appreciate it",
    "much appreciated",
    "shukriya",
    "shukria",
    "jazakallah",
  ]);

  const goodbyes = new Set([
    "bye",
    "goodbye",
    "good bye",
    "see you",
    "see ya",
    "cya",
    "later",
    "take care",
    "khuda hafiz",
    "allah hafiz",
  ]);

  const acks = new Set([
    "ok",
    "okay",
    "k",
    "kk",
    "cool",
    "great",
    "nice",
    "perfect",
    "got it",
    "alright",
    "all right",
    "sure",
    "yes",
    "yep",
    "yeah",
    "yup",
    "no",
    "nope",
    "nah",
  ]);

  const help = new Set([
    "help",
    "help me",
    "what can you do",
    "what can u do",
    "how does this work",
  ]);

  if (greetings.has(normalized)) return "greeting";
  if (thanks.has(normalized)) return "thanks";
  if (goodbyes.has(normalized)) return "goodbye";
  if (acks.has(normalized)) return "ack";
  if (help.has(normalized)) return "help";

  // "hi!" / "hello!!" already normalized; also "hi bot"
  if (/^(hi|hello|hey|heya|hiya)( there| bot| assistant)?$/i.test(normalized)) {
    return "greeting";
  }
  if (/^(thanks|thank you|thx|ty)( so much| a lot)?$/i.test(normalized)) {
    return "thanks";
  }

  return null;
}

export function smallTalkAnswer(kind: SmallTalkKind): RagAnswer {
  const followUps = [...SUGGESTIONS];

  switch (kind) {
    case "greeting":
      return {
        answer:
          "Hi! I can help you find answers from your company knowledge base. Ask about a policy, process, or document — for example, try one of the suggestions below.",
        citations: [],
        confidence: 0,
        confidenceLevel: "none",
        followUps,
      };
    case "thanks":
      return {
        answer:
          "You're welcome! If you need anything else from the docs, just ask.",
        citations: [],
        confidence: 0,
        confidenceLevel: "none",
        followUps,
      };
    case "goodbye":
      return {
        answer: "Goodbye! Come back anytime you need help with the documentation.",
        citations: [],
        confidence: 0,
        confidenceLevel: "none",
        followUps: [],
      };
    case "ack":
      return {
        answer:
          "Got it. When you're ready, ask a question about your company documents.",
        citations: [],
        confidence: 0,
        confidenceLevel: "none",
        followUps,
      };
    case "help":
      return {
        answer:
          "I answer questions using your indexed company PDFs and DOCX files, with source citations. I don't browse the open web. Try asking about a policy, process, or topic from your docs.",
        citations: [],
        confidence: 0,
        confidenceLevel: "none",
        followUps,
      };
  }
}
