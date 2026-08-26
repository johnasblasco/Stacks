"use client";

import { useState } from "react";

import { api } from "@/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/root";

export type CaptureResult =
  inferRouterOutputs<AppRouter>["cards"]["capture"];

export interface CaptureInputProps {
  onResult?: (result: CaptureResult, submittedText: string) => void;
  placeholder?: string;
}

/**
 * The board's quick-add bar — the ONLY place that files new cards.
 * Always saves; asking questions happens in the chat panel.
 */
export function CaptureInput({ onResult, placeholder }: CaptureInputProps) {
  const [text, setText] = useState("");

  const utils = api.useUtils();
  const capture = api.cards.capture.useMutation({
    onSuccess: async (result) => {
      await utils.cards.list.invalidate();
      await utils.cards.categories.invalidate();
      onResult?.(result, text);
      if (result.kind !== "rejected") setText("");
    },
    onError: () => {
      onResult?.(
        { kind: "rejected", reason: "Something went wrong. Try again." },
        text,
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (trimmed && !capture.isPending)
          capture.mutate({ text: trimmed, mode: "file" });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Drop a link or note…"}
        className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/30"
      />
      <button
        type="submit"
        disabled={capture.isPending || !text.trim()}
        className="shrink-0 rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
      >
        {capture.isPending ? "…" : "Save"}
      </button>
    </form>
  );
}
