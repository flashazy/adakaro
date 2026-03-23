export default function ParentDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-7xl px-6 py-8">
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

        {/* Student card skeletons */}
        <div className="mt-8 space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Student header skeleton */}
              <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                    <div className="h-3 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                  </div>
                  <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-zinc-700" />
                </div>
              </div>

              {/* Fee summary bar skeleton */}
              <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 dark:divide-zinc-800 dark:border-zinc-800">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex flex-col items-center gap-1.5 px-4 py-3">
                    <div className="h-3 w-14 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                  </div>
                ))}
              </div>

              {/* Outstanding fees skeleton */}
              <div className="border-b border-slate-200 dark:border-zinc-800">
                <div className="px-6 py-3">
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                </div>
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-zinc-800/50">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between px-6 py-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                        <div className="h-3 w-44 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                      </div>
                      <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent payments skeleton */}
              <div>
                <div className="px-6 py-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 px-6 py-3"
                    >
                      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-zinc-700" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                        <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                      </div>
                      <div className="h-7 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
