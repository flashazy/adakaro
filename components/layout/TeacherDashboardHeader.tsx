"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { AdakaroLogoMark } from "@/components/brand/AdakaroLogoMark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TeacherAcademicNavDropdown } from "@/components/layout/TeacherAcademicNavDropdown";

function schoolInitials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function userInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const t = displayName.trim();
  return t.slice(0, 2).toUpperCase() || "?";
}

const NAV = [
  { href: "/teacher-dashboard", label: "Dashboard" },
  { href: "/teacher-dashboard/attendance", label: "Attendance" },
  { href: "/teacher-dashboard/lesson-plans", label: "Lesson Plans" },
  { href: "/teacher-dashboard/grades", label: "Marks" },
] as const;

interface TeacherDashboardHeaderProps {
  fullName: string;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  schoolLogoVersion?: number | null;
  schoolCurrency?: string | null;
  avatarUrl?: string | null;
  /**
   * True when the teacher has at least one department role (e.g. Discipline).
   * Passed through for layout parity; the Academic dropdown uses
   * `hasAcademicDepartmentRole` only.
   */
  hasDepartmentRole?: boolean;
  /** True when the teacher is in the Academic department (performance reports). */
  hasAcademicDepartmentRole?: boolean;
  /**
   * True when the teacher is assigned as coordinator for one or more classes.
   * Drives the visibility of the "Coordinator" nav link.
   */
  isCoordinator?: boolean;
}

function schoolLogoSrcWithCacheBust(url: string, version: number): string {
  const base = url.split("?")[0];
  return `${base}?v=${version}`;
}

export function TeacherDashboardHeader({
  fullName,
  schoolName = null,
  schoolLogoUrl = null,
  schoolLogoVersion = null,
  schoolCurrency = null,
  avatarUrl = null,
  hasDepartmentRole = false,
  hasAcademicDepartmentRole = false,
  isCoordinator = false,
}: TeacherDashboardHeaderProps) {
  const pathname = usePathname();
  const schoolTitleLine =
    schoolName?.trim() && schoolCurrency?.trim()
      ? `${schoolName.trim()} (${schoolCurrency.trim()})`
      : schoolName?.trim() ?? "Your school";
  const schoolInitial = schoolName?.trim() ? schoolInitials(schoolName) : "";
  const hasSchoolBranding =
    Boolean(schoolLogoUrl?.trim()) || Boolean(schoolName?.trim());

  const navLinkClass = (href: string) => {
    const active =
      href === "/teacher-dashboard"
        ? pathname === "/teacher-dashboard" || pathname === "/teacher-dashboard/"
        : pathname === href || pathname.startsWith(`${href}/`);
    return [
      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-school-primary text-white dark:bg-school-primary"
        : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
    ].join(" ");
  };

  const onMyDocumentsNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      pathname === "/teacher-dashboard" ||
      pathname === "/teacher-dashboard/"
    ) {
      e.preventDefault();
      document
        .getElementById("my-documents")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "#my-documents");
    }
  };

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

  const schoolLogoBlock = () => (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-800"
      >
        {schoolLogoUrl?.trim() ? (
          <img
            key={`t-hdr-${schoolLogoUrl.trim()}-${schoolLogoVersion ?? 0}`}
            src={
              schoolLogoVersion != null && Number.isFinite(schoolLogoVersion)
                ? schoolLogoSrcWithCacheBust(
                    schoolLogoUrl.trim(),
                    schoolLogoVersion
                  )
                : schoolLogoUrl.trim()
            }
            alt={
              schoolName?.trim() ? `${schoolName.trim()} logo` : "School logo"
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
  );

  if (hasSchoolBranding) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <Link
              href="/teacher-dashboard"
              className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4"
            >
              {schoolLogoBlock()}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold leading-tight text-slate-900 dark:text-white sm:text-xl">
                  {schoolTitleLine}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Teacher: {fullName}
                </p>
              </div>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:gap-3">
              {userAvatar}
              <ThemeToggle />
              <SignOutButton className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800" />
            </div>
          </div>

          <nav
            className="mt-4 flex flex-wrap gap-1"
            aria-label="Teacher navigation"
          >
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={navLinkClass(href)}>
                {label}
              </Link>
            ))}
            {hasAcademicDepartmentRole ? (
              <TeacherAcademicNavDropdown />
            ) : null}
            <Link
              href="/teacher-dashboard#my-documents"
              onClick={onMyDocumentsNavClick}
              className={navLinkClass("/teacher-dashboard/my-documents")}
            >
              My Documents
            </Link>
            {isCoordinator ? (
              <Link
                href="/teacher-dashboard/coordinator"
                className={navLinkClass("/teacher-dashboard/coordinator")}
              >
                Coordinator
              </Link>
            ) : null}
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/teacher-dashboard"
            className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            <AdakaroLogoMark size={36} className="shrink-0 shadow-sm" />
            Adakaro
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {userAvatar}
            <ThemeToggle />
            <SignOutButton className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800" />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-start sm:gap-4 dark:border-zinc-800">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
            {schoolLogoUrl?.trim() ? (
              <img
                key={`t-hdr-${schoolLogoUrl.trim()}-${schoolLogoVersion ?? 0}`}
                src={
                  schoolLogoVersion != null && Number.isFinite(schoolLogoVersion)
                    ? schoolLogoSrcWithCacheBust(
                        schoolLogoUrl.trim(),
                        schoolLogoVersion
                      )
                    : schoolLogoUrl.trim()
                }
                alt={schoolName?.trim() ? `${schoolName.trim()} logo` : "School logo"}
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
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
              {schoolTitleLine}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Teacher: {fullName}
            </p>
          </div>
        </div>

        <nav
          className="mt-4 flex flex-wrap gap-1"
          aria-label="Teacher navigation"
        >
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass(href)}>
              {label}
            </Link>
          ))}
          {hasAcademicDepartmentRole ? (
            <TeacherAcademicNavDropdown />
          ) : null}
          <Link
            href="/teacher-dashboard#my-documents"
            onClick={onMyDocumentsNavClick}
            className={navLinkClass("/teacher-dashboard/my-documents")}
          >
            My Documents
          </Link>
          {isCoordinator ? (
            <Link
              href="/teacher-dashboard/coordinator"
              className={navLinkClass("/teacher-dashboard/coordinator")}
            >
              Coordinator
            </Link>
          ) : null}
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
          >
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
