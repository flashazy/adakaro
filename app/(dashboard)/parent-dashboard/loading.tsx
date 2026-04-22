export default function ParentDashboardLoading() {
  return (
    <main>
        {/* KPI cards skeleton — 4 cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                <div className="h-5 w-5 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
              </div>
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
              {i === 3 && (
                <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
              )}
            </div>
          ))}
        </div>

        {/* Collapsed student card skeletons (match default accordion state) */}
        <div className="mt-8 space-y-8">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="bg-slate-50/50 px-6 py-4 dark:bg-zinc-800/30">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-36 max-w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                    <div className="h-3 w-48 max-w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                  </div>
                  <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
    </main>
  );
}
