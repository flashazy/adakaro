import Link from "next/link";
import type { Metadata } from "next";
import {
  GraduationCap,
  Info,
  RefreshCw,
  School,
  WifiOff,
} from "lucide-react";
import { OfflineRetryButton } from "./offline-retry-button";
import { OFFLINE_ROUTES } from "@/lib/offline/offline-routes";

export const metadata: Metadata = {
  title: "You're offline — Adakaro",
  description:
    "You're currently offline. Pages you've already visited are still available.",
  robots: { index: false, follow: false },
};

// Force static rendering so the Workbox runtime can precache this route as
// the navigation fallback (see `fallbacks.entries` in `app/sw.ts`). Any
// data fetching here would prevent precaching.
export const dynamic = "force-static";

export default function OfflinePage() {
  // Group by audience so the list is easier to scan; teacher links first
  // (since teachers do the bulk of offline work in this app).
  const teacherRoutes = OFFLINE_ROUTES.filter((r) => r.audience === "teacher");
  const schoolAdminRoutes = OFFLINE_ROUTES.filter(
    (r) => r.audience === "school-admin"
  );

  return (
    <main className="min-h-[100svh] bg-slate-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Hero */}
        <header className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
          >
            <WifiOff className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">
            You&rsquo;re offline
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            We can&rsquo;t reach the network right now. Anything you save will
            be queued and synced automatically when you&rsquo;re back online.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <OfflineRetryButton />
            <Link
              href="/teacher-dashboard/sync-status"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" /> View sync queue
            </Link>
          </div>
        </header>

        {/* Available offline */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Pages you can access offline
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            These pages work offline once you&rsquo;ve opened them at least
            once while online. The list below is everything we&rsquo;ve made
            offline-friendly in this version.
          </p>

          {teacherRoutes.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Teacher
              </h3>
              <ul className="space-y-2">
                {teacherRoutes.map((route) => (
                  <li key={route.path}>
                    <Link
                      href={route.path}
                      className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-school-primary/50 hover:bg-slate-50 dark:border-zinc-700 dark:hover:border-school-primary dark:hover:bg-zinc-800/60"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-school-primary/10 text-school-primary"
                      >
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-school-primary dark:text-white">
                          {route.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-zinc-400">
                          {route.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {schoolAdminRoutes.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                School admin
              </h3>
              <ul className="space-y-2">
                {schoolAdminRoutes.map((route) => (
                  <li key={route.path}>
                    <Link
                      href={route.path}
                      className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-school-primary/50 hover:bg-slate-50 dark:border-zinc-700 dark:hover:border-school-primary dark:hover:bg-zinc-800/60"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-school-primary/10 text-school-primary"
                      >
                        <School className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-school-primary dark:text-white">
                          {route.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-zinc-400">
                          {route.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* How offline access works */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <Info className="h-4 w-4" />
            </span>
            <div className="text-sm text-slate-600 dark:text-zinc-300">
              <p className="font-medium text-slate-900 dark:text-white">
                Tip
              </p>
              <p className="mt-1">
                Visiting a page online once will make it available offline.
                Pages you haven&rsquo;t opened yet will show this screen until
                you connect again.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
