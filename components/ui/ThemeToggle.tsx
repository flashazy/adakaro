"use client";

import { useTheme } from "next-themes";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Cycles theme: system → light → dark. Shows moon/sun based on resolved appearance.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        aria-hidden
      >
        <Moon className="h-5 w-5" strokeWidth={1.75} />
      </span>
    );
  }

  function cycle() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  const isDark = resolvedTheme === "dark";
  const label =
    theme === "system"
      ? `System (${isDark ? "dark" : "light"})`
      : theme === "dark"
        ? "Dark"
        : "Light";

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      title={`Theme: ${label} — click to change`}
      aria-label={`Theme: ${label}. Click to cycle system, light, and dark.`}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
