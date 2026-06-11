"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { academicQuickActionIsActive } from "@/lib/academic/academic-hub-paths";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const isActive = academicQuickActionIsActive(pathname, href);

  return (
    <NavLinkWithLoading
      href={href}
      aria-label={`${title}. ${description}`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex h-full min-h-[132px] touch-manipulation items-center gap-3.5 p-4",
        academicCardBaseClass,
        academicQuickActionHeroClass,
        "shadow-sm",
        isActive &&
          "border-[rgb(var(--school-primary-rgb)/0.35)] bg-[rgb(var(--school-primary-rgb)/0.06)] ring-1 ring-[rgb(var(--school-primary-rgb)/0.18)] dark:border-[rgb(var(--school-primary-rgb)/0.4)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)] dark:ring-[rgb(var(--school-primary-rgb)/0.25)]",
        !isActive &&
          emphasized &&
          "ring-1 ring-[rgb(var(--school-primary-rgb)/0.14)] dark:ring-[rgb(var(--school-primary-rgb)/0.2)]"
      )}
    >
      <div
        className={cn(
          academicIconContainerLgClass,
          "self-start bg-slate-100 group-hover:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:bg-zinc-800 dark:group-hover:bg-[rgb(var(--school-primary-rgb)/0.18)]",
          (isActive || emphasized) &&
            "bg-[rgb(var(--school-primary-rgb)/0.12)] shadow-sm dark:bg-[rgb(var(--school-primary-rgb)/0.16)]"
        )}
      >
        <span className="[&_svg]:h-7 [&_svg]:w-7">{icon}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p
          className={cn(
            "text-base font-bold leading-snug text-slate-900 transition-colors duration-200 dark:text-white",
            isActive
              ? "text-school-primary dark:text-school-primary"
              : "group-hover:text-school-primary dark:group-hover:text-school-primary"
          )}
        >
          {title}
        </p>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {description}
        </p>
      </div>

      <ChevronRight
        className={cn(
          "h-5 w-5 shrink-0 transition-all duration-200",
          isActive
            ? "text-school-primary"
            : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-school-primary dark:text-zinc-600 dark:group-hover:text-school-primary"
        )}
        aria-hidden
      />
    </NavLinkWithLoading>
  );
}
