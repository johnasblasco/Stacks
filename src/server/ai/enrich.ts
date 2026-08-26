import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import { env } from "@/env";
import type { PagePreview } from "./link";

let cachedModel: LanguageModel | undefined;

/**
 * Lazily create the Gemini client so merely importing this module (and thus
 * the whole tRPC router) doesn't crash when GOOGLE_GENERATIVE_AI_API_KEY is
 * unset. The error surfaces only when AI is actually used.
 */
export function getAiModel(): LanguageModel {
  if (!cachedModel) {
    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_GENERATIVE_AI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it to .env",
      );
    }
    cachedModel = createGoogleGenerativeAI({ apiKey })(env.AI_MODEL);
  }
  return cachedModel;
}

const enrichmentSchema = z.object({
  title: z
    .string()
    .describe("Short descriptive title, at most ~8 words, no trailing period."),
  summary: z
    .string()
    .describe(
      "Exactly one sentence, grounded ONLY in what the person wrote. Never invent facts about a linked page — the app cannot browse links.",
    ),
  tags: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2-4 short lowercase topical tags."),
  category: z
    .string()
    .describe(
      "A folder/category name. Reuse one of the existing folders if it clearly fits; otherwise invent a concise new one.",
    ),
});

function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Whether AI features (enrichment, recall) can be used right now. */
export function isAiConfigured(): boolean {
  return !!env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/**
 * Heuristic enrichment used when no AI key is configured, so saving still
 * works (without smart titles/tags/folders).
 */
export function fallbackEnrichment(input: {
  text: string;
  url: string | null;
  pageTitle?: string | null;
  pageDescription?: string | null;
}): EnrichmentResult {
  const firstLine =
    input.text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? input.text;

  const rawTitle = input.pageTitle ?? (firstLine || hostOf(input.url));
  const title =
    rawTitle.length > 80 ? `${rawTitle.slice(0, 77)}…` : rawTitle || "Untitled note";
  const summarySource = input.pageTitle
    ? `${input.pageTitle}${input.pageDescription ? ` — ${input.pageDescription}` : ""}`
    : firstLine;
  const summary =
    summarySource.length > 200 ? `${summarySource.slice(0, 197)}…` : summarySource;

  return { title, summary, tags: [], category: "inbox" };
}

export interface EnrichmentResult {
  title: string;
  summary: string;
  tags: string[];
  category: string;
}

/**
 * Enrich-on-save: raw note (+ url + existing folder list) → structured
 * title/summary/tags/category.
 */
export async function enrichCard(input: {
  text: string;
  url: string | null;
  existingCategories: string[];
  /** Fetched page content for the link, if any. */
  page?: PagePreview | null;
}): Promise<EnrichmentResult> {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: enrichmentSchema,
    prompt: [
      "You are the filing assistant for Stacks, a personal knowledge base.",
      input.page
        ? "A URL is attached, and we fetched the page content below. Analyze it: base the title and summary on what the page is actually about, blended with what the person wrote."
        : input.url
          ? "A URL is attached but its page could not be fetched. Be honest about that limitation: only describe what the person actually wrote; never guess at page contents."
          : null,
      "",
      input.url ? `URL attached: ${input.url}` : null,
      input.page?.title ? `Page title: ${input.page.title}` : null,
      input.page?.description
        ? `Page description: ${input.page.description}`
        : null,
      input.page?.textSnippet
        ? `Page content (truncated):\n"""\n${input.page.textSnippet}\n"""`
        : null,
      input.existingCategories.length > 0
        ? `Existing folders (reuse one if it clearly fits): ${input.existingCategories.join(", ")}`
        : "No existing folders yet — create a concise one.",
      "",
      `Saved text:\n"""\n${input.text}\n"""`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return object;
}
