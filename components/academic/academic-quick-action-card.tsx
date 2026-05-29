import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  academicCardBaseClass,
  academicIconContainerLgClass,
  academicQuickActionHeroClass,
} from "./academic-ui-styles";

interface AcademicQuickActionCardProps {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  emphasized?: boolean;
}

export function AcademicQuickActionCard({
  href,
  title,
  description,
  icon,
  emphasized = false,
}: AcademicQuickActionCardProps) {
  return (
    <NavLinkWithLoading
      href={href}
      className={cn(
        "group flex min-h-[124px] touch-manipulation items-center gap-4 p-4",
        academicCardBaseClass,
        academicQuickActionHeroClass,
        "shadow-sm",
        emphasized &&
          "ring-1 ring-[rgb(var(--school-primary-rgb)/0.14)] dark:ring-[rgb(var(--school-primary-rgb)/0.2)]"
      )}
    >
      <div
        className={cn(
          academicIconContainerLgClass,
          "bg-slate-100 group-hover:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:bg-zinc-800 dark:group-hover:bg-[rgb(var(--school-primary-rgb)/0.18)]",
          emphasized &&
            "bg-[rgb(var(--school-primary-rgb)/0.12)] shadow-sm dark:bg-[rgb(var(--school-primary-rgb)/0.16)]"
        )}
      >
        <span className="[&_svg]:h-7 [&_svg]:w-7">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-bold leading-snug text-slate-900 transition-colors duration-200 group-hover:text-school-primary dark:text-white dark:group-hover:text-school-primary">
            {title}
          </p>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm transition-all duration-200 group-hover:border-[rgb(var(--school-primary-rgb)/0.3)] group-hover:bg-[rgb(var(--school-primary-rgb)/0.08)] group-hover:text-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:border-[rgb(var(--school-primary-rgb)/0.35)] dark:group-hover:text-school-primary">
            Open
            <ChevronRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </NavLinkWithLoading>
  );
}
