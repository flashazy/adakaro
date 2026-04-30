"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import {
  useConflictCount,
  useOnlineStatus,
  usePendingSyncCount,
} from "@/lib/offline/use-sync";
import { drainQueue } from "@/lib/offline/sync-queue";

interface SyncIndicatorProps {
  /** Where the badge links to (defaults to /teacher-dashboard/sync-status). */
  href?: string;
  className?: string;
}

/**
 * Header-corner indicator. Three states:
 *   - hidden (no items queued and online) → returns null
 *   - online + pending → blue badge with count, links to sync-status
 *   - offline → orange badge with cloud-off icon
 *   - any conflicts → red dot overlay regardless of online state
 */
export function SyncIndicator({
  href = "/teacher-dashboard/sync-status",
  className,
}: SyncIndicatorProps) {
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();
  const conflicts = useConflictCount();
  const [isPending, startTransition] = useTransition();

  const queueCount = pending ?? 0;
  const isOffline = !online;
  const showBadge = queueCount > 0 || isOffline;

  if (!showBadge) return null;

  const content = (
    <>
      {isOffline ? (
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <RefreshCw
          className={`h-4 w-4 shrink-0 ${isPending ? "animate-spin" : ""}`}
          aria-hidden
        />
      )}
      <span>
        {isOffline
          ? queueCount > 0
            ? `Offline · ${queueCount}`
            : "Offline"
          : `${queueCount} pending`}
      </span>
      {conflicts > 0 ? (
        <span
          aria-label={`${conflicts} sync conflict${conflicts === 1 ? "" : "s"}`}
          title={`${conflicts} sync conflict${conflicts === 1 ? "" : "s"}`}
          className="ml-0.5 inline-block h-2 w-2 rounded-full bg-red-500"
        />
      ) : null}
    </>
  );

  const baseClasses = `inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${className ?? ""}`;

  // Online: clickable link to status page.
  if (!isOffline) {
    return (
      <Link
        href={href}
        className={`${baseClasses} border-school-primary/40 bg-[rgb(var(--school-primary-rgb)/0.08)] text-school-primary hover:bg-[rgb(var(--school-primary-rgb)/0.14)]`}
        title="Open sync status"
        onClick={(e) => {
          // Cmd/ctrl-click → let browser open in new tab.
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          // Single click also kicks off a manual drain so the user can
          // visually confirm something happens.
          startTransition(() => {
            void drainQueue({ force: true });
          });
        }}
      >
        {content}
      </Link>
    );
  }

  // Offline: still link to status page (so the user can see what's
  // queued), but use orange "warn" styling.
  return (
    <Link
      href={href}
      className={`${baseClasses} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60`}
      title="You are offline. Tap for details."
    >
      {content}
    </Link>
  );
}
