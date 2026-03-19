export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header skeleton */}
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          </div>
          <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPI card skeletons */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                <div className="h-5 w-5 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
              </div>
              <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>

        {/* Chart skeletons */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Line chart skeleton (full width) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-1 h-3 w-52 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800" />
          </div>

          {/* Pie chart skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-1 h-3 w-44 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-4 flex h-56 items-center justify-center">
              <div className="h-40 w-40 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />
            </div>
          </div>

          {/* Bar chart skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-1 h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Quick links skeleton */}
        <div className="mt-8">
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
