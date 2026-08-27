"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/trpc/react";
import { ThemeToggle } from "./theme-toggle";

type AskResult = { kind: "answered"; answer: string; usedCardIds: number[] } | {
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
  /** Rendered as a ✕ button in the header (used by the mobile drawer). */
  onClose?: () => void;
}

export function ChatPanel({
  onAnswered,
  onSelectCard,
  onClose,
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
        : error.message || "Something went wrong. Check your AI config and try again.";
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
    <aside className="flex h-full w-full flex-col border-r border-neutral-200 bg-white dark:border-white/10 dark:bg-[#111327]">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white">
              Ask Stacks
            </h2>
            <p className="text-xs text-neutral-500 dark:text-white/40">
              Ask anything — I can use your saved cards or answer from general
              knowledge.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 dark:border-white/15 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <span aria-hidden>⏻</span>
              Sign out
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

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 space-y-2 text-center">
            <p className="text-sm text-neutral-500 dark:text-white/50">
              Ask me anything — I can reference your saved cards or answer from
              general knowledge.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
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
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-violet-400 dark:hover:text-violet-300"
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
            className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto self-end bg-violet-500/80 text-white"
                : message.kind === "rejected"
                  ? "bg-red-500/15 text-red-700 dark:text-red-200"
                  : "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white/90"
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

      <div className="border-t border-neutral-200 p-4 dark:border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask me anything…"
            className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/30"
          />
          <button
            type="submit"
            disabled={ask.isPending || !text.trim()}
            className="shrink-0 rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
          >
            {ask.isPending ? "…" : "Ask"}
          </button>
        </form>
      </div>
    </aside>
  );
}
