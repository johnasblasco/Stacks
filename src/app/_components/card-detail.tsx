"use client";

import { useMemo, useState } from "react";

import { api } from "@/trpc/react";

interface CardDetailProps {
  cardId: number;
  onClose: () => void;
  onSelectCard: (id: number) => void;
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(date));
}

/** Extract the first URL from a block of text. */
function extractFirstUrl(text: string): string | null {
  const match = /https?:\/\/[^\s]+/.exec(text);
  return match ? match[0] : null;
}

/** Render text with auto-detected clickable links. */
function renderNoteWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-violet-600 underline hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CardDetail({ cardId, onClose, onSelectCard }: CardDetailProps) {
  const [copied, setCopied] = useState(false);
  const utils = api.useUtils();

  const [card] = api.cards.byId.useSuspenseQuery({ id: cardId });
  const [related] = api.cards.related.useSuspenseQuery({ id: cardId });
  const [categories] = api.cards.categories.useSuspenseQuery();

  // Editable fields — initialized from the card once it loads
  const [editTitle, setEditTitle] = useState(card?.title ?? "");
  const [editNote, setEditNote] = useState(card?.note ?? "");
  const [editCategory, setEditCategory] = useState(card?.category ?? "");

  const invalidate = async () => {
    await Promise.all([
      utils.cards.list.invalidate(),
      utils.cards.categories.invalidate(),
      utils.cards.related.invalidate(),
    ]);
  };

  const updateCard = api.cards.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cards.byId.invalidate(),
        utils.cards.list.invalidate(),
        utils.cards.categories.invalidate(),
        utils.cards.related.invalidate(),
      ]);
    },
  });

  const setStatusMutation = api.cards.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const deleteForever = api.cards.deleteForever.useMutation({
    onSuccess: async () => {
      await utils.cards.list.invalidate();
      onClose();
    },
  });

  // Preview: render note text with auto-detected clickable links
  const notePreview = useMemo(
    () => renderNoteWithLinks(editNote),
    [editNote],
  );

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-600 dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white/70">
          Card not found.
        </div>
      </div>
    );
  }

  const c = card;
  const hasChanges =
    editTitle.trim() !== c.title ||
    editNote.trim() !== c.note ||
    editCategory.trim() !== c.category;

  function saveEdits() {
    if (!editTitle.trim() || !editNote.trim()) return;
    const extractedUrl = extractFirstUrl(editNote.trim());
    updateCard.mutate({
      id: c.id,
      title: editTitle.trim(),
      summary: editNote.trim().slice(0, 200),
      note: editNote.trim(),
      url: extractedUrl,
      tags: c.tags,
      category: editCategory.trim() || c.category,
    });
  }

  function resetEdits() {
    setEditTitle(c.title);
    setEditNote(c.note);
    setEditCategory(c.category);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl dark:border-white/10 dark:bg-[#1d1f3a] dark:text-white sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category / status badge */}
        <span className="text-xs uppercase tracking-wide text-violet-600 dark:text-violet-300">
          {editCategory || c.category}
          {c.status !== "active" && ` · ${c.status}`}
        </span>

        {/* Title */}
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xl font-bold text-neutral-900 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/30 dark:text-white dark:focus:border-violet-400"
          placeholder="Title"
        />
        {/* Note — editable textarea + live preview with clickable links */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
            Note
          </h3>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-3 text-sm text-neutral-800 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/20 dark:text-white/80 dark:focus:border-violet-400"
            placeholder="Type or paste text and links here…"
          />
          {editNote.trim() && (
            <div className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-black/10 dark:text-white/70">
              {notePreview}
            </div>
          )}
        </div>
        {/* Folder / Category */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
            Folder
          </h3>
          <input
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            list="folder-suggestions"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/30 dark:text-white dark:focus:border-violet-400"
            placeholder="Folder name"
          />
          <datalist id="folder-suggestions">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        <p className="text-xs text-neutral-400 dark:text-white/40">
          Saved {formatTimestamp(c.savedAt)}
        </p>

        {/* Related cards — shared tags/folder */}
        {related.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
              Related
            </h3>
            <div className="flex flex-col gap-1">
              {related.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => onSelectCard(other.id)}
                  className="rounded-lg bg-neutral-100 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-200 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <span className="text-violet-600 dark:text-violet-300">
                    {other.title}
                  </span>
                  <span className="ml-2 text-[11px] text-neutral-400 dark:text-white/40">
                    {other.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 flex justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdits}
              disabled={
                updateCard.isPending ||
                !editTitle.trim() ||
                !editNote.trim() ||
                !hasChanges
              }
              className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
            >
              {updateCard.isPending ? "Saving…" : "Save"}
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={resetEdits}
                disabled={updateCard.isPending}
                className="rounded-full bg-neutral-200 px-4 py-2 text-sm transition hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(c.note);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-full bg-neutral-200 px-4 py-2 text-sm transition hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {copied ? "Copied ✓" : "Copy text"}
            </button>
          </div>

          <div className="flex gap-2">
            {c.status === "trashed" ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setStatusMutation.mutate({
                      id: c.id,
                      status: "active",
                    })
                  }
                  disabled={setStatusMutation.isPending}
                  className="rounded-full bg-neutral-200 px-4 py-2 text-sm transition hover:bg-neutral-300 disabled:opacity-40 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Permanently delete this card?"))
                      deleteForever.mutate({ ids: [c.id] });
                  }}
                  disabled={deleteForever.isPending}
                  className="rounded-full bg-red-500/80 px-4 py-2 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-40"
                >
                  Delete forever
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setStatusMutation.mutate({
                      id: c.id,
                      status:
                        c.status === "archived" ? "active" : "archived",
                    })
                  }
                  disabled={setStatusMutation.isPending}
                  className="rounded-full bg-neutral-200 px-4 py-2 text-sm transition hover:bg-neutral-300 disabled:opacity-40 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  {c.status === "archived" ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusMutation.mutate({ id: c.id })}
                  disabled={setStatusMutation.isPending}
                  className="rounded-full bg-red-500/80 px-4 py-2 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-center text-xs text-neutral-400 hover:text-neutral-700 dark:text-white/40 dark:hover:text-white/70"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
