"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/trpc/react";
import type { Card } from "./board";

/** Google Keep color palette. */
const NOTE_COLORS = [
  { name: "Default", bg: "", border: "" },
  { name: "Coral", bg: "bg-[#faafa8]", border: "border-[#f28b82]" },
  { name: "Peach", bg: "bg-[#f7bdce]", border: "border-[#fbbc04]" },
  { name: "Sand", bg: "bg-[#fcf4a3]", border: "border-[#fff475]" },
  { name: "Mint", bg: "bg-[#c9f2c7]", border: "border-[#ccff90]" },
  { name: "Sage", bg: "bg-[#c4edb8]", border: "border-[#a8dab5]" },
  { name: "Fog", bg: "bg-[#d4e5fc]", border: "border-[#aecbfa]" },
  { name: "Storm", bg: "bg-[#d3d5fc]", border: "border-[#d7aefb]" },
  { name: "Dusk", bg: "bg-[#e8d5f5]", border: "border-[#b39ddb]" },
  { name: "Blossom", bg: "bg-[#fce4ec]", border: "border-[#f48fb1]" },
  { name: "Clay", bg: "bg-[#efebe9]", border: "border-[#d7ccc8]" },
  { name: "Chalk", bg: "bg-[#e8eaed]", border: "border-[#dadce0]" },
] as const;

interface InlineCardEditorProps {
  card: Card;
  onClose: () => void;
}

/**
 * Google Keep-style inline editor: replaces the card preview with editable
 * title, note body, folder, and a toolbar — all in place, no modal.
 */
export function InlineCardEditor({ card, onClose }: InlineCardEditorProps) {
  const [title, setTitle] = useState(card.title);
  const [note, setNote] = useState(card.note);
  const [category, setCategory] = useState(card.category);
  const [color, setColor] = useState<string | null>(card.color);
  const [showColors, setShowColors] = useState(false);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);

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
    },
  });

  // Auto-focus title
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        saveAndClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, note, category, color]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close color panel on outside click
  useEffect(() => {
    if (!showColors) return;
    const handleClick = (e: MouseEvent) => {
      if (colorPanelRef.current && !colorPanelRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColors]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [note, autoResize]);

  const saveAndClose = () => {
    const trimmedTitle = title.trim();
    const trimmedNote = note.trim();
    if (!trimmedTitle && !trimmedNote) {
      onClose();
      return;
    }
    // Only save if something actually changed
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
    update.mutate({
      id: card.id,
      title: trimmedTitle || card.title,
      note: trimmedNote || card.note,
      summary: trimmedNote ? trimmedNote.slice(0, 200) : card.summary,
      category: category.trim() || card.category,
      color: color || null,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      saveAndClose();
    }
  };

  // Word count for note
  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  const selectedColor = NOTE_COLORS.find((c) => c.name === color);
  const cardBg = color && color !== "Default" ? selectedColor?.bg ?? "" : "";
  const cardBorder =
    color && color !== "Default"
      ? `border-2 ${selectedColor?.border ?? ""}`
      : "border-neutral-200 dark:border-white/10";

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-visible rounded-xl border ${cardBorder} bg-white shadow-lg transition-all dark:bg-[#1d1f3a] ${cardBg}`}
    >
      <div className="flex flex-col gap-0 p-4 pb-1">
        {/* Folder label */}
        <div className="mb-1 flex items-center gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Folder"
            list={`inline-folders-${card.id}`}
            className="rounded-md border border-neutral-200 bg-transparent px-2 py-0.5 text-xs text-violet-600 outline-none focus:border-violet-400 dark:border-white/10 dark:text-violet-300 dark:focus:border-violet-400"
          />
          <datalist id={`inline-folders-${card.id}`}>
            {/* Categories will be passed as prop or fetched */}
          </datalist>
        </div>

        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Title"
          className="w-full border-none bg-transparent text-base font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-white/40"
        />

        {/* Note body */}
        <textarea
          ref={bodyRef}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Take a note…"
          rows={2}
          className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-white/80 dark:placeholder:text-white/30"
          style={{ minHeight: "48px", maxHeight: "40vh", overflow: "auto" }}
        />
      </div>

      {/* Toolbar */}
      {/* Word count + last edited */}
      <div className="flex items-center justify-between px-4 pb-0 text-[10px] text-neutral-400 dark:text-white/30">
        <span>{wordCount > 0 ? `${wordCount} word${wordCount === 1 ? "" : "s"}` : ""}</span>
        <span>{"edited " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.savedAt))}</span>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 px-3 py-1.5 dark:border-white/5">
        <div className="flex items-center gap-0.5">
          {/* Color picker */}
          <div ref={colorPanelRef} className="relative">
            <button
              type="button"
              onClick={() => setShowColors((v) => !v)}
              title="Background color"
              className="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>
            {showColors && (
              <div className="absolute bottom-full left-0 z-50 mb-2 max-h-48 w-40 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-lg [scrollbar-width:none] [-ms-overflow-style:none] dark:border-white/10 dark:bg-[#252749] [&::-webkit-scrollbar]:hidden">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    onClick={() => {
                      setColor(c.name === "Default" ? null : c.name);
                      setShowColors(false);
                    }}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      c.border || "border-neutral-200 dark:border-white/10"
                    } ${
                      c.bg || "bg-white dark:bg-[#1d1f3a]"
                    } ${
                      color === c.name || (color === null && c.name === "Default")
                        ? "ring-2 ring-violet-500 ring-offset-1 dark:ring-offset-[#1d1f3a]"
                        : ""
                    }`}
                  >
                    {(color === null && c.name === "Default") || color === c.name ? (
                      <span className="text-[9px] text-violet-500">✓</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={saveAndClose}
            disabled={saving}
            className="rounded-full bg-violet-500 px-4 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600 active:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
