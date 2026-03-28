"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdakaroLogoMark } from "@/components/brand/AdakaroLogoMark";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface DashboardHeaderProps {
  fullName: string;
  /** Show link to platform super admin area (profile must be super_admin). */
  isSuperAdmin?: boolean;
  /** User has at least one linked child — show link on school admin routes only. */
  showParentDashboardLink?: boolean;
}

export function DashboardHeader({
  fullName,
  isSuperAdmin = false,
  showParentDashboardLink = false,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const isParent = pathname.startsWith("/parent-dashboard");
  const isSuper = pathname.startsWith("/super-admin");
  const isSchoolAdminArea =
    pathname.startsWith("/dashboard") && !pathname.startsWith("/parent-dashboard");
  const homeHref = isSuper
    ? "/super-admin"
    : isParent
      ? "/parent-dashboard"
      : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
        >
          <AdakaroLogoMark size={36} className="shrink-0 shadow-sm" />
          Adakaro
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {isSuperAdmin && isSuper ? (
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              School app
            </Link>
          ) : null}
          {isSuperAdmin && !isSuper ? (
            <Link
              href="/super-admin"
              className="rounded-lg px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-300/80 hover:bg-amber-50 dark:text-amber-200 dark:ring-amber-700/60 dark:hover:bg-amber-950/40"
            >
              Super Admin
            </Link>
          ) : null}
          {showParentDashboardLink && isSchoolAdminArea && !isSuper ? (
            <Link
              href="/parent-dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Parent dashboard
            </Link>
          ) : null}
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
