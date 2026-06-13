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
export const adminQuickActionSizeClass =
  "min-h-[104px] h-full lg:min-h-[92px]";

/** @deprecated Use adminQuickActionSizeClass — kept for hub import compatibility. */
export const adminQuickActionFixedHeightClass = adminQuickActionSizeClass;

/** Subtle hover polish — lift and shadow on desktop; tap feedback on mobile. */
export const adminQuickActionHoverClass =
  "transition-all duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none active:scale-[0.99] lg:cursor-pointer lg:hover:-translate-y-0.5 lg:hover:border-[rgb(var(--school-primary-rgb)/0.24)] lg:hover:shadow-md dark:lg:hover:border-[rgb(var(--school-primary-rgb)/0.32)]";

interface AdminQuickActionCardProps {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  emphasized?: boolean;
  /** Small muted chip (e.g. School Settings metadata). */
  metaChip?: string;
  metaChipTone?: "default" | "primary";
  className?: string;
}

export function AdminQuickActionCard({
  href,
  title,
  description,
  icon,
  emphasized = false,
  metaChip,
  metaChipTone = "default",
  className,
}: AdminQuickActionCardProps) {
  return (
    <AdminQuickActionLink
      href={href}
      className={cn(
        adminQuickActionCardClass,
        adminQuickActionSizeClass,
        "group flex touch-manipulation items-center gap-3 p-3.5 active:scale-[0.99] lg:gap-2.5 lg:p-3",
        adminQuickActionHoverClass,
        emphasized &&
          "border-[rgb(var(--school-primary-rgb)/0.28)] dark:border-[rgb(var(--school-primary-rgb)/0.35)]",
        className
      )}
    >
      <div
        className={cn(
          adminQuickActionIconWrapClass,
          "shrink-0 transition-colors duration-200 group-hover:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:group-hover:bg-[rgb(var(--school-primary-rgb)/0.22)]",
          emphasized &&
            "bg-[rgb(var(--school-primary-rgb)/0.16)] dark:bg-[rgb(var(--school-primary-rgb)/0.20)]"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        {metaChip ? (
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                adminQuickActionTitleClass,
                "min-w-0 group-hover:text-school-primary dark:group-hover:text-school-primary"
              )}
            >
              {title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full leading-none",
                metaChipTone === "primary"
                  ? "px-2.5 py-1 text-[11px] font-semibold bg-[rgb(var(--school-primary-rgb)/0.14)] text-school-primary ring-1 ring-[rgb(var(--school-primary-rgb)/0.28)] dark:bg-[rgb(var(--school-primary-rgb)/0.2)] dark:ring-[rgb(var(--school-primary-rgb)/0.35)]"
                  : "px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
              )}
            >
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
