"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/root";
import type { CardStatus } from "@/server/db/schema";
import { api } from "@/trpc/react";

import { CaptureInput } from "./capture-input";
import type { CaptureResult } from "./capture-input";
import type { ContextMenuItem } from "./context-menu";
import { InlineCardEditor } from "./inline-card-editor";

const ContextMenu = React.lazy(() =>
  import("./context-menu").then((m) => ({ default: m.ContextMenu })),
);
const FolderModal = React.lazy(() =>
  import("./folder-modal").then((m) => ({ default: m.FolderModal })),
);
const NewFolderModal = React.lazy(() =>
  import("./new-folder-modal").then((m) => ({ default: m.NewFolderModal })),
);
const NewCardModal = React.lazy(() =>
  import("./new-card-modal").then((m) => ({ default: m.NewCardModal })),
);
const EditCardModal = React.lazy(() =>
  import("./edit-card-modal").then((m) => ({ default: m.EditCardModal })),
);

export type Card = inferRouterOutputs<AppRouter>["cards"]["list"][number];

const STATUS_TABS: { value: CardStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "trashed", label: "Trash" },
];

/** Highlights matching substrings in text. */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded-sm bg-yellow-200/70 px-0.5 text-inherit dark:bg-yellow-500/30">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(date),
  );
}

/** Maps color name → Tailwind bg/border classes for card tinting. */
const COLOR_MAP: Record<string, { bg: string; border: string }> = {
  Coral: { bg: "bg-[#faafa8]", border: "border-[#f28b82]" },
  Peach: { bg: "bg-[#f7bdce]", border: "border-[#fbbc04]" },
  Sand: { bg: "bg-[#fcf4a3]", border: "border-[#fff475]" },
  Mint: { bg: "bg-[#c9f2c7]", border: "border-[#ccff90]" },
  Sage: { bg: "bg-[#c4edb8]", border: "border-[#a8dab5]" },
  Fog: { bg: "bg-[#d4e5fc]", border: "border-[#aecbfa]" },
  Storm: { bg: "bg-[#d3d5fc]", border: "border-[#d7aefb]" },
  Dusk: { bg: "bg-[#e8d5f5]", border: "border-[#b39ddb]" },
  Blossom: { bg: "bg-[#fce4ec]", border: "border-[#f48fb1]" },
  Clay: { bg: "bg-[#efebe9]", border: "border-[#d7ccc8]" },
  Chalk: { bg: "bg-[#e8eaed]", border: "border-[#dadce0]" },
};

interface BoardProps {
  highlightedIds: number[];
  onSelectCard: (id: number) => void;
  expandCardId?: number | null;
  onExpandHandled?: () => void;
}

export function Board({ highlightedIds, onSelectCard, expandCardId, onExpandHandled }: BoardProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"date" | "alpha" | "color">("date");
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus>("active");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<{ ids: number[]; action: string; category?: string } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setUndoAction(null);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
      setUndoAction(null);
    }, 5000);
  }, []);

  const showUndoNotice = useCallback((msg: string, undo: { ids: number[]; action: string; category?: string }) => {
    setNotice(msg);
    setUndoAction(undo);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
      setUndoAction(null);
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 250);
  }, []);  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Cmd/Ctrl+K to focus search, Ctrl+Shift+N for capture, ? for shortcuts
  const captureInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

      // Ctrl+Shift+N → focus capture input
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        captureInputRef.current?.focus();
      }

      // ? key → open shortcut cheat sheet (when not typing)
      if (!isInput && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }

      // Escape closes shortcut sheet
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts]);

  // Swipe-to-delete state (mobile)
  const [swipeCardId, setSwipeCardId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeAction = api.cards.bulkAction.useMutation({
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const handleTouchStart = useCallback((e: React.TouchEvent, cardId: number) => {
    touchStartRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    setSwipeCardId(cardId);
    setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0]!.clientX - touchStartRef.current.x;
    const dy = e.touches[0]!.clientY - touchStartRef.current.y;
    // Only horizontal swipes (ignore vertical scrolling)
    if (Math.abs(dx) > Math.abs(dy)) {
      setSwipeX(Math.max(-160, Math.min(dx, 160)));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Haptic feedback on threshold crossing
    if (swipeCardId) {
      if (swipeX < -100) {
        try { navigator.vibrate?.(20); } catch { /* no-op */ }
        swipeAction.mutate({ ids: [swipeCardId], action: "trash" });
        showUndoNotice("Card moved to trash", {
          ids: [swipeCardId],
          action: "activate",
        });
      } else if (swipeX > 100) {
        try { navigator.vibrate?.(20); } catch { /* no-op */ }
        swipeAction.mutate({ ids: [swipeCardId], action: "archive" });
        showUndoNotice("Archived", {
          ids: [swipeCardId],
          action: "activate",
        });
      }
    }
    touchStartRef.current = null;
    setSwipeCardId(null);
    setSwipeX(0);
  }, [swipeCardId, swipeX, swipeAction, showUndoNotice]);

  // Drag-and-drop reorder
  const [dragId, setDragId] = useState<number | null>(null);
  const reorderCard = api.cards.reorder.useMutation({
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  // Right-click menu / manual creation / folder containers
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [newCard, setNewCard] = useState<{ category?: string } | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [folderModal, setFolderModal] = useState<string | null>(null);

  // Handle external expand request (e.g. from chat panel card reference)
  useEffect(() => {
    if (expandCardId != null) {
      setExpandedCardId(expandCardId);
      onExpandHandled?.();
    }
  }, [expandCardId, onExpandHandled]);
  const [newFolderModal, setNewFolderModal] = useState(false);

  const openMenu = (e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const utils = api.useUtils();
  const invalidateAll = async () => {
    await Promise.all([
      utils.cards.list.invalidate(),
      utils.cards.categories.invalidate(),
      utils.cards.byId.invalidate(),
    ]);
  };

  const [rawCards] = api.cards.list.useSuspenseQuery({
    q: debouncedQuery || undefined,
    category,
    status,
  });
  const [categories] = api.cards.categories.useSuspenseQuery();

  // Sort cards client-side (pinned always first)
  const cards = React.useMemo(() => {
    const sorted = [...rawCards];
    sorted.sort((a, b) => {
      // Pinned cards always first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      switch (sortBy) {
        case "alpha":
          return a.title.localeCompare(b.title);
        case "color":
          return (a.color ?? "zzz").localeCompare(b.color ?? "zzz");
        case "date":
        default:
          return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      }
    });
    return sorted;
  }, [rawCards, sortBy]);

  const bulkAction = api.cards.bulkAction.useMutation({
    onSuccess: async (_data, variables) => {
      await invalidateAll();
      setSelected(new Set());
      if (variables.action === "trash") {
        showUndoNotice(
          `Moved to Trash (${variables.ids.length} card${variables.ids.length === 1 ? "" : "s"})`,
          { ids: variables.ids, action: "activate" },
        );
      } else if (variables.action === "archive") {
        showUndoNotice(
          `Archived (${variables.ids.length} card${variables.ids.length === 1 ? "" : "s"})`,
          { ids: variables.ids, action: "activate" },
        );
      } else {
        const labels: Record<string, string> = {
          activate: "Restored",
          move: `Moved to ${variables.category}`,
        };
        showNotice(`${labels[variables.action] ?? variables.action} (${variables.ids.length} card${variables.ids.length === 1 ? "" : "s"})`);
      }      },
  });

  const handleUndo = useCallback(() => {
    if (!undoAction) return;
    bulkAction.mutate({
      ids: undoAction.ids,
      action: undoAction.action as "activate",
      category: undoAction.category,
    });
    setNotice(null);
    setUndoAction(null);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, [undoAction, bulkAction]);

  // Keyboard shortcuts: j/k (navigate), e (edit), d (trash)
  const [focusedCardIdx, setFocusedCardIdx] = useState<number>(-1);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      if (isInput) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedCardIdx((prev) => Math.min(prev + 1, cards.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedCardIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "e" || e.key === "Enter") {
        if (focusedCardIdx >= 0 && focusedCardIdx < cards.length) {
          e.preventDefault();
          setExpandedCardId(cards[focusedCardIdx]!.id);
        }
      } else if (e.key === "d" || e.key === "Delete") {
        if (focusedCardIdx >= 0 && focusedCardIdx < cards.length) {
          e.preventDefault();
          const id = cards[focusedCardIdx]!.id;
          bulkAction.mutate({ ids: [id], action: "trash" });
          showUndoNotice("Card moved to trash", { ids: [id], action: "activate" });
        }
      } else if (e.key === "Escape") {
        setFocusedCardIdx(-1);
        setExpandedCardId(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cards, focusedCardIdx, bulkAction, showUndoNotice]);

  const deleteForever = api.cards.deleteForever.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      setSelected(new Set());
      showNotice("Deleted permanently");
    },
  });

  const createFolder = api.cards.createFolder.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.cards.categories.invalidate();
      showNotice(`Folder “${variables.name}” created`);
    },
  });

  const [showBulkColor, setShowBulkColor] = useState(false);
  const bulkSetColor = api.cards.bulkSetColor.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      setSelected(new Set());
      showNotice("Color updated");
    },
  });

  const togglePin = api.cards.togglePin.useMutation({
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const handleCaptureResult = (result: CaptureResult) => {
    if (result.kind === "saved") showNotice(result.message);
    else if (result.kind === "duplicate") showNotice(result.message);
    else if (result.kind === "rejected") showNotice(result.reason);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = Array.from(selected);

  return (
    <section className="flex h-full flex-1 flex-col overflow-y-auto">
      {/* Quick-add */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-4 pr-36 backdrop-blur dark:border-white/10 dark:bg-[#15162c]/90 sm:px-6 sm:pr-48">
        {/* Search — prominent, top of the header */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.2-5.2M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search everything…  ⌘K"
            className="w-full rounded-full border border-neutral-300 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-violet-400 dark:focus:ring-violet-400/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status tabs + folder filter row */}
        <div className="mt-3 flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setSelected(new Set());
              }}
              className={`rounded-full px-3 py-1 text-xs transition ${
                status === tab.value
                  ? "bg-neutral-200 font-semibold text-neutral-900 dark:bg-white/20 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-white/50 dark:hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-white/10" />

          {/* Folder filter */}
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value || null)}
            aria-label="Filter by folder"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 outline-none dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white/80 dark:[color-scheme:dark]"
          >
            <option value="">All folders</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNewFolderModal(true)}
            className="rounded-full px-2 py-1 text-xs font-medium text-neutral-500 underline-offset-2 transition hover:text-neutral-800 hover:underline dark:text-white/50 dark:hover:text-white"
          >
            + Folder
          </button>

          <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-white/10" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort cards"
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 outline-none dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white/80 dark:[color-scheme:dark]"
          >
            <option value="date">Newest</option>
            <option value="alpha">A–Z</option>
            <option value="color">Color</option>
          </select>

          {/* Density toggle */}
          <button
            type="button"
            onClick={() => setDensity((d) => d === "compact" ? "comfortable" : d === "comfortable" ? "spacious" : "compact")}
            title={`Density: ${density}`}
            className="rounded-full px-2 py-1 text-[10px] font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {density === "compact" ? "◼" : density === "comfortable" ? "◼◼" : "◼◼◼"}
          </button>

          {/* View toggle */}
          <button
            type="button"
            onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {viewMode === "grid" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            )}
          </button>
        </div>

        {/* Drop a link / quick-add */}
        <div className="mt-3">
          <CaptureInput ref={captureInputRef} onResult={handleCaptureResult} categories={categories} />
        </div>

        {notice && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-800 dark:text-violet-200">
            <span className="truncate flex-1">{notice}</span>
            {undoAction && (
              <button
                type="button"
                onClick={handleUndo}
                className="shrink-0 font-semibold underline transition hover:text-violet-600 dark:hover:text-white"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-400/30 bg-violet-500/10 px-6 py-3 text-sm">
          <span className="font-semibold text-violet-800 dark:text-violet-200">
            {selectedIds.length} selected
          </span>
          {status === "trashed" ? (
            <>
              <button
                type="button"
                onClick={() => bulkAction.mutate({ ids: selectedIds, action: "activate" })}
                disabled={bulkAction.isPending}
                className="rounded-full bg-neutral-200 px-3 py-1 transition hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Permanently delete ${selectedIds.length} card(s)?`))
                    deleteForever.mutate({ ids: selectedIds });
                }}
                disabled={deleteForever.isPending}
                className="rounded-full bg-red-500/80 px-3 py-1 font-semibold transition hover:bg-red-500"
              >
                Delete forever
              </button>
            </>
          ) : (
            <>
              <select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-900 outline-none dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white dark:[color-scheme:dark]"
              >
                <option value="">Move to folder…</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {moveTarget && (
                <button
                  type="button"
                  onClick={() =>
                    bulkAction.mutate({
                      ids: selectedIds,
                      action: "move",
                      category: moveTarget,
                    })
                  }
                  disabled={bulkAction.isPending}
                  className="rounded-full bg-neutral-200 px-3 py-1 transition hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  Move
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  bulkAction.mutate({
                    ids: selectedIds,
                    action: status === "archived" ? "activate" : "archive",
                  })
                }
                disabled={bulkAction.isPending}
                className="rounded-full bg-neutral-200 px-3 py-1 transition hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20"
              >
                {status === "archived" ? "Unarchive" : "Archive"}
              </button>
              <button
                type="button"
                onClick={() => bulkAction.mutate({ ids: selectedIds, action: "trash" })}
                disabled={bulkAction.isPending}
                className="rounded-full bg-red-500/80 px-3 py-1 font-semibold transition hover:bg-red-500"
              >
                Trash
              </button>
            </>
          )}
          {/* Batch color picker */}
          {status !== "trashed" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBulkColor((v) => !v)}
                title="Change color"
                className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 transition hover:bg-neutral-100 dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white/80"
              >
                🎨
              </button>
              {showBulkColor && (
                <div className="absolute bottom-full left-0 z-50 mb-2 flex flex-wrap gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#252749]">
                  {[
                    { name: "Default", border: "border-neutral-200 dark:border-white/10", bg: "bg-white dark:bg-[#1d1f3a]" },
                    { name: "Coral", border: "border-[#f28b82]", bg: "bg-[#faafa8]" },
                    { name: "Peach", border: "border-[#fbbc04]", bg: "bg-[#f7bdce]" },
                    { name: "Sand", border: "border-[#fff475]", bg: "bg-[#fcf4a3]" },
                    { name: "Mint", border: "border-[#ccff90]", bg: "bg-[#c9f2c7]" },
                    { name: "Sage", border: "border-[#a8dab5]", bg: "bg-[#c4edb8]" },
                    { name: "Fog", border: "border-[#aecbfa]", bg: "bg-[#d4e5fc]" },
                    { name: "Storm", border: "border-[#d7aefb]", bg: "bg-[#d3d5fc]" },
                    { name: "Dusk", border: "border-[#b39ddb]", bg: "bg-[#e8d5f5]" },
                    { name: "Blossom", border: "border-[#f48fb1]", bg: "bg-[#fce4ec]" },
                    { name: "Clay", border: "border-[#d7ccc8]", bg: "bg-[#efebe9]" },
                    { name: "Chalk", border: "border-[#dadce0]", bg: "bg-[#e8eaed]" },
                  ].map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => {
                        bulkSetColor.mutate({ ids: selectedIds, color: c.name === "Default" ? null : c.name });
                        setShowBulkColor(false);
                      }}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${c.border} ${c.bg}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-neutral-400 hover:text-neutral-700 dark:text-white/40 dark:hover:text-white"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Card grid / list — right-click empty space for new note/folder */}
      <div
        className={
          viewMode === "grid"
            ? `grid flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 ${
                density === "compact" ? "gap-2 p-3 sm:p-4" : density === "spacious" ? "gap-6 p-6 sm:p-8" : "gap-4 p-4 sm:p-6"
              }`
            : `flex flex-1 flex-col ${
                density === "compact" ? "gap-1 p-3 sm:p-4" : density === "spacious" ? "gap-3 p-6 sm:p-8" : "gap-2 p-4 sm:p-6"
              }`
        }
        onContextMenu={(e) =>
          openMenu(e, [
            {
              label: "New note…",
              onSelect: () => setNewCard({}),
            },
            {
              label: "New folder…",
              onSelect: () => setNewFolderModal(true),
            },
          ])
        }
      >
        {cards.length === 0 && (
          <p className="col-span-full mt-12 text-center text-neutral-400 dark:text-white/40">
            {status === "active"
              ? "Nothing here yet — drop something above, or right-click to create a note or folder."
              : `No ${status} cards.`}
          </p>
        )}
        {cards.map((card) => {
          const highlighted = highlightedIds.includes(card.id);
          const isSelected = selected.has(card.id);
          const colorDef = card.color ? COLOR_MAP[card.color] : null;
          const isPinned = card.pinned;
          return (
            <div
              key={card.id}
              className={`${viewMode === "grid" ? "relative" : "relative flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"} ${swipeCardId === card.id ? "" : "transition-transform"} ${focusedCardIdx >= 0 && cards[focusedCardIdx]?.id === card.id ? "ring-2 ring-violet-400/70" : ""}`}
              style={swipeCardId === card.id ? { transform: `translateX(${swipeX}px)` } : undefined}
              draggable
              onDragStart={() => setDragId(card.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== card.id) {
                  reorderCard.mutate({ fromId: dragId, toId: card.id });
                }
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              onTouchStart={(e) => handleTouchStart(e, card.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Swipe-left → trash indicator */}
              {swipeCardId === card.id && swipeX < -30 && (
                <div className="absolute right-0 top-0 z-20 flex h-full w-16 items-center justify-center rounded-r-xl bg-red-500/90 text-white transition-opacity">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
              )}
              {/* Swipe-right → archive indicator */}
              {swipeCardId === card.id && swipeX > 30 && (
                <div className="absolute left-0 top-0 z-20 flex h-full w-16 items-center justify-center rounded-l-xl bg-blue-500/90 text-white transition-opacity">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </div>
              )}
              {/* Multi-select checkbox */}
              <button
                type="button"
                aria-label={isSelected ? "Deselect card" : "Select card"}
                onClick={() => toggleSelect(card.id)}
                className={`absolute right-3 top-3 z-10 h-5 w-5 rounded-md border text-[11px] leading-none transition ${
                  isSelected
                    ? "border-violet-400 bg-violet-500 text-white"
                    : "border-neutral-300 bg-white/70 text-transparent hover:border-neutral-500 dark:border-white/25 dark:bg-black/20 dark:hover:border-white/60"
                }`}
              >
                ✓
              </button>
              {/* Pin indicator */}
              {isPinned && (
                <span className="absolute left-3 top-3 z-10 text-xs" title="Pinned">
                  📌
                </span>
              )}
              {expandedCardId === card.id ? (
                <InlineCardEditor
                  card={card}
                  onClose={() => setExpandedCardId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setExpandedCardId(card.id)}
                  onContextMenu={(e) =>
                    openMenu(e, [
                      {
                        label: "Open",
                        onSelect: () => setExpandedCardId(card.id),
                      },
                      {
                        label: isPinned ? "Unpin" : "Pin to top",
                        onSelect: () => togglePin.mutate({ id: card.id }),
                      },
                      {
                        label: `Open folder “${card.category}”`,
                        onSelect: () => setFolderModal(card.category),
                      },
                      {
                        label: "Move to folder…",
                        onSelect: () => {
                          const to = prompt(`Move “${card.title}” to folder:`);
                          if (to?.trim())
                            bulkAction.mutate({
                              ids: [card.id],
                              action: "move",
                              category: to.trim(),
                            });
                        },
                      },
                      {
                        label: "Move to trash",
                        onSelect: () =>
                          bulkAction.mutate({ ids: [card.id], action: "trash" }),
                      },
                    ])
                  }
                  className={`flex w-full flex-col items-start gap-2 rounded-xl border pr-10 text-left shadow-sm transition hover:border-neutral-300 hover:bg-neutral-100 dark:hover:border-white/30 dark:hover:bg-white/10 ${density === "compact" ? "p-2 gap-1" : density === "spacious" ? "p-6 gap-3" : "p-4 gap-2"} ${
                    isSelected
                      ? "border-violet-400 bg-violet-500/20"
                      : highlighted
                        ? "border-violet-400 bg-violet-500/10 ring-2 ring-violet-400/60"
                        : colorDef
                          ? `${colorDef.bg} ${colorDef.border} border-2`
                          : "border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  {/* Folder label — click to open the folder container */}
                  <span
                    role="button"
                    tabIndex={0}
                    title={`Open folder “${card.category}”`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderModal(card.category);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setFolderModal(card.category);
                      }
                    }}
                    className="text-xs uppercase tracking-wide text-violet-600 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {card.category}
                  </span>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">
                    <HighlightText text={card.title} query={debouncedQuery} />
                  </h3>
                  {card.note && (
                    <p className="line-clamp-3 text-xs leading-relaxed text-neutral-500 dark:text-white/50">
                      <HighlightText text={card.note} query={debouncedQuery} />
                    </p>
                  )}
                  <div className="mt-auto flex w-full items-center justify-end gap-2 pt-1">
                    <span className="text-[11px] text-neutral-400 dark:text-white/40">
                      {formatDate(card.savedAt)}
                      {card.url ? " · 🔗" : ""}
                    </span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right-click menu */}
      {menu && (
        <Suspense fallback={null}>
          <ContextMenu
            x={menu.x}
            y={menu.y}
            items={menu.items}
            onClose={() => setMenu(null)}
          />
        </Suspense>
      )}

      {/* Manual creation dialog */}
      {newCard && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <NewCardModal
            existingCategories={categories}
            initialCategory={newCard.category}
            onClose={() => setNewCard(null)}
          />
        </Suspense>
      )}

      {/* Folder container view */}
      {folderModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <FolderModal
            folder={folderModal}
            onClose={() => setFolderModal(null)}
            onSelectCard={(id) => onSelectCard(id)}
          />
        </Suspense>
      )}

      {/* Shortcut cheat sheet */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowShortcuts(false)}
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1d1f3a]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                ["⌘K / Ctrl+K", "Focus search"],
                ["⌘⇧N / Ctrl+Shift+N", "Open capture input"],
                ["j / ↓", "Next card"],
                ["k / ↑", "Previous card"],
                ["e / Enter", "Edit focused card"],
                ["d / Delete", "Trash focused card"],
                ["?", "Toggle this cheat sheet"],
                ["Escape", "Deselect / close"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-white/50">{desc}</span>
                  <kbd className="rounded-md border border-neutral-300 bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:border-white/20 dark:bg-white/10 dark:text-white/80">
                    {key}
                  </kbd>
                </div>
              ))}
              <p className="mt-3 text-xs text-neutral-400 dark:text-white/30">
                Mobile: swipe left → trash, swipe right → archive
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* New folder modal */}
      {newFolderModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <NewFolderModal onClose={() => setNewFolderModal(false)} />
        </Suspense>
      )}


    </section>
  );
}
