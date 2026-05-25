/** Tiny uppercase section divider for the Finance hub. */
export function FinanceSectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {children}
      </p>
      <div
        className="h-px min-w-0 flex-1 bg-gradient-to-r from-slate-300/90 via-slate-200/50 to-transparent dark:from-zinc-600/90 dark:via-zinc-700/40 dark:to-transparent"
        aria-hidden
      />
    </div>
  );
}
