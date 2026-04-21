"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { AdakaroLogoMark } from "@/components/brand/AdakaroLogoMark";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function schoolInitials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function schoolLogoSrcWithCacheBust(url: string, version: number): string {
  const base = url.split("?")[0];
  return `${base}?v=${version}`;
}

function userInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const t = displayName.trim();
  return t.slice(0, 2).toUpperCase() || "?";
}

interface DashboardHeaderProps {
  fullName: string;
  /** Show link to platform super admin area (profile must be super_admin). */
  isSuperAdmin?: boolean;
  /** User has at least one linked child — show link on school admin routes only. */
  showParentDashboardLink?: boolean;
  /** Public storage URL for the current school logo (school admin dashboard only). */
  schoolLogoUrl?: string | null;
  /** Epoch ms from `schools.updated_at` — appended as `?v=` to bust CDN/browser cache. */
  schoolLogoVersion?: number | null;
  /** School display name — used for title and initials when there is no logo. */
  schoolName?: string | null;
  /** School currency code (e.g. UGX) for title line. */
  schoolCurrency?: string | null;
  /** Profile avatar URL when set. */
  avatarUrl?: string | null;
}

export function DashboardHeader({
  fullName,
  isSuperAdmin = false,
  showParentDashboardLink = false,
  schoolLogoUrl = null,
  schoolLogoVersion = null,
  schoolName = null,
  schoolCurrency = null,
  avatarUrl = null,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const isParent = pathname.startsWith("/parent-dashboard");
  const isSuper = pathname.startsWith("/super-admin");
  const isSchoolAdminArea =
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/parent-dashboard");
  const homeHref = isSuper
    ? "/super-admin"
    : isParent
      ? "/parent-dashboard"
      : "/dashboard";

  const showSchoolIdentity =
    isSchoolAdminArea &&
    !isSuper &&
    (Boolean(schoolLogoUrl?.trim()) || Boolean(schoolName?.trim()));

  const schoolTitleLine =
    schoolName?.trim() && schoolCurrency?.trim()
      ? `${schoolName.trim()} (${schoolCurrency.trim()})`
      : schoolName?.trim() ?? "Your school";

  const schoolInitial =
    schoolName?.trim() ? schoolInitials(schoolName) : "";

  const rightActions = (
    <>
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
    </>
  );

  const userAvatar = (
    <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800">
      {avatarUrl?.trim() ? (
        <img
          src={avatarUrl.trim()}
          alt=""
          className="h-full w-full object-cover"
          width={40}
          height={40}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600 dark:text-zinc-300"
          aria-hidden
        >
          {userInitials(fullName)}
        </span>
      )}
    </div>
  );

  if (showSchoolIdentity) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
                {schoolLogoUrl?.trim() ? (
                  <img
                    key={`hdr-${schoolLogoUrl.trim()}-${schoolLogoVersion ?? 0}`}
                    src={
                      schoolLogoVersion != null &&
                      Number.isFinite(schoolLogoVersion)
                        ? schoolLogoSrcWithCacheBust(
                            schoolLogoUrl.trim(),
                            schoolLogoVersion
                          )
                        : schoolLogoUrl.trim()
                    }
                    alt={
                      schoolName?.trim()
                        ? `${schoolName.trim()} logo`
                        : "School logo"
                    }
                    className="h-full w-full object-contain p-0.5"
                    width={48}
                    height={48}
                  />
                ) : schoolInitial ? (
                  <span
                    className="flex h-full w-full items-center justify-center bg-[rgb(var(--school-primary-rgb)/0.16)] text-sm font-bold text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.20)] dark:text-school-primary"
                    aria-hidden
                  >
                    {schoolInitial}
                  </span>
                ) : (
                  <Building2
                    className="h-6 w-6 text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold leading-tight text-slate-900 dark:text-white sm:text-xl">
                  {schoolTitleLine}
                </p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                  Welcome back, {fullName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:gap-3">
              {rightActions}
              {userAvatar}
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
        </div>
      </header>
    );
  }

  const superAdminNavLink = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      className={
        isActive
          ? "rounded-lg bg-school-primary px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm dark:bg-school-primary"
          : "rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }
    >
      {label}
    </Link>
  );

  const isSuperAdminDashboard =
    pathname === "/super-admin" || pathname === "/super-admin/";
  const isSuperAdminAnalytics = pathname.startsWith("/super-admin/analytics");
  const isSuperAdminActivityLogs = pathname.startsWith(
    "/super-admin/activity-logs"
  );
  const isSuperAdminWatchdog = pathname.startsWith("/super-admin/watchdog");
  const isSuperAdminBroadcasts = pathname.startsWith(
    "/super-admin/broadcasts"
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-5">
          <Link
            href={homeHref}
            className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            <AdakaroLogoMark size={36} className="shrink-0 shadow-sm" />
            Adakaro
          </Link>
          {isSuperAdmin && isSuper ? (
            <nav
              className="flex flex-wrap items-center gap-1 border-l border-slate-200 pl-3 dark:border-zinc-700"
              aria-label="Super admin"
            >
              {superAdminNavLink(
                "/super-admin",
                "Dashboard",
                isSuperAdminDashboard
              )}
              {superAdminNavLink(
                "/super-admin/analytics",
                "Analytics",
                isSuperAdminAnalytics
              )}
              {superAdminNavLink(
                "/super-admin/activity-logs",
                "Activity logs",
                isSuperAdminActivityLogs
              )}
              {superAdminNavLink(
                "/super-admin/watchdog",
                "Watchdog",
                isSuperAdminWatchdog
              )}
              {superAdminNavLink(
                "/super-admin/broadcasts",
                "Broadcast messages",
                isSuperAdminBroadcasts
              )}
            </nav>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {rightActions}
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
