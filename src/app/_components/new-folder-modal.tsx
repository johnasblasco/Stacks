"use client";

import { useState } from "react";

import { api } from "@/trpc/react";

interface NewFolderModalProps {
  /** If provided, we're renaming an existing folder instead of creating one. */
  renameFrom?: string;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/30";

/**
 * Simple modal for creating a new folder or renaming an existing one.
 */
export function NewFolderModal({ renameFrom, onClose }: NewFolderModalProps) {
  const [name, setName] = useState(renameFrom ?? "");
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const createFolder = api.cards.createFolder.useMutation({
    onSuccess: async () => {
      await utils.cards.categories.invalidate();
      onClose();
    },
    onError: () => setError("Something went wrong. Try again."),
  });

  const renameCategory = api.cards.renameCategory.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cards.list.invalidate(),
        utils.cards.categories.invalidate(),
      ]);
      onClose();
    },
    onError: () => setError("Something went wrong. Try again."),
  });

  const isRename = !!renameFrom;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a folder name.");
      return;
    }
    if (isRename) {
      if (trimmed === renameFrom) {
        onClose();
        return;
      }
      renameCategory.mutate({ from: renameFrom, to: trimmed });
    } else {
      createFolder.mutate({ name: trimmed });
    }
  };

  const isPending = createFolder.isPending || renameCategory.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">
          {isRename ? `Rename "${renameFrom}"` : "New folder"}
        </h2>
        <p className="-mt-2 text-xs text-neutral-500 dark:text-white/40">
          {isRename
            ? "This updates every card filed under this folder."
            : "Folders help organize your cards. You can also type a new folder name when saving a card."}
        </p>

        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Folder name"
          className={inputClass}
        />

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
            disabled={isPending || !name.trim()}
            className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
          >
            {isPending ? "Saving…" : isRename ? "Rename" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
