"use client";

import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Small right-click menu. Closes on click-away, Escape, or item selection. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // Keep the menu inside the viewport.
  const left = Math.min(x, window.innerWidth - 190);
  const top = Math.min(y, window.innerHeight - items.length * 36 - 12);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-[60] min-w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#1d1f3a]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className="block w-full px-4 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-white/80 dark:hover:bg-white/10"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
