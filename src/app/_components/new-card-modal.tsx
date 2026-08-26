"use client";

import { useState } from "react";

import { api } from "@/trpc/react";

interface NewCardModalProps {
  existingCategories: string[];
  /** Folder pre-selected from the context menu, if any. */
  initialCategory?: string;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/30";

/**
 * Manual creation dialog, opened from the board's right-click menu.
 * Fills a folder name to make a "new folder" (the folder appears once a
 * card is filed into it), or title + optional note/link for a new note.
 */
export function NewCardModal({
  existingCategories,
  initialCategory,
  onClose,
}: NewCardModalProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const create = api.cards.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cards.list.invalidate(),
        utils.cards.categories.invalidate(),
      ]);
      onClose();
    },
    onError: () => setError("Something went wrong. Try again."),
  });

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim();
    if (!trimmedTitle) {
      setError("Give it a title (or type a new folder name).");
      return;
    }
    if (!trimmedCategory) {
      setError("Pick or type a folder name.");
      return;
    }
    let parsedUrl: string | null = null;
    if (url.trim()) {
      try {
        parsedUrl = new URL(url.trim()).toString();
        if (!["http:", "https:"].includes(parsedUrl ? new URL(parsedUrl).protocol : "")) {
          throw new Error("bad protocol");
        }
      } catch {
        setError("That link doesn't look valid.");
        return;
      }
    }
    create.mutate({
      title: trimmedTitle,
      note: note.trim(),
      url: parsedUrl ?? undefined,
      category: trimmedCategory,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">New card</h2>
        <p className="-mt-2 text-xs text-neutral-500 dark:text-white/40">
          Filed as-is — no AI enrichment. Type a brand-new folder name to
          create one.
        </p>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title *"
          className={inputClass}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional)"
          type="url"
          className={inputClass}
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Folder *"
          list="new-card-folders"
          className={inputClass}
        />
        <datalist id="new-card-folders">
          {existingCategories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {error && (
          <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-700 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
          >
            {create.isPending ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
