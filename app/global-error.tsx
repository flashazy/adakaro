"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Adakaro] Global error:", error);
    if (error?.digest) {
      console.error("[Adakaro] Error digest:", error.digest);
    }
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-100`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-indigo-900/5 ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10 sm:p-10">
              <p
                className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-400"
                aria-label="Adakaro"
              >
                AD-A-KA-RO
              </p>

              <div className="mt-8 text-center">
                <p className="text-4xl sm:text-5xl" aria-hidden>
                  ⚠️
                </p>
                <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                  Oops! Something went wrong
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400">
                  The application encountered an unexpected error. Please try
                  refreshing the page.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400">
                  If the problem persists, clear your browser cache or contact
                  support.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto sm:min-w-[10rem]"
                >
                  Refresh Page
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50 dark:hover:bg-zinc-800 sm:w-auto sm:min-w-[10rem]"
                >
                  Go to Dashboard
                </Link>
              </div>

              <p className="mt-8 text-center text-sm text-slate-500 dark:text-zinc-500">
                Need help?{" "}
                <Link
                  href="/contact"
                  className="font-medium text-indigo-600 underline-offset-2 hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Contact support
                </Link>
              </p>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
