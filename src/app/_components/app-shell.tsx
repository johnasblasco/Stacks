"use client";

import React, { Suspense, useState } from "react";

import { Board } from "./board";

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
