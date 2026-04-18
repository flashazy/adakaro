import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-indigo-900/5 ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10 sm:p-10">
        <p
          className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-400"
          aria-label="Adakaro"
        >
          AD-A-KA-RO
        </p>

        <div className="mt-8 text-center">
          <p className="text-4xl sm:text-5xl" aria-hidden>
            🔍
          </p>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            Page not found
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400">
            We could not find the page you were looking for. It may have been
            moved, or the link might be incorrect.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400">
            Use the buttons below to continue, or contact support if you need
            assistance.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50 dark:hover:bg-zinc-800 sm:w-auto sm:min-w-[10rem]"
          >
            Go to Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto sm:min-w-[10rem]"
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
  );
}
