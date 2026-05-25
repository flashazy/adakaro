import type { ReactNode } from "react";
import { AdminQuickActionLink } from "@/components/dashboard/admin-quick-action-link";
import {
  adminQuickActionHoverClass,
  adminQuickActionSizeClass,
} from "@/components/dashboard/admin-quick-action-card";
import {
  adminQuickActionCardClass,
  adminQuickActionHubDescClass,
  adminQuickActionIconWrapClass,
  adminQuickActionTitleClass,
} from "@/components/dashboard/admin-quick-action-styles";
import { cn } from "@/lib/utils";

const adminQuickActionHubChipClass =
  "inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white/90 px-2 py-0.5 text-[11px] font-normal leading-none text-slate-500 transition-colors hover:border-[rgb(var(--school-primary-rgb)/0.22)] hover:bg-[rgb(var(--school-primary-rgb)/0.06)] hover:text-slate-700 dark:border-zinc-700/70 dark:bg-zinc-800/40 dark:text-zinc-400 dark:hover:border-[rgb(var(--school-primary-rgb)/0.28)] dark:hover:bg-[rgb(var(--school-primary-rgb)/0.08)] dark:hover:text-zinc-200";

export interface AdminQuickActionHubLink {
  href: string;
  label: string;
  badgeCount?: number;
}

interface AdminQuickActionHubProps {
  title: string;
  description: string;
  icon: ReactNode;
  actions: AdminQuickActionHubLink[];
  className?: string;
}

function PendingBadge({ count }: { count: number }) {
  const label =
    count === 1
      ? "1 request awaiting review"
      : `${count} requests awaiting review`;
  return (
    <span
      className="inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[0.5rem] font-bold leading-none text-white"
      title={label}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Compact hub card — inline chips, same height rhythm as link cards. */
export function AdminQuickActionHub({
  title,
  description,
  icon,
  actions,
  className,
}: AdminQuickActionHubProps) {
  return (
    <div
      className={cn(
        adminQuickActionCardClass,
        adminQuickActionSizeClass,
        "flex items-center gap-3 p-3.5",
        adminQuickActionHoverClass,
        className
      )}
    >
      <div className={cn(adminQuickActionIconWrapClass, "shrink-0")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={adminQuickActionTitleClass}>{title}</p>
        <p className={cn(adminQuickActionHubDescClass, "line-clamp-1")}>
          {description}
        </p>
        <div
          className="mt-1.5 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={`${title} actions`}
        >
          {actions.map((action) => (
            <AdminQuickActionLink
              key={action.href}
              href={action.href}
              className={cn(
                adminQuickActionHubChipClass,
                "touch-manipulation active:scale-[0.98]"
              )}
            >
              {action.label}
              {action.badgeCount != null && action.badgeCount > 0 ? (
                <PendingBadge count={action.badgeCount} />
              ) : null}
            </AdminQuickActionLink>
          ))}
        </div>
      </div>
    </div>
  );
}
