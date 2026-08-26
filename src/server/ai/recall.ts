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
      "Conversational answer to the question, referencing relevant saved entries by their exact titles. If nothing saved is relevant, say so plainly.",
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
      "You are Stacks, a personal knowledge base assistant. You answer questions using ONLY what the person has saved. You sound like an assistant that actually remembers what was saved, not a generic search engine. Reference relevant entries by their exact titles. If nothing saved is relevant, say plainly that nothing saved matches. You cannot browse links, so never claim knowledge of a page's contents beyond the note written alongside it.",
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
