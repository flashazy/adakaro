import type { ReactNode } from "react";
import { AdminQuickActionLink } from "@/components/dashboard/admin-quick-action-link";
import {
  adminQuickActionCardClass,
  adminQuickActionDescClass,
  adminQuickActionIconWrapClass,
  adminQuickActionTitleClass,
} from "@/components/dashboard/admin-quick-action-styles";
import { cn } from "@/lib/utils";

/** Compact shared sizing for all quick action cards (link + hub). */
export const adminQuickActionSizeClass = "min-h-[104px] h-full";

/** @deprecated Use adminQuickActionSizeClass — kept for hub import compatibility. */
export const adminQuickActionFixedHeightClass = adminQuickActionSizeClass;

/** Subtle hover polish — calm lift on desktop only. */
export const adminQuickActionHoverClass =
  "transition-all duration-200 hover:border-purple-300 hover:shadow-md dark:hover:border-purple-500/40 lg:hover:-translate-y-px";

interface AdminQuickActionCardProps {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  emphasized?: boolean;
  /** Small muted chip (e.g. School Settings metadata). */
  metaChip?: string;
  className?: string;
}

export function AdminQuickActionCard({
  href,
  title,
  description,
  icon,
  emphasized = false,
  metaChip,
  className,
}: AdminQuickActionCardProps) {
  return (
    <AdminQuickActionLink
      href={href}
      className={cn(
        adminQuickActionCardClass,
        adminQuickActionSizeClass,
        "group flex touch-manipulation items-center gap-3 p-3.5 active:scale-[0.98]",
        adminQuickActionHoverClass,
        emphasized &&
          "border-[rgb(var(--school-primary-rgb)/0.28)] dark:border-[rgb(var(--school-primary-rgb)/0.35)]",
        className
      )}
    >
      <div
        className={cn(
          adminQuickActionIconWrapClass,
          "shrink-0 transition-colors group-hover:bg-[rgb(var(--school-primary-rgb)/0.16)] dark:group-hover:bg-[rgb(var(--school-primary-rgb)/0.16)]",
          emphasized &&
            "bg-[rgb(var(--school-primary-rgb)/0.16)] dark:bg-[rgb(var(--school-primary-rgb)/0.20)]"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        {metaChip ? (
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                adminQuickActionTitleClass,
                "group-hover:text-school-primary dark:group-hover:text-school-primary"
              )}
            >
              {title}
            </p>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              {metaChip}
            </span>
          </div>
        ) : (
          <p
            className={cn(
              adminQuickActionTitleClass,
              "group-hover:text-school-primary dark:group-hover:text-school-primary"
            )}
          >
            {title}
          </p>
        )}
        <p className={cn(adminQuickActionDescClass, "line-clamp-2")}>
          {description}
        </p>
      </div>
    </AdminQuickActionLink>
  );
}
