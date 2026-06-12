"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  GitBranch,
  History,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}[] = [
  {
    href: "/teacher-dashboard/coordinator",
    label: "Report Cards",
    icon: FileText,
    match: (path) =>
      path === "/teacher-dashboard/coordinator" ||
      path.startsWith("/teacher-dashboard/coordinator/report-settings"),
  },
  {
    href: "/teacher-dashboard/coordinator/streaming",
    label: "Student Streaming",
    icon: GitBranch,
    match: (path) =>
      path === "/teacher-dashboard/coordinator/streaming" ||
      (path.startsWith("/teacher-dashboard/coordinator/streaming") &&
        !path.endsWith("/history")),
  },
  {
    href: "/teacher-dashboard/coordinator/streaming/history",
    label: "Streaming History",
    icon: History,
    match: (path) =>
      path === "/teacher-dashboard/coordinator/streaming/history",
  },
  {
    href: "/teacher-dashboard/coordinator/syllabus-coverage",
    label: "Syllabus Coverage",
    icon: BookOpen,
    match: (path) =>
      path === "/teacher-dashboard/coordinator/syllabus-coverage" ||
      path.startsWith("/teacher-dashboard/coordinator/syllabus-coverage/"),
  },
];

export function CoordinatorWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Coordinator sections"
      className={cn(
        "grid grid-cols-2 auto-rows-fr gap-3 rounded-2xl border border-slate-200/40 bg-slate-50/30 p-3",
        "dark:border-zinc-700/45 dark:bg-zinc-900/20",
        "md:flex md:flex-wrap md:gap-2 md:border-slate-200/80 md:bg-slate-50/60 md:p-2 dark:md:border-zinc-700/80 dark:md:bg-zinc-900/40"
      )}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative overflow-hidden rounded-xl font-medium",
              "transition-[background,box-shadow,border-color,color,transform] duration-300 ease-in-out",
              "flex h-[76px] touch-manipulation flex-col items-stretch justify-center px-2 py-2",
              "text-[13px] leading-tight",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/25",
              "active:scale-[0.99] max-md:hover:shadow-[0_2px_6px_-1px_rgba(15,23,42,0.08)]",
              "md:h-auto md:items-stretch md:justify-start md:overflow-visible md:px-4 md:py-2 md:text-left md:text-sm md:leading-normal md:shadow-none md:active:scale-100 md:hover:shadow-none md:focus-visible:ring-0",
              active
                ? cn(
                    "border border-[rgb(var(--school-primary-rgb)/0.4)] text-school-primary",
                    "max-md:bg-gradient-to-b max-md:from-[rgb(var(--school-primary-rgb)/0.12)] max-md:to-[rgb(var(--school-primary-rgb)/0.05)]",
                    "max-md:shadow-[0_3px_12px_-3px_rgba(88,28,135,0.24)]",
                    "dark:max-md:from-[rgb(var(--school-primary-rgb)/0.16)] dark:max-md:to-[rgb(var(--school-primary-rgb)/0.07)]",
                    "dark:max-md:shadow-[0_3px_12px_-3px_rgba(0,0,0,0.42)]",
                    "md:bg-white md:text-school-primary md:shadow-sm md:ring-1 md:ring-slate-200/80 dark:md:bg-zinc-900 dark:md:ring-zinc-700"
                  )
                : cn(
                    "border border-slate-200/90 bg-white text-slate-600 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]",
                    "dark:border-zinc-700/85 dark:bg-zinc-900/80 dark:text-zinc-300",
                    "max-md:hover:border-slate-300/90",
                    "md:border-0 md:bg-transparent md:text-slate-600 md:shadow-none md:hover:bg-white/70 md:hover:text-slate-900 dark:md:text-zinc-400 dark:md:hover:bg-zinc-900/60 dark:md:hover:text-zinc-100"
                  )
            )}
          >
            <span
              className={cn(
                "flex h-4 w-full shrink-0 items-center justify-center md:hidden",
                active && "text-school-primary"
              )}
              aria-hidden
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active
                    ? "text-school-primary"
                    : "text-slate-400 dark:text-zinc-500"
                )}
                strokeWidth={active ? 2.25 : 1.75}
              />
            </span>
            <span className="flex min-h-[2.5rem] w-full items-center justify-center px-1 text-center md:min-h-0 md:block md:px-0 md:text-left">
              <span className="block max-w-[9.25rem] whitespace-normal text-balance">
                {tab.label}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
