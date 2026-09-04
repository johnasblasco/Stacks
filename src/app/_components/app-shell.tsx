"use client";

import { signOut } from "next-auth/react";
import React, { Suspense, useCallback, useEffect, useState } from "react";

import { Board } from "./board";

const ChatPanel = React.lazy(() =>
  import("./chat-panel").then((module) => ({ default: module.ChatPanel })),
);

const chatFallback = (
  <div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-white/40">
    Loading recall…
  </div>
);

export function AppShell() {
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [desktopChatOpen, setDesktopChatOpen] = useState(true);
  const [expandCardId, setExpandCardId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = useCallback(() => setLoggingOut(true), []);

  useEffect(() => {
    if (!loggingOut) return;
    const timer = setTimeout(() => void signOut({ callbackUrl: "/" }), 600);
    return () => clearTimeout(timer);
  }, [loggingOut]);

  const openCard = (id: number) => {
    setExpandCardId(id);
    setMobileChatOpen(false);
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--canvas)] text-neutral-900 dark:bg-[var(--canvas-dark)] dark:text-white">
      {loggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-[#090b12]">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-500 dark:border-white/20 dark:border-t-violet-400" />
          <p className="text-sm text-neutral-500 dark:text-white/50">
            Signing out…
          </p>
        </div>
      )}

      <Board
        highlightedIds={highlightedIds}
        onSelectCard={openCard}
        expandCardId={expandCardId}
        onExpandHandled={() => setExpandCardId(null)}
      />

      {desktopChatOpen && (
        <div className="hidden w-[24rem] shrink-0 lg:block xl:w-[27rem]">
          <Suspense fallback={chatFallback}>
            <ChatPanel
              onClose={() => setDesktopChatOpen(false)}
              onAnswered={setHighlightedIds}
              onSelectCard={openCard}
              onSignOut={handleSignOut}
            />
          </Suspense>
        </div>
      )}

      {!desktopChatOpen && (
        <button
          type="button"
          onClick={() => setDesktopChatOpen(true)}
          className="fixed right-6 bottom-6 z-40 hidden items-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-violet-600 lg:flex dark:bg-violet-600"
        >
          <span aria-hidden>✦</span> Ask Stacks
        </button>
      )}

      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden dark:bg-[#11131f]">
          <Suspense fallback={chatFallback}>
            <ChatPanel
              onClose={() => setMobileChatOpen(false)}
              onAnswered={setHighlightedIds}
              onSelectCard={openCard}
              onSignOut={handleSignOut}
            />
          </Suspense>
        </div>
      )}

      {!mobileChatOpen && (
        <button
          type="button"
          onClick={() => setMobileChatOpen(true)}
          aria-label="Open Ask Stacks"
          className="fixed right-5 bottom-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-violet-600 text-xl text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-500 lg:hidden"
        >
          ✦
        </button>
      )}
    </div>
  );
}
