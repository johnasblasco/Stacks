"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/root";
import type { CardStatus } from "@/server/db/schema";
import { api } from "@/trpc/react";

import { CaptureInput } from "./capture-input";
import type { CaptureResult } from "./capture-input";
import type { ContextMenuItem } from "./context-menu";

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
}

export function Board({ highlightedIds, onSelectCard }: BoardProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus>("active");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3000);
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
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Right-click menu / manual creation / folder containers
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [newCard, setNewCard] = useState<{ category?: string } | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [folderModal, setFolderModal] = useState<string | null>(null);
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

  const [cards] = api.cards.list.useSuspenseQuery({
    q: debouncedQuery || undefined,
    category,
    status,
  });
  const [categories] = api.cards.categories.useSuspenseQuery();

  const bulkAction = api.cards.bulkAction.useMutation({
    onSuccess: async (_data, variables) => {
      await invalidateAll();
      setSelected(new Set());
      const labels: Record<string, string> = {
        trash: "Moved to Trash",
        archive: "Archived",
        activate: "Restored",
        move: `Moved to ${variables.category}`,
      };
      showNotice(`${labels[variables.action]} (${variables.ids.length} card${variables.ids.length === 1 ? "" : "s"})`);
    },
  });

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
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search everything…"
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
        </div>

        {/* Drop a link / quick-add */}
        <div className="mt-3">
          <CaptureInput onResult={handleCaptureResult} categories={categories} />
        </div>

        {notice && (
          <p className="mt-2 truncate rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-800 dark:text-violet-200">
            {notice}
          </p>
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
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-neutral-400 hover:text-neutral-700 dark:text-white/40 dark:hover:text-white"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Card grid — right-click empty space for new note/folder */}
      <div
        className="grid flex-1 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3"
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
            <div key={card.id} className="relative">
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
              <button
                type="button"
                onClick={() => onSelectCard(card.id)}
                onContextMenu={(e) =>
                  openMenu(e, [
                    {
                      label: "Open",
                      onSelect: () => onSelectCard(card.id),
                    },
                    {
                      label: "Edit",
                      onSelect: () => setEditingCard(card),
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
                className={`flex w-full flex-col items-start gap-2 rounded-xl border p-4 pr-10 text-left shadow-sm transition hover:border-neutral-300 hover:bg-neutral-100 dark:hover:border-white/30 dark:hover:bg-white/10 ${
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
                  {card.title}
                </h3>
                <div className="mt-auto flex w-full items-center justify-end gap-2 pt-1">
                  <span className="text-[11px] text-neutral-400 dark:text-white/40">
                    {formatDate(card.savedAt)}
                    {card.url ? " · 🔗" : ""}
                  </span>
                </div>
              </button>
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

      {/* New folder modal */}
      {newFolderModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <NewFolderModal onClose={() => setNewFolderModal(false)} />
        </Suspense>
      )}

      {/* Edit card modal */}
      {editingCard && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <EditCardModal
            card={editingCard}
            existingCategories={categories}
            onClose={() => setEditingCard(null)} />
        </Suspense>
      )}
    </section>
  );
}
