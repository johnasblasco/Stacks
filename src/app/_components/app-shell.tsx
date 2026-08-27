"use client";

import { signOut } from "next-auth/react";
import React, { Suspense, useState } from "react";

import { Board } from "./board";
import { ThemeToggle } from "./theme-toggle";

const ChatPanel = React.lazy(() =>
  import("./chat-panel").then((m) => ({ default: m.ChatPanel })),
);

export function AppShell() {
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [expandCardId, setExpandCardId] = useState<number | null>(null);

  const openCard = (id: number) => {
    setExpandCardId(id);
    setChatOpen(false);
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-[#15162c] dark:text-white">
      {/* Top-right controls */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
        >
          <span aria-hidden>⏻</span>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>

      {/* Board — main surface */}
      <Board
        highlightedIds={highlightedIds}
        onSelectCard={openCard}
        expandCardId={expandCardId}
        onExpandHandled={() => setExpandCardId(null)}
      />

      {/* Desktop: always-visible chat sidebar */}
      <div className="hidden w-96 shrink-0 lg:block">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <ChatPanel
            onAnswered={(ids) => setHighlightedIds(ids)}
            onSelectCard={openCard}
          />
        </Suspense>
      </div>

      {/* Mobile: fullscreen chat overlay */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#111327] lg:hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
            <ChatPanel
              onClose={() => setChatOpen(false)}
              onAnswered={(ids) => setHighlightedIds(ids)}
              onSelectCard={openCard}
            />
          </Suspense>
        </div>
      )}

      {/* Mobile floating chat FAB — only on screens below lg */}
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open Ask Stacks"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500 text-2xl text-white shadow-lg transition hover:bg-violet-600 hover:scale-105 active:scale-95 lg:hidden"
        >
          💬
        </button>
      )}


    </div>
  );
}
