import Link from "next/link";
import { Sparkles } from "lucide-react";

export function MinimalHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          Adakaro
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to home
        </Link>
      </div>
    </header>
  );
}
