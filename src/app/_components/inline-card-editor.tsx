"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/trpc/react";
import type { Card } from "./board";

const NOTE_COLORS = [
  { name: "Default", swatch: "bg-white dark:bg-[#151823]" },
  { name: "Coral", swatch: "bg-rose-200 dark:bg-rose-950" },
  { name: "Peach", swatch: "bg-orange-200 dark:bg-orange-950" },
  { name: "Sand", swatch: "bg-amber-200 dark:bg-amber-950" },
  { name: "Mint", swatch: "bg-emerald-200 dark:bg-emerald-950" },
  { name: "Sage", swatch: "bg-lime-200 dark:bg-lime-950" },
  { name: "Fog", swatch: "bg-sky-200 dark:bg-sky-950" },
  { name: "Storm", swatch: "bg-indigo-200 dark:bg-indigo-950" },
  { name: "Dusk", swatch: "bg-violet-200 dark:bg-violet-950" },
  { name: "Blossom", swatch: "bg-pink-200 dark:bg-pink-950" },
  { name: "Clay", swatch: "bg-stone-200 dark:bg-stone-800" },
  { name: "Chalk", swatch: "bg-neutral-200 dark:bg-neutral-800" },
] as const;

interface InlineCardEditorProps {
  card: Card;
  onClose: () => void;
}

export function InlineCardEditor({ card, onClose }: InlineCardEditorProps) {
  const [title, setTitle] = useState(card.title);
  const [note, setNote] = useState(card.note);
  const [category, setCategory] = useState(card.category);
  const [color, setColor] = useState<string | null>(card.color);
  const [showColors, setShowColors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = api.cards.categories.useQuery();
  const utils = api.useUtils();
  const update = api.cards.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cards.list.invalidate(),
        utils.cards.categories.invalidate(),
      ]);
      onClose();
    },
    onError: () => {
      setSaving(false);
      setError("The card could not be saved. Please try again.");
    },
  });

  useEffect(() => {
    titleRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const links = useMemo(
    () => Array.from(new Set(note.match(/https?:\/\/[^\s)\]}>,]+/g) ?? [])),
    [note],
  );
  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  const saveAndClose = () => {
    const trimmedTitle = title.trim();
    const trimmedNote = note.trim();
    if (!trimmedTitle && !trimmedNote) {
      setError("A card needs a title or note.");
      return;
    }
    if (
      trimmedTitle === card.title &&
      trimmedNote === card.note &&
      (category.trim() || card.category) === card.category &&
      color === card.color
    ) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    update.mutate({
      id: card.id,
      title: trimmedTitle || card.title,
      note: trimmedNote,
      summary: trimmedNote ? trimmedNote.slice(0, 200) : card.summary,
      category: category.trim() || card.category,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`card-title-${card.id}`}
    >
      <article className="flex max-h-[85vh] min-h-[450px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl dark:bg-[#121520]">
        <header className="flex items-center justify-between border-b border-neutral-200/80 px-5 py-4 sm:px-8 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-violet-700 uppercase dark:bg-violet-500/15 dark:text-violet-200">
              Card reader
            </span>
            <span className="truncate text-xs text-neutral-400 dark:text-white/35">
              Saved{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(card.savedAt))}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close card"
            className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <svg
              className="h-4 w-4 text-violet-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
            </svg>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list={`card-folders-${card.id}`}
              aria-label="Folder"
              className="min-w-28 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-violet-700 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-violet-200"
            />
            <datalist id={`card-folders-${card.id}`}>
              {categories.map((folder) => (
                <option key={folder} value={folder} />
              ))}
            </datalist>
          </div>

          <input
            id={`card-title-${card.id}`}
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                saveAndClose();
            }}
            placeholder="Title"
            className="w-full bg-transparent text-2xl font-bold tracking-tight text-neutral-950 outline-none placeholder:text-neutral-300 sm:text-3xl dark:text-white dark:placeholder:text-white/25"
          />

          {card.summary && card.summary !== card.note && (
            <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-400/15 dark:bg-violet-500/10">
              <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-violet-600 uppercase dark:text-violet-300">
                AI summary
              </p>
              <p className="text-sm leading-relaxed text-neutral-700 dark:text-white/70">
                {card.summary}
              </p>
            </div>
          )}

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                saveAndClose();
            }}
            placeholder="Write your note…"
            className="mt-6 min-h-56 w-full resize-none bg-transparent text-base leading-8 text-neutral-700 outline-none placeholder:text-neutral-300 dark:text-white/75 dark:placeholder:text-white/25"
          />

          {(card.tags.length > 0 || links.length > 0 || card.url) && (
            <div className="mt-5 space-y-4 border-t border-neutral-200/80 pt-5 dark:border-white/10">
              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-white/8 dark:text-white/55"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set(
                    [card.url, ...links].filter((link): link is string =>
                      Boolean(link),
                    ),
                  ),
                ).map((link) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full truncate rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-violet-200"
                  >
                    ↗ {link}
                  </a>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 bg-neutral-50/70 px-5 py-4 sm:px-8 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColors((value) => !value)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
              >
                Color
              </button>
              {showColors && (
                <div className="absolute bottom-full left-0 mb-2 grid w-44 grid-cols-6 gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1b1e2b]">
                  {NOTE_COLORS.map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      title={option.name}
                      onClick={() => {
                        setColor(
                          option.name === "Default" ? null : option.name,
                        );
                        setShowColors(false);
                      }}
                      className={`h-5 w-5 rounded-full border border-black/10 ${option.swatch} ${color === option.name || (!color && option.name === "Default") ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-[#1b1e2b]" : ""}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-neutral-400 dark:text-white/35">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-200/70 dark:text-white/50 dark:hover:bg-white/10"
            >
              Close
            </button>
            <button
              type="button"
              onClick={saveAndClose}
              disabled={saving}
              className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
