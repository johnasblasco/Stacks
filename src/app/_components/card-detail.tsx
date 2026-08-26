"use client";

import { useState } from "react";

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

export function CardDetail({ cardId, onClose, onSelectCard }: CardDetailProps) {
  const [copied, setCopied] = useState(false);
  const utils = api.useUtils();

  const [card] = api.cards.byId.useSuspenseQuery({ id: cardId });
  const [related] = api.cards.related.useSuspenseQuery({ id: cardId });
  const [categories] = api.cards.categories.useSuspenseQuery();

  // Editable fields — initialized from the card once it loads
  const [editTitle, setEditTitle] = useState(card?.title ?? "");
  const [editSummary, setEditSummary] = useState(card?.summary ?? "");
  const [editNote, setEditNote] = useState(card?.note ?? "");
  const [editUrl, setEditUrl] = useState(card?.url ?? "");
  const [editTags, setEditTags] = useState<string[]>(card?.tags ?? []);
  const [editTagInput, setEditTagInput] = useState("");
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
    editSummary.trim() !== c.summary ||
    editNote.trim() !== c.note ||
    editUrl.trim() !== (c.url ?? "") ||
    editCategory.trim() !== c.category ||
    JSON.stringify(editTags) !== JSON.stringify(c.tags);

  function saveEdits() {
    if (!editTitle.trim() || !editSummary.trim() || !editNote.trim()) return;
    updateCard.mutate({
      id: c.id,
      title: editTitle.trim(),
      summary: editSummary.trim(),
      note: editNote.trim(),
      url: editUrl.trim() || null,
      tags: editTags,
      category: editCategory.trim() || c.category,
    });
  }

  function resetEdits() {
    setEditTitle(c.title);
    setEditSummary(c.summary);
    setEditNote(c.note);
    setEditUrl(c.url ?? "");
    setEditTags([...c.tags]);
    setEditCategory(c.category);
    setEditTagInput("");
  }

  function addTag() {
    const tag = editTagInput.trim().toLowerCase();
    if (tag && !editTags.includes(tag) && editTags.length < 8) {
      setEditTags([...editTags, tag]);
      setEditTagInput("");
    }
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter((t) => t !== tag));
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
        {/* Summary */}
        <textarea
          value={editSummary}
          onChange={(e) => setEditSummary(e.target.value)}
          rows={2}
          className="resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/30 dark:text-white/70 dark:focus:border-violet-400"
          placeholder="Summary"
        />
        {/* Tags */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1 mb-1">
            {editTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/30"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={editTagInput}
              onChange={(e) => setEditTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/30 dark:text-white dark:focus:border-violet-400"
              placeholder="Add tag and press Enter"
              disabled={editTags.length >= 8}
            />
            <button
              type="button"
              onClick={addTag}
              disabled={!editTagInput.trim() || editTags.length >= 8}
              className="shrink-0 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
        {/* Note / saved text */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
            Saved text
          </h3>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-3 text-sm text-neutral-800 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/20 dark:text-white/80 dark:focus:border-violet-400"
            placeholder="Card content…"
          />
        </div>
        {/* URL */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40">
            URL
          </h3>
          <input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-violet-500 dark:border-white/20 dark:bg-black/30 dark:text-white dark:focus:border-violet-400"
            placeholder="https://…"
          />
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
                !editSummary.trim() ||
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
