"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "stacks-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  // Read the actual applied theme after mount (set by the inline bootstrap
  // script in layout.tsx) so we don't fight SSR/hydration.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !(isDark ?? true);
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // private mode etc. — theme just won't persist
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm transition hover:bg-neutral-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
    >
      {isDark === null ? "◐" : isDark ? "🌙" : "☀️"}
    </button>
  );
}
