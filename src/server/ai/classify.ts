/**
 * Save-vs-ask classification for incoming messages.
 *
 * Rules from the spec:
 * - Contains a URL → save.
 * - Ends in "?" or starts with a question word → answer.
 * - Otherwise → save (default to capturing — that's the primary use).
 */

const QUESTION_STARTERS = [
  "what",
  "who",
  "how",
  "do",
  "does",
  "did",
  "is",
  "are",
  "was",
  "were",
  "can",
  "could",
  "would",
  "will",
  "where",
  "when",
  "why",
  "which",
  "find",
  "show",
  "tell",
  "remind",
  "recall",
  "search",
  "list",
];

export type MessageIntent = "save" | "ask";

export function classifyMessage(text: string): MessageIntent {
  const trimmed = text.trim();
  const lowered = trimmed.toLowerCase();

  if (/\bhttps?:\/\/\S+/i.test(trimmed)) {
    return "save";
  }

  if (trimmed.endsWith("?")) {
    return "ask";
  }

  const firstWord = lowered.split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";
  if (QUESTION_STARTERS.includes(firstWord)) {
    return "ask";
  }

  return "save";
}

/** Extracts the first URL from a message, if any. */
export function extractUrl(text: string): string | null {
  const match = /\bhttps?:\/\/\S+/i.exec(text);
  return match ? match[0].replace(/[),.]+$/, "") : null;
}
