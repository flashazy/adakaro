"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { cn } from "@/lib/utils";
import {
  ACADEMIC_CURRICULUM_COVERAGE,
  ACADEMIC_PROMOTIONS,
  ACADEMIC_REPORTS,
  ACADEMIC_STUDENT_PROFILES,
  LEGACY_ACADEMIC_REPORTS,
  LEGACY_PROMOTIONS,
  LEGACY_STUDENT_PROFILES,
} from "@/lib/academic/academic-hub-paths";
import { BookOpenCheck, FileBarChart, GraduationCap, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function tabMatches(pathname: string, href: string, legacy?: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (legacy && (pathname === legacy || pathname.startsWith(`${legacy}/`))) {
    return true;
  }
  return false;
}

const TAB_CONFIG = [
  {
    href: ACADEMIC_STUDENT_PROFILES,
    label: "Students",
    legacy: LEGACY_STUDENT_PROFILES,
    icon: Users,
  },
  {
    href: ACADEMIC_REPORTS,
    label: "Reports",
    legacy: LEGACY_ACADEMIC_REPORTS,
    icon: FileBarChart,
  },
  {
    href: ACADEMIC_PROMOTIONS,
    label: "Promotions",
    legacy: LEGACY_PROMOTIONS,
    icon: GraduationCap,
    promotionsOnly: true,
  },
  {
    href: ACADEMIC_CURRICULUM_COVERAGE,
    label: "Curriculum Coverage",
    icon: BookOpenCheck,
  },
] as const;

export function AcademicHubTabs({
  showPromotions,
}: {
  showPromotions: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleTabs = TAB_CONFIG.filter(
    (t) => !("promotionsOnly" in t && t.promotionsOnly) || showPromotions
  );

  useEffect(() => {
    const activeTab = scrollRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-current="page"]'
    );
    activeTab?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-w-full min-w-0 overscroll-x-contain scroll-smooth [-webkit-overflow-scrolling:touch]",
        "max-md:-mx-4 max-md:overflow-x-auto max-md:scroll-px-4 max-md:px-4 max-md:touch-pan-x",
        "max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
        "md:overflow-visible"
      )}
    >
      <nav
        className="flex w-max flex-nowrap gap-1 pb-1 md:w-auto"
        aria-label="Academic workspace sections"
        role="tablist"
      >
        {visibleTabs.map((tab) => {
          const active = tabMatches(
            pathname,
            tab.href,
            "legacy" in tab ? tab.legacy : undefined
          );
          const Icon = tab.icon;
          const base =
            "group relative inline-flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 sm:px-4";

          return (
            <NavLinkWithLoading
              key={tab.href}
              href={tab.href}
              className={cn(
                base,
                active
                  ? "border-violet-200/80 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-500/25 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white/80 hover:text-slate-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
              )}
              aria-current={active ? "page" : undefined}
              role="tab"
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-200",
                  active
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                )}
                aria-hidden
              />
              {tab.label}
            </NavLinkWithLoading>
          );
        })}
      </nav>
    </div>
  );
}
