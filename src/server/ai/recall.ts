import { generateObject } from "ai";
import { z } from "zod";

import { getAiModel } from "./enrich";

export interface RecallEntry {
  id: number;
  url: string | null;
  note: string;
  title: string;
  summary: string;
  tags: string[];
  category: string;
}

const recallSchema = z.object({
  answer: z
    .string()
    .describe(
      "Conversational answer to the question. If relevant saved entries exist, reference them by their exact titles and blend their info into your answer. If nothing saved is relevant, answer the question using your own general knowledge — you are a helpful AI assistant, not just a search engine. Never say 'nothing matches' and stop — always try to be helpful.",
    ),
  usedEntryIds: z
    .array(z.number())
    .describe(
      "The IDs of entries actually used to build the answer (empty if none were relevant).",
    ),
});

/**
 * Recall call: question + compact list of all saved entries (+ optional
 * recent chat messages for in-session memory) → natural-language answer +
 * the entry IDs actually used (so the board can highlight them).
 */
export async function recallFromCards(
  question: string,
  entries: RecallEntry[],
  conversationContext?: string,
): Promise<{ answer: string; usedEntryIds: number[] }> {
  const entryList =
    entries.length === 0
      ? "(nothing saved yet)"
      : entries
          .map((entry) => {
            return [
              `[id=${entry.id}] ${entry.title}`,
              `category: ${entry.category}`,
              `tags: ${entry.tags.join(", ")}`,
              entry.url ? `url: ${entry.url}` : null,
              `summary: ${entry.summary}`,
              `note: ${entry.note}`,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n---\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: recallSchema,
    system:
      "You are Stacks, a smart personal knowledge base assistant. You have two modes of operation:\n\n1. When saved entries are relevant to the question: Reference them by their exact titles, blend their information into a natural conversational answer. Highlight that you're drawing from their saved knowledge.\n\n2. When nothing saved is relevant or nothing is saved yet: Answer the question using your own general knowledge. You are a capable AI — never refuse to answer or say 'nothing matches'. Always be helpful.\n\nYou cannot browse live links, so never claim knowledge of a page's contents beyond the note written alongside it. But you DO have general world knowledge — use it freely.",
    prompt: [
      `Everything the person has saved:\n${entryList}`,
      conversationContext
        ? `Recent conversation (for context only — these are chat messages, NOT saved cards):\n${conversationContext}`
        : null,
      `Question: ${question}`,
   ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return object;
}
