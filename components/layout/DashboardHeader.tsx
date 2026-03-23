"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface DashboardHeaderProps {
  fullName: string;
}

export function DashboardHeader({ fullName }: DashboardHeaderProps) {
  const pathname = usePathname();
  const isParent = pathname.startsWith("/parent-dashboard");
  const homeHref = isParent ? "/parent-dashboard" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          Adakaro
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <p className="max-w-[9rem] truncate text-sm text-slate-600 sm:max-w-[14rem] dark:text-zinc-300">
            <span className="text-slate-400 dark:text-zinc-500">Hi, </span>
            {fullName}
          </p>
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
