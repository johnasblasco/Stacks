import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  classifyMessage,
  extractUrl,
  type MessageIntent,
} from "@/server/ai/classify";
import { enrichCard, fallbackEnrichment, isAiConfigured } from "@/server/ai/enrich";
import { recallFromCards } from "@/server/ai/recall";
import { fetchPagePreview } from "@/server/ai/link";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { cardStatus, cards, folders } from "@/server/db/schema";
import { type db as dbClient } from "@/server/db";

export type CaptureResult =
  | { kind: "saved"; message: string; cardId: number }
  | { kind: "answered"; answer: string; usedCardIds: number[] }
  | { kind: "rejected"; reason: string }
  | { kind: "duplicate"; existingCardId: number; message: string };

/** Result of a chat ask — never files anything. */
export type AskResult =
  | { kind: "answered"; answer: string; usedCardIds: number[] }
  | { kind: "rejected"; reason: string };

const TRASH_RETENTION_DAYS = 30;

/** Auto-purge trashed cards older than the retention window. */
async function purgeExpiredTrash(userId: string, database: typeof dbClient) {
  const cutoff = new Date(
    Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  await database
    .delete(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.status, "trashed"),
        lt(cards.trashedAt, cutoff),
      ),
    );
}

export const cardsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          q: z.string().max(256).optional(),
          category: z.string().max(128).nullable().optional(),
          status: z.enum(cardStatus).default("active"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await purgeExpiredTrash(ctx.session.user.id, ctx.db);

      const conditions = [eq(cards.userId, ctx.session.user.id)];

      if (input?.status) {
        conditions.push(eq(cards.status, input.status));
      }
      if (input?.category) {
        conditions.push(eq(cards.category, input.category));
      }
      if (input?.q) {
        const needle = `%${input.q}%`;
        const searchCondition = or(
          ilike(cards.title, needle),
          ilike(cards.note, needle),
          ilike(cards.summary, needle),
          // jsonb tags array: cast to text for a simple contains-match
          sql`${cards.tags}::text ILIKE ${needle}`,
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      return ctx.db.query.cards.findMany({
        where: and(...conditions),
        orderBy: [desc(cards.pinned), desc(cards.savedAt)],
      });
    }),

  /**
   * Manually create an empty folder (board right-click menu). Folders can
   * exist with zero cards; the chip shows up immediately.
   */
  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      if (!name) return;
      await ctx.db
        .insert(folders)
        .values({ userId: ctx.session.user.id, name })
        .onConflictDoNothing();
    }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    await purgeExpiredTrash(ctx.session.user.id, ctx.db);
    const [rows, folderRows] = await Promise.all([
      ctx.db
        .selectDistinct({ category: cards.category })
        .from(cards)
        .where(
          and(eq(cards.userId, ctx.session.user.id), eq(cards.status, "active")),
        ),
      ctx.db
        .selectDistinct({ name: folders.name })
        .from(folders)
        .where(eq(folders.userId, ctx.session.user.id)),
    ]);
    return Array.from(
      new Set([...folderRows.map((f) => f.name), ...rows.map((r) => r.category)]),
    ).sort((a, b) => a.localeCompare(b));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.id), eq(cards.userId, ctx.session.user.id)),
      });
      return card ?? null;
    }),

  /** 2–3 other cards sharing tags and/or folder with the given card. */
  related: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.id), eq(cards.userId, ctx.session.user.id)),
      });
      if (!base) return [];

      const others = await ctx.db.query.cards.findMany({
        where: and(
          eq(cards.userId, ctx.session.user.id),
          ne(cards.id, base.id),
          inArray(cards.status, ["active", "archived"]),
        ),
        orderBy: [desc(cards.savedAt)],
        limit: 200,
      });

      return others
        .map((other) => ({
          ...other,
          score:
            other.tags.filter((tag) => base.tags.includes(tag)).length * 2 +
            (other.category === base.category ? 1 : 0),
        }))
        .filter((card) => card.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ score: _score, ...card }) => card);
    }),

  /**
   * Chat-only recall: answers from saved cards + recent chat memory. Never
   * saves, files, or modifies cards — the board's quick-add bar is the only
   * place that creates them.
   */
  ask: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(10_000),
        /** Last few chat messages, for in-session memory only. */
        recentMessages: z
          .array(
            z.object({
              role: z.enum(["user", "stacks"]),
              text: z.string().max(2_000),
            }),
          )
          .max(12)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AskResult> => {
      if (!isAiConfigured()) {
        return {
          kind: "rejected",
          reason:
            "AI recall isn't configured yet — add GOOGLE_GENERATIVE_AI_API_KEY to .env (free key: https://aistudio.google.com/apikey) to ask questions about what you've saved.",
        };
      }

      const entries = await ctx.db.query.cards.findMany({
        where: and(
          eq(cards.userId, ctx.session.user.id),
          eq(cards.status, "active"),
        ),
        orderBy: [desc(cards.savedAt)],
      });

      const conversationContext = input.recentMessages?.length
        ? input.recentMessages
            .map((m) => `${m.role === "user" ? "Person" : "Stacks"}: ${m.text}`)
            .join("\n")
        : undefined;

      try {
        const result = await recallFromCards(
          input.text,
          entries.map((entry) => ({
            id: entry.id,
            url: entry.url,
            note: entry.note,
            title: entry.title,
            summary: entry.summary,
            tags: entry.tags,
            category: entry.category,
          })),
          conversationContext,
        );

        return {
          kind: "answered",
          answer: result.answer,
          usedCardIds: result.usedEntryIds.filter((id) =>
            entries.some((entry) => entry.id === id),
          ),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("API key") || msg.includes("API_KEY")) {
          return {
            kind: "rejected",
            reason: "Invalid or missing AI API key. Check GOOGLE_GENERATIVE_AI_API_KEY in your .env file.",
          };
        }
        return {
          kind: "rejected",
          reason: `AI error: ${msg.slice(0, 300)}`,
        };
      }
    }),

  /**
   * Manual creation from the board's right-click menu: a plain note (or an
   * empty folder marker) filed directly, without the quick-add bar.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().max(512).default(""),
        note: z.string().max(10_000).default(""),
        url: z.string().url().nullable().optional(),
        category: z.string().min(1).max(128),
        color: z.string().max(32).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const body = input.note.trim();
      const title = input.title.trim() || (body ? body.split("\n")[0]!.slice(0, 80) : "Untitled note");

      const inserted = await ctx.db
        .insert(cards)
        .values({
          userId: ctx.session.user.id,
          url: input.url ?? null,
          note: body || title,
          title,
          summary:
            body.length > 0
              ? body.slice(0, 200)
              : `Manually filed under ${input.category}.`,
          tags: [],
          category: input.category,
          color: input.color ?? null,
        })
        .returning();

      const card = inserted[0];
      if (!card) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save card",
        });
      }
      return { cardId: card.id };
    }),

  /*
   * Core loop entry point for the board quick-add bar. Takes raw text (+
   * optional explicit mode override) and either saves it (with AI
   * enrichment) or answers a question from what's already saved.
   */
  capture: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(10_000),
        mode: z.enum(["auto", "file", "ask"]).default("auto"),
        category: z.string().max(128).optional(),
        color: z.string().max(32).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<CaptureResult> => {
      const intent: MessageIntent =
        input.mode === "file"
          ? "save"
          : input.mode === "ask"
            ? "ask"
            : classifyMessage(input.text);

      if (intent === "ask") {
        if (!isAiConfigured()) {
          return {
            kind: "rejected",
            reason:
              "AI recall isn't configured yet — add GOOGLE_GENERATIVE_AI_API_KEY to .env (free key: https://aistudio.google.com/apikey) to ask questions about what you've saved.",
          };
        }

        const entries = await ctx.db.query.cards.findMany({
          where: and(eq(cards.userId, ctx.session.user.id), eq(cards.status, "active")),
          orderBy: [desc(cards.savedAt)],
        });

        const result = await recallFromCards(
          input.text,
          entries.map((entry) => ({
            id: entry.id,
            url: entry.url,
            note: entry.note,
            title: entry.title,
            summary: entry.summary,
            tags: entry.tags,
            category: entry.category,
          })),
        );

        return {
          kind: "answered",
          answer: result.answer,
          usedCardIds: result.usedEntryIds.filter((id) =>
            entries.some((entry) => entry.id === id),
          ),
        };
      }

      // Save path.
      const url = extractUrl(input.text);

      // Duplicate detection: same URL already filed → surface it instead of
      // creating a second card; offer to merge the new note into it.
      if (url) {
        const existing = await ctx.db.query.cards.findFirst({
          where: and(
            eq(cards.userId, ctx.session.user.id),
            eq(cards.url, url),
            ne(cards.status, "trashed"),
          ),
          orderBy: [desc(cards.savedAt)],
        });
        if (existing) {
          return {
            kind: "duplicate",
            existingCardId: existing.id,
            message: `You already saved "${existing.title}" (${existing.category}). Merge this note into it?`,
          };
        }
      }

      const existingCategories = await ctx.db
        .selectDistinct({ category: cards.category })
        .from(cards)
        .where(and(eq(cards.userId, ctx.session.user.id), eq(cards.status, "active")))
        .then((rows) => rows.map((row) => row.category));

      // Best-effort: fetch the linked page so the AI can analyze what it's
      // actually about. Failure to fetch never blocks saving.
      const page = url ? await fetchPagePreview(url) : null;

      // Without an AI key (or if the AI call fails), file the card with
      // basic heuristic enrichment so the core save loop keeps working.
      let enrichment = fallbackEnrichment({
        text: input.text,
        url,
        pageTitle: page?.title ?? null,
        pageDescription: page?.description ?? null,
      });
      let aiEnriched = false;
      if (isAiConfigured()) {
        try {
          enrichment = await enrichCard({
            text: input.text,
            url,
            existingCategories,
            page,
          });
          aiEnriched = true;
        } catch (error) {
          console.error("[capture] AI enrichment failed, using fallback:", error);
        }
      }

      const inserted = await ctx.db
        .insert(cards)
        .values({
          userId: ctx.session.user.id,
          url,
          note: input.text,
          title: enrichment.title,
          summary: enrichment.summary,
          tags: enrichment.tags,
          category: input.category || enrichment.category,
          color: input.color ?? null,
        })
        .returning();

      const card = inserted[0];
      if (!card) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save card",
        });
      }

      return {
        kind: "saved",
        message:
          aiEnriched
            ? `Filed "${card.title}" under ${card.category}.`
            : `Filed "${card.title}" under ${card.category} (saved without AI enrichment).`,
        cardId: card.id,
      };
    }),

  /** Duplicate resolution: append the new note to the existing card. */
  mergeNote: protectedProcedure
    .input(
      z.object({
        cardId: z.number(),
        extraText: z.string().min(1).max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.cards.findFirst({
        where: and(
          eq(cards.id, input.cardId),
          eq(cards.userId, ctx.session.user.id),
        ),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const stamped = `${input.extraText}\n\n— added ${new Date().toLocaleDateString()}`;
      await ctx.db
        .update(cards)
        .set({ note: `${existing.note}\n\n${stamped}` })
        .where(eq(cards.id, existing.id));
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(512).optional(),
        summary: z.string().min(1).max(2048).optional(),
        note: z.string().min(1).max(10_000).optional(),
        url: z.string().url().nullable().optional(),
        tags: z.array(z.string().max(64)).min(0).max(8).optional(),
        category: z.string().min(1).max(128).optional(),
        color: z.string().max(32).nullable().optional(),
        pinned: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      if (Object.keys(changes).length === 0) return;

      const updated = await ctx.db
        .update(cards)
        .set(changes)
        .where(and(eq(cards.id, id), eq(cards.userId, ctx.session.user.id)))
        .returning();

      if (!updated.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
    }),

  /** Rename-folder-everywhere: updates every card in the folder at once. */
  renameCategory: protectedProcedure
    .input(z.object({ from: z.string().min(1).max(128), to: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        // If a folder with the target name already exists, drop it first so
        // the unique (user, name) constraint doesn't block the rename.
        ctx.db
          .delete(folders)
          .where(
            and(
              eq(folders.userId, ctx.session.user.id),
              eq(folders.name, input.to),
            ),
          ),
        ctx.db
          .update(cards)
          .set({ category: input.to })
          .where(
            and(
              eq(cards.userId, ctx.session.user.id),
              eq(cards.category, input.from),
            ),
          ),
      ]);
      await ctx.db
        .update(folders)
        .set({ name: input.to })
        .where(
          and(
            eq(folders.userId, ctx.session.user.id),
            eq(folders.name, input.from),
          ),
        );
    }),

  /**
   * Bulk actions over multiple cards at once: move to folder, archive,
   * unarchive, or trash.
   */
  bulkAction: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1).max(500),
        action: z.enum(["trash", "archive", "activate", "move"]),
        category: z.string().min(1).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.action === "move" && !input.category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "move requires a category",
        });
      }
      // Make sure the target folder exists so it persists even after its
      // cards are moved away or trashed.
      if (input.action === "move" && input.category) {
        await ctx.db
          .insert(folders)
          .values({ userId: ctx.session.user.id, name: input.category })
          .onConflictDoNothing();
      }
      if (input.action === "trash") {
        await ctx.db
          .update(cards)
          .set({ status: "trashed", trashedAt: new Date() })
          .where(and(inArray(cards.id, input.ids), eq(cards.userId, ctx.session.user.id)));
        return;
      }
      await ctx.db
        .update(cards)
        .set(
          input.action === "move"
            ? { category: input.category }
            : { status: input.action === "archive" ? "archived" : "active" },
        )
        .where(and(inArray(cards.id, input.ids), eq(cards.userId, ctx.session.user.id)));
    }),

  /** Soft delete / archive: moves a single card between states. */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(cardStatus).default("trashed"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(cards)
        .set({
          status: input.status,
          ...(input.status === "trashed" ? { trashedAt: new Date() } : {}),
        })
        .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.session.user.id)));
    }),

  /** Permanent delete (single card, e.g. emptying trash manually). */
  deleteForever: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(cards)
        .where(and(inArray(cards.id, input.ids), eq(cards.userId, ctx.session.user.id)));
    }),

  /** Toggle pin/unpin a card — pinned cards sort to the top. */
  togglePin: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.id), eq(cards.userId, ctx.session.user.id)),
      });
      if (!card) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(cards)
        .set({ pinned: !card.pinned })
        .where(eq(cards.id, card.id));
    }),

  /** Reorder: move fromId card to sit right after toId by tweaking savedAt. */
  reorder: protectedProcedure
    .input(z.object({ fromId: z.number(), toId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const fromCard = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.fromId), eq(cards.userId, ctx.session.user.id)),
      });
      const toCard = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.toId), eq(cards.userId, ctx.session.user.id)),
      });
      if (!fromCard || !toCard) throw new TRPCError({ code: "NOT_FOUND" });

      // Place fromCard 1ms after toCard so it appears right after in desc order
      const newTime = new Date(new Date(toCard.savedAt).getTime() + 1);
      await ctx.db
        .update(cards)
        .set({ savedAt: newTime })
        .where(eq(cards.id, fromCard.id));
    }),
});
