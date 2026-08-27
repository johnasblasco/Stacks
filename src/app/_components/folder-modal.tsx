"use client";

import { Suspense, useState } from "react";

import { api } from "@/trpc/react";

import { NewFolderModal } from "./new-folder-modal";

interface FolderModalProps {
  folder: string;
  onClose: () => void;
  /** Opens the card detail modal on top of this one. */
  onSelectCard: (id: number) => void;
}

const inputClass =
  "w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/30";

/**
 * Keep-style folder container: shows everything filed inside and lets you
 * keep adding links/notes straight into it.
 */
export function FolderModal({
  folder,
  onClose,
  onSelectCard,
}: FolderModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const utils = api.useUtils();
  const [cards] = api.cards.list.useSuspenseQuery({
    category: folder,
    status: "active",
  });

  const invalidate = async () => {
    await Promise.all([
      utils.cards.list.invalidate(),
      utils.cards.categories.invalidate(),
    ]);
  };

  const addItem = api.cards.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setTitle("");
      setUrl("");
    },
  });

  const [showRenameModal, setShowRenameModal] = useState(false);

  const submit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || addItem.isPending) return;
    let parsedUrl: string | null = null;
    if (url.trim()) {
      try {
        parsedUrl = new URL(url.trim()).toString();
      } catch {
        return;
      }
    }
    addItem.mutate({
      title: trimmedTitle,
      url: parsedUrl ?? undefined,
      category: folder,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold">{folder}</h2>
            <p className="text-xs text-neutral-500 dark:text-white/40">
              {cards.length} card{cards.length === 1 ? "" : "s"} · add links or
              notes below
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Rename folder everywhere"
              onClick={() => setShowRenameModal(true)}
              className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close folder"
              className="rounded-full p-2 leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contents */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {cards.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400 dark:text-white/40">
              Empty folder — add your first link or note below.
            </p>
          )}
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card.id)}
              className="block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <span className="flex items-center gap-2 font-medium text-neutral-900 dark:text-white">
                {card.url && <span aria-hidden>🔗</span>}
                {card.title}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-neutral-500 dark:text-white/50">
                {card.summary}
              </span>
            </button>
          ))}
        </div>

        {/* Quick-add straight into this folder */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2 border-t border-neutral-200 px-5 py-4 dark:border-white/10"
        >
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a link or note to this folder…"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={addItem.isPending || !title.trim()}
              className="shrink-0 rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
            >
              {addItem.isPending ? "…" : "Add"}
            </button>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="Attach a URL (optional)"
            className={`${inputClass} text-xs`}
          />
        </form>
      </div>
      {/* Rename modal */}
      {showRenameModal && (
        <Suspense fallback={null}>
          <NewFolderModal
            renameFrom={folder}
            onClose={() => setShowRenameModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
