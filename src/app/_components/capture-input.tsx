"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { api } from "@/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/root";

export type CaptureResult = inferRouterOutputs<AppRouter>["cards"]["capture"];

/** Google Keep color palette. */
const NOTE_COLORS = [
  { name: "Default", bg: "", border: "" },
  { name: "Coral",   bg: "bg-[#faafa8] dark:bg-[#3b1c1c]", border: "border-[#f28b82] dark:border-[#a84040]" },
  { name: "Peach",   bg: "bg-[#f7bdce] dark:bg-[#3b2428]", border: "border-[#fbbc04] dark:border-[#a88030]" },
  { name: "Sand",    bg: "bg-[#fcf4a3] dark:bg-[#3b3820]", border: "border-[#fff475] dark:border-[#a89840]" },
  { name: "Mint",    bg: "bg-[#c9f2c7] dark:bg-[#1c3b1c]", border: "border-[#ccff90] dark:border-[#40a840]" },
  { name: "Sage",    bg: "bg-[#c4edb8] dark:bg-[#1c3320]", border: "border-[#a8dab5] dark:border-[#408a60]" },
  { name: "Fog",     bg: "bg-[#d4e5fc] dark:bg-[#1c263b]", border: "border-[#aecbfa] dark:border-[#4060a8]" },
  { name: "Storm",   bg: "bg-[#d3d5fc] dark:bg-[#201c3b]", border: "border-[#d7aefb] dark:border-[#6040a8]" },
  { name: "Dusk",    bg: "bg-[#e8d5f5] dark:bg-[#2c1c3b]", border: "border-[#b39ddb] dark:border-[#7040a0]" },
  { name: "Blossom", bg: "bg-[#fce4ec] dark:bg-[#3b1c28]", border: "border-[#f48fb1] dark:border-[#a84060]" },
  { name: "Clay",    bg: "bg-[#efebe9] dark:bg-[#2a2523]", border: "border-[#d7ccc8] dark:border-[#7a7068]" },
  { name: "Chalk",   bg: "bg-[#e8eaed] dark:bg-[#252729]", border: "border-[#dadce0] dark:border-[#606468]" },
] as const;

export interface CaptureInputProps {
  onResult?: (result: CaptureResult, submittedText: string) => void;
  categories?: string[];
}

/**
 * Google Keep-style quick-add: a collapsed bar that expands into a card
 * with title, note body, folder picker, color picker, and a toolbar.
 */
export const CaptureInput = forwardRef<HTMLInputElement, CaptureInputProps>(
  function CaptureInput({ onResult, categories = [] }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [title, setTitle] = useState("");
    const [note, setNote] = useState("");
    const [category, setCategory] = useState("");
    const [color, setColor] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showColors, setShowColors] = useState(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const colorPanelRef = useRef<HTMLDivElement>(null);
    const collapsedInputRef = useRef<HTMLInputElement>(null);

    // Forward the collapsed input ref
    useImperativeHandle(ref, () => collapsedInputRef.current!, []);

    const utils = api.useUtils();
    const capture = api.cards.capture.useMutation({
      onSuccess: async (result) => {
        await utils.cards.list.invalidate();
        await utils.cards.categories.invalidate();
        onResult?.(result, title || note);
        collapse();
      },
      onError: () => {
        setSaving(false);
        setError("Something went wrong. Try again.");
      },
    });

    const collapse = useCallback(() => {
      setExpanded(false);
      setTitle("");
      setNote("");
      setCategory("");
      setColor(null);
      setError(null);
      setSaving(false);
      setShowColors(false);
    }, []);

    // Auto-resize body textarea
    const autoResize = useCallback(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    useEffect(() => {
      autoResize();
    }, [note, autoResize]);

    // Focus title when expanding
    useEffect(() => {
      if (expanded) {
        const timer = setTimeout(() => titleRef.current?.focus(), 50);
        return () => clearTimeout(timer);
      }
    }, [expanded]);

    // Close on click outside
    useEffect(() => {
      if (!expanded) return;
      const handleClick = (e: MouseEvent) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          if (title.trim() || note.trim()) return;
          collapse();
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [expanded, title, note, collapse]);

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

    const submit = () => {
      const trimmedTitle = title.trim();
      const trimmedNote = note.trim();
      const text = [trimmedTitle, trimmedNote].filter(Boolean).join("\n");

      if (!text) {
        setError("Write something before saving.");
        return;
      }

      setSaving(true);
      setError(null);
      capture.mutate({
        text,
        mode: "file",
        category: category.trim() || undefined,
        color: color || undefined,
      });
    };

    const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };

    // Resolve color classes for the card border/bg
    const selectedColor = NOTE_COLORS.find((c) => c.name === color);
    const cardBg = color && color !== "Default" ? selectedColor?.bg ?? "" : "";
    const cardBorder =
      color && color !== "Default"
        ? `border-2 ${selectedColor?.border ?? ""}`
        : "border-neutral-200 dark:border-white/10";

    // Collapsed state: the bar (now an input for keyboard focus)
    if (!expanded) {
      return (
        <input
          ref={collapsedInputRef}
          type="text"
          readOnly
          onFocus={() => setExpanded(true)}
          placeholder="Drop a link, a note, a half-formed idea…  ⌘⇧N"
          className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-400 shadow-sm outline-none transition hover:border-neutral-300 hover:shadow-md focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:border-white/20 dark:focus:border-violet-400 dark:focus:ring-violet-400/20"
        />
      );
    }

    // Expanded state: Google Keep-style card
    return (
      <div
        ref={cardRef}
        className={`w-full rounded-xl border ${cardBorder} bg-white shadow-lg transition-all dark:bg-[#1d1f3a] ${cardBg}`}
      >
        <div className="flex flex-col gap-0 p-4 pb-1">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full border-none bg-transparent text-base font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-white/40"
          />
          <textarea
            ref={bodyRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              autoResize();
            }}
            onKeyDown={handleBodyKeyDown}
            placeholder="Take a note…"
            rows={1}
            className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-white/80 dark:placeholder:text-white/30"
            style={{ minHeight: "32px", maxHeight: "30vh", overflow: "auto" }}
          />
        </div>

        {error && (
          <div className="px-4 pb-1">
            <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-700 dark:text-red-200">
              {error}
            </p>
          </div>
        )}

        {/* Toolbar */}
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

            {/* Folder picker */}
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Folder…"
              list={`capture-folders`}
              className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-xs text-violet-600 outline-none focus:border-violet-400 dark:border-white/10 dark:text-violet-300 dark:focus:border-violet-400"
            />
            <datalist id="capture-folders">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={collapse}
              className="rounded-full px-3 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Close
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-full bg-violet-500 px-4 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600 active:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  },
);
