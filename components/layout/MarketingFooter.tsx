import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
          aria-label="Footer"
        >
          <Link
            href="/"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Contact
          </Link>
          <Link
            href="/faq"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            FAQ
          </Link>
          <Link
            href="/pricing"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Pricing
          </Link>
          <Link
            href="/privacy"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Terms of Service
          </Link>
          <Link
            href="/login"
            className="text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Sign in
          </Link>
        </nav>
        <p className="text-center text-sm text-slate-500 dark:text-zinc-500">
          © Adakaro 2026
        </p>
      </div>
    </footer>
  );
}
