/**
 * Best-effort fetching of a saved link so the AI can analyze what the page
 * actually contains instead of guessing from the note alone.
 *
 * Constraints:
 * - http/https only
 * - hard timeout + response size cap
 * - never throws — returns null on any failure (save still proceeds)
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 500_000;
const TEXT_SNIPPET_CHARS = 4_000;

export interface PagePreview {
  title: string | null;
  description: string | null;
  /** Readable text extracted from the page body. */
  textSnippet: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/>/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code) > 0 ? Number(code) : 32),
    );
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  const value = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : null;
}

export async function fetchPagePreview(
  rawUrl: string,
): Promise<PagePreview | null> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html: string;
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          // Some sites reject requests without a browser-ish UA.
          "user-agent":
            "Mozilla/5.0 (compatible; Stacks/1.0; personal knowledge base)",
          accept: "text/html",
        },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("html")) return null;
      const buffer = await res.arrayBuffer();
      html = new TextDecoder().decode(buffer.slice(0, MAX_BYTES));
    } finally {
      clearTimeout(timer);
    }

    const title =
      firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ??
      firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i) ??
      firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);

    const description =
      firstMatch(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
      firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ??
      firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);

    const bodyStart = html.search(/<body[\s>]/i);
    const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
    const textSnippet = stripTags(body).slice(0, TEXT_SNIPPET_CHARS);

    if (!title && !description && textSnippet.length === 0) return null;

    return { title, description, textSnippet };
  } catch {
    // Timeouts, DNS failures, 403 bot-blocks, etc. — saving still works.
    return null;
  }
}
