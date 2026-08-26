"use client";

import { signOut } from "next-auth/react";
import React, { Suspense, useState } from "react";

import { Board } from "./board";
import { ThemeToggle } from "./theme-toggle";

const CardDetail = React.lazy(() =>
  import("./card-detail").then((m) => ({ default: m.CardDetail })),
);
const ChatPanel = React.lazy(() =>
  import("./chat-panel").then((m) => ({ default: m.ChatPanel })),
);

export function AppShell() {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  const openCard = (id: number) => {
    setSelectedCardId(id);
    setChatOpen(false);
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-[#15162c] dark:text-white">
      {/* Top-right controls */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open Ask Stacks"
          title="Ask Stacks"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm transition hover:bg-neutral-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 lg:hidden"
        >
          💬
        </button>
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

      {/* Chat panel — docked LEFT on desktop; ask-only, reads saved cards */}
      <div className="hidden w-96 shrink-0 lg:block">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <ChatPanel
            onAnswered={(ids) => setHighlightedIds(ids)}
            onSelectCard={openCard}
          />
        </Suspense>
      </div>

      {/* Board — main surface */}
      <Board
        highlightedIds={highlightedIds}
        onSelectCard={openCard}
      />

      {/* Chat panel — slide-in drawer below desktop */}
      {chatOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 w-full max-w-sm shadow-2xl lg:hidden">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
              <ChatPanel
                onClose={() => setChatOpen(false)}
                onAnswered={(ids) => setHighlightedIds(ids)}
                onSelectCard={openCard}
              />
            </Suspense>
          </div>
        </>
      )}

      {/* Detail view */}
      {selectedCardId !== null && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-sm text-neutral-400 dark:text-white/40">Loading…</div>}>
          <CardDetail
            cardId={selectedCardId}
            onClose={() => setSelectedCardId(null)}
            onSelectCard={openCard}
          />
        </Suspense>
      )}
    </div>
  );
}
