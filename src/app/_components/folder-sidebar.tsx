"use client";

import type { CardStatus } from "@/server/db/schema";

type FolderSidebarProps = {
  categories: string[];
  category: string | null;
  status: CardStatus;
  recentOnly: boolean;
  onSelectSystem: (status: CardStatus) => void;
  onSelectFolder: (category: string) => void;
  onSelectRecent: () => void;
  onNewFolder: () => void;
  onClose?: () => void;
};

const systemViews: Array<{
  status: CardStatus;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    status: "active",
    label: "All notes",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    status: "archived",
    label: "Archived",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" />
      </svg>
    ),
  },
  {
    status: "trashed",
    label: "Trash",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
      </svg>
    ),
  },
];

const itemClass =
  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition";

export function FolderSidebar({
  categories,
  category,
  status,
  recentOnly,
  onSelectSystem,
  onSelectFolder,
  onSelectRecent,
  onNewFolder,
  onClose,
}: FolderSidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200/80 bg-neutral-50/90 p-3 text-neutral-700 backdrop-blur-xl dark:border-white/10 dark:bg-[#0d101b]/95 dark:text-white/70">
      <div className="mb-3 flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
            S
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-neutral-950 dark:text-white">
              Stacks
            </p>
            <p className="text-[10px] tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
              Library
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      <nav aria-label="Card views" className="space-y-1">
        {systemViews.map((view) => {
          const active =
            !recentOnly && category === null && status === view.status;
          return (
            <button
              key={view.status}
              type="button"
              onClick={() => onSelectSystem(view.status)}
              className={`${itemClass} ${
                active
                  ? "bg-white text-violet-700 shadow-sm ring-1 ring-neutral-200 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10"
                  : "hover:bg-neutral-200/70 hover:text-neutral-950 dark:hover:bg-white/5 dark:hover:text-white"
              }`}
            >
              <span className="h-4 w-4 shrink-0">{view.icon}</span>
              <span>{view.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onSelectRecent}
          className={`${itemClass} ${
            recentOnly
              ? "bg-white text-violet-700 shadow-sm ring-1 ring-neutral-200 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10"
              : "hover:bg-neutral-200/70 hover:text-neutral-950 dark:hover:bg-white/5 dark:hover:text-white"
          }`}
        >
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>Recently saved</span>
          {recentOnly && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
          )}
        </button>
      </nav>

      <div className="my-4 h-px bg-neutral-200/80 dark:bg-white/10" />

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[10px] font-bold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
            Folders
          </p>
          <span className="text-[10px] text-neutral-400 tabular-nums dark:text-white/30">
            {categories.length}
          </span>
        </div>
        <nav aria-label="Folders" className="space-y-1">
          {categories.map((folder) => {
            const active =
              !recentOnly && status === "active" && category === folder;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => onSelectFolder(folder)}
                className={`${itemClass} ${
                  active
                    ? "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
                    : "hover:bg-neutral-200/70 hover:text-neutral-950 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                </svg>
                <span className="truncate">{folder}</span>
              </button>
            );
          })}
          {categories.length === 0 && (
            <p className="px-3 py-3 text-xs leading-relaxed text-neutral-400 dark:text-white/35">
              Create a folder to organize your first stack.
            </p>
          )}
        </nav>
      </div>

      <button
        type="button"
        onClick={onNewFolder}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-100 dark:border-violet-400/35 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
      >
        <span className="text-lg leading-none">＋</span>
        New folder
      </button>
    </aside>
  );
}
