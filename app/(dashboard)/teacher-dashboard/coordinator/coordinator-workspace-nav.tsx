"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/teacher-dashboard/coordinator",
    label: "Report Cards",
    match: (path: string) =>
      path === "/teacher-dashboard/coordinator" ||
      path.startsWith("/teacher-dashboard/coordinator/report-settings"),
  },
  {
    href: "/teacher-dashboard/coordinator/streaming",
    label: "Student Streaming",
    match: (path: string) =>
      path === "/teacher-dashboard/coordinator/streaming" ||
      (path.startsWith("/teacher-dashboard/coordinator/streaming") &&
        !path.endsWith("/history")),
  },
  {
    href: "/teacher-dashboard/coordinator/streaming/history",
    label: "Streaming History",
    match: (path: string) =>
      path === "/teacher-dashboard/coordinator/streaming/history",
  },
  {
    href: "/teacher-dashboard/coordinator/syllabus-coverage",
    label: "Syllabus Coverage",
    match: (path: string) =>
      path === "/teacher-dashboard/coordinator/syllabus-coverage" ||
      path.startsWith("/teacher-dashboard/coordinator/syllabus-coverage/"),
  },
] as const;

export function CoordinatorWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Coordinator sections"
      className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2 dark:border-zinc-700/80 dark:bg-zinc-900/40"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-school-primary shadow-sm ring-1 ring-slate-200/80 dark:bg-zinc-900 dark:ring-zinc-700"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
