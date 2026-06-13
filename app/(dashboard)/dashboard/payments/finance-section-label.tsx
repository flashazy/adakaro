/** Tiny uppercase section divider for the Finance hub. */
export function FinanceSectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {children}
      </p>
      <div
        className="h-px min-w-0 flex-1 bg-gradient-to-r from-slate-400/80 via-slate-300/60 to-transparent dark:from-zinc-500/80 dark:via-zinc-600/50 dark:to-transparent"
        aria-hidden
      />
    </div>
  );
}
