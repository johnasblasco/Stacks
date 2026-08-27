"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/trpc/react";

interface NewCardModalProps {
  existingCategories: string[];
  /** Folder pre-selected from the context menu, if any. */
  initialCategory?: string;
  onClose: () => void;
}

/** Google Keep color palette — name → bg/text CSS classes. */
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

/**
 * Google Keep-style note editor modal.
 * - Centered dialog with clean white card appearance
 * - Optional title input (auto-focuses body if title is empty)
 * - Large multiline body supporting paragraphs, line breaks, scrolling
 * - Grows naturally for short notes, max-height for long notes
 * - Dismiss on click-outside or Escape key
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
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [showColors, setShowColors] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);

  // Auto-focus the title on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      titleRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close color panel when clicking outside
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

  // Auto-resize body textarea as content grows
  const autoResize = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [note, autoResize]);

  const utils = api.useUtils();
  const create = api.cards.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cards.list.invalidate(),
        utils.cards.categories.invalidate(),
      ]);
      onClose();
    },
    onError: () => {
      setSaving(false);
      setError("Something went wrong. Try again.");
    },
  });

  const submit = () => {
    const trimmedNote = note.trim();
    const trimmedTitle = title.trim();

    if (!trimmedTitle && !trimmedNote) {
      setError("Write something before saving.");
      return;
    }

    const trimmedCategory = category.trim();
    if (!trimmedCategory) {
      setError("Pick or type a folder name.");
      return;
    }

    let parsedUrl: string | null = null;
    if (url.trim()) {
      try {
        parsedUrl = new URL(url.trim()).toString();
        if (!["http:", "https:"].includes(new URL(parsedUrl).protocol)) {
          setError("That link doesn't look valid.");
          return;
        }
      } catch {
        setError("That link doesn't look valid.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    create.mutate({
      title: trimmedTitle,
      note: trimmedNote,
      url: parsedUrl,
      category: trimmedCategory,
      color: color || null,
    });
  };

  // Handle Ctrl+Enter / Cmd+Enter to save
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  // Resolve color classes for the modal card
  const selectedColor = NOTE_COLORS.find((c) => c.name === color);
  const cardBg = color === null || color === "Default" ? "" : selectedColor?.bg ?? "";
  const cardBorder = color === null || color === "Default" ? "" : selectedColor?.border ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`flex w-full max-w-[600px] flex-col overflow-hidden rounded-xl border shadow-2xl transition-colors ${cardBg} ${cardBorder ? `border-2 ${cardBorder}` : "border-transparent"} bg-white dark:bg-[#1d1f3a]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Note content area */}
        <div className="flex flex-col gap-0 p-6 pb-2">
          {/* Title input — optional, single-line */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full border-none bg-transparent pb-1 text-lg font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-white/40"
          />

          {/* Body textarea — large multiline editor */}
          <textarea
            ref={bodyRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              autoResize();
            }}
            onKeyDown={handleBodyKeyDown}
            placeholder="Take a note…"
            rows={4}
            className="w-full resize-none border-none bg-transparent py-1 text-[15px] leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-white/80 dark:placeholder:text-white/30"
            style={{ minHeight: "120px", maxHeight: "60vh", overflow: "auto" }}
          />
        </div>

        {/* Optional URL field — appears inline when toggled */}
        {showUrl && (
          <div className="flex items-center gap-2 px-6 pb-2">
            <span className="text-xs text-neutral-400 dark:text-white/40">🔗</span>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full border-none bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-white/70 dark:placeholder:text-white/30"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowUrl(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setShowUrl(false);
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-white/30 dark:hover:text-white/60"
            >
              ✕
            </button>
          </div>
        )}

        {/* Folder selector row */}
        <div className="flex items-center gap-2 px-6 pb-2">
          <label className="text-xs text-neutral-400 dark:text-white/40">
            Folder
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Choose or type…"
            list="new-card-folders"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:focus:border-white/30"
          />
          <datalist id="new-card-folders">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pb-1">
            <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-700 dark:text-red-200">
              {error}
            </p>
          </div>
        )}

        {/* Toolbar / action bar */}
        <div className="relative flex items-center justify-between border-t border-neutral-100 px-4 py-2 dark:border-white/5">
          {/* Left side: action icons */}
          <div className="flex items-center gap-1">
            {/* Color picker button */}
            <div ref={colorPanelRef} className="relative">
              <button
                type="button"
                onClick={() => setShowColors((v) => !v)}
                title="Background color"
                className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                  <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                  <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                  <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                </svg>
              </button>

              {/* Color palette popover */}
              {showColors && (
                <div className="absolute bottom-full left-0 z-10 mb-2 max-h-48 w-40 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-lg [scrollbar-width:none] [-ms-overflow-style:none] dark:border-white/10 dark:bg-[#252749] [&::-webkit-scrollbar]:hidden">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => {
                        setColor(c.name === "Default" ? null : c.name);
                        setShowColors(false);
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
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
                        <span className="text-xs text-violet-500">✓</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Link button */}
            {!showUrl && (
              <button
                type="button"
                onClick={() => setShowUrl(true)}
                title="Add URL"
                className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
            )}
          </div>

          {/* Right side: Save */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-full bg-violet-500 px-5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600 active:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
