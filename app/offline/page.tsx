import Link from "next/link";
import type { Metadata } from "next";
import { OfflineRetryButton } from "./offline-retry-button";

export const metadata: Metadata = {
  title: "You're offline — Adakaro",
  description:
    "You're currently offline. Pages you've already visited are still available.",
  robots: { index: false, follow: false },
};

// Force static rendering so the Workbox runtime can precache this route as
// the navigation fallback (see `workboxOptions.fallbacks.document` in
// next.config.ts). Any data fetching here would prevent precaching.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-white px-6 py-16 text-center dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div
          aria-hidden
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-school-primary/10 text-school-primary dark:bg-school-primary/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
          >
            <path d="M3 3l18 18" />
            <path d="M10.66 5.1A14.7 14.7 0 0 1 22 8.5l-2 2.5" />
            <path d="M2 8.5a14.7 14.7 0 0 1 4.5-2.85" />
            <path d="M5 12.5a10 10 0 0 1 4-2" />
            <path d="M19 12.5a10 10 0 0 0-3.4-1.9" />
            <path d="M9 16.5a5.5 5.5 0 0 1 6 0" />
            <circle cx="12" cy="20" r="1" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">
          You&rsquo;re offline
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
          We can&rsquo;t reach the network right now. Pages you&rsquo;ve
          already visited are still available. Check your connection and try
          again.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <OfflineRetryButton />
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Go to home
          </Link>
        </div>
      </div>
    </main>
  );
}
