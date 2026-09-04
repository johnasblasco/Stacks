"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/trpc/react";
import { ThemeToggle } from "./theme-toggle";

type AskResult =
  | { kind: "answered"; answer: string; usedCardIds: number[] }
  | {
      kind: "rejected";
      reason: string;
    };

type ChatMessage = {
  role: "user" | "stacks";
  text: string;
  kind?: AskResult["kind"];
  usedCardIds?: number[];
};

interface ChatPanelProps {
  onAnswered: (usedCardIds: number[]) => void;
  onSelectCard: (id: number) => void;
  onClose?: () => void;
  onSignOut?: () => void;
}

export function ChatPanel({
  onAnswered,
  onSelectCard,
  onClose,
  onSignOut,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ask-only: the chat never saves cards — the board's quick-add bar is the
  // only place that files them.
  const ask = api.cards.ask.useMutation({
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        result.kind === "answered"
          ? {
              role: "stacks",
              text: result.answer,
              kind: "answered",
              usedCardIds: result.usedCardIds,
            }
          : { role: "stacks", text: result.reason, kind: "rejected" },
      ]);
      if (result.kind === "answered") onAnswered(result.usedCardIds);
    },
    onError: (error) => {
      const msg = error.message?.includes("GOOGLE_GENERATIVE_AI_API_KEY")
        ? "AI isn't configured yet. Add GOOGLE_GENERATIVE_AI_API_KEY to your .env file (free key: https://aistudio.google.com/apikey)"
        : error.message ||
          "Something went wrong. Check your AI config and try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "stacks",
          text: msg,
          kind: "rejected",
        },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    // Send the last few messages so Stacks remembers this conversation
    // in-session (they are NOT saved as cards).
    const recentMessages = messages.slice(-10).map(({ role, text }) => ({
      role,
      text: text.length > 2_000 ? `${text.slice(0, 1_997)}…` : text,
    }));
    ask.mutate({ text: trimmed, recentMessages });
    setText("");
  };

  // Collect referenced cards from answers so they render as clickable chips.
  const referencedIds = Array.from(
    new Set(messages.flatMap((m) => m.usedCardIds ?? [])),
  );

  return (
    <aside className="flex h-full w-full flex-col border-l border-neutral-200/80 bg-white dark:border-white/10 dark:bg-[#0d101b]">
      <header className="border-b border-neutral-200/80 px-5 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold tracking-tight text-neutral-950 dark:text-white">
              <span className="text-violet-500">✦</span> AI Recall
            </h2>
            <p className="text-xs text-neutral-500 dark:text-white/40">
              Search your library through conversation.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => onSignOut?.()}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[15px] font-medium text-red-700 transition hover:bg-neutral-100 hover:text-neutral-700 dark:border-white/15 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <span aria-hidden>⏻</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chat panel"
                className="rounded-full p-1.5 leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-400/15 dark:bg-violet-500/10">
              <p className="text-sm font-semibold text-neutral-800 dark:text-white/80">
                What do you want to remember?
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-white/45">
                Ask a question and I’ll trace the answer back to your saved
                cards.
              </p>
            </div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-neutral-400 uppercase dark:text-white/30">
              Try a prompt
            </p>
            <div className="grid gap-2">
              {[
                "Summarize what I've saved about React",
                "What's the difference between REST and GraphQL?",
                "Help me write a regex for emails",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setText(suggestion);
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-xs text-neutral-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto self-end bg-violet-600 text-white shadow-md shadow-violet-500/10"
                : message.kind === "rejected"
                  ? "bg-red-500/15 text-red-700 dark:text-red-200"
                  : "border border-neutral-200/70 bg-neutral-50 text-neutral-800 dark:border-white/8 dark:bg-white/5 dark:text-white/85"
            }`}
          >
            {message.text}
            {message.kind === "answered" &&
              message.usedCardIds &&
              message.usedCardIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {referencedIds
                    .filter((id) => message.usedCardIds?.includes(id))
                    .map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectCard(id)}
                        className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[11px] text-violet-700 hover:bg-violet-500/50 dark:text-violet-100"
                      >
                        card #{id} ↗
                      </button>
                    ))}
                </div>
              )}
          </div>
        ))}
        {ask.isPending && (
          <div className="max-w-[90%] rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-400 dark:bg-white/10 dark:text-white/40">
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/10 dark:border-white/10 dark:bg-white/5"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask me anything…"
            className="w-full bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-white/35"
          />
          <button
            type="submit"
            disabled={ask.isPending || !text.trim()}
            className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {ask.isPending ? "…" : "Ask"}
          </button>
        </form>
      </div>
    </aside>
  );
}
