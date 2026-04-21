"use client";

/**
 * Announcements load and update only through `/api/broadcasts/*` routes (no Supabase client here).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface PrimaryUnread {
  id: string;
  title: string;
  message: string;
  is_urgent: boolean;
  sent_at: string;
}

export function BroadcastBanner({
  showBroadcasts,
}: {
  /** Server-resolved: school admin (not platform super admin), same rules as dashboard admin access. */
  showBroadcasts: boolean;
}) {
  const pathname = usePathname();
  const allowed =
    showBroadcasts &&
    !pathname.startsWith("/parent-dashboard") &&
    !pathname.startsWith("/dashboard/messages");

  const [unreadCount, setUnreadCount] = useState(0);
  const [primaryUnread, setPrimaryUnread] = useState<PrimaryUnread | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts/list?mode=banner", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        unreadCount?: number;
        primaryUnread?: PrimaryUnread | null;
      };
      if (!res.ok) {
        setError(data.error ?? null);
        setUnreadCount(0);
        setPrimaryUnread(null);
        return;
      }
      setUnreadCount(data.unreadCount ?? 0);
      setPrimaryUnread(data.primaryUnread ?? null);
    } catch {
      setError("Could not load messages.");
      setUnreadCount(0);
      setPrimaryUnread(null);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return null;
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Loading announcements…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        {error}
      </div>
    );
  }

  const urgent = primaryUnread?.is_urgent === true;
  const panelClass = urgent
    ? "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/35"
    : "border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-[rgb(var(--school-primary-rgb)/0.32)] dark:bg-[rgb(var(--school-primary-rgb)/0.14)]";

  return (
    <div className="mb-6 space-y-4 print:hidden">
      {primaryUnread ? (
        <div
          className={`rounded-xl border px-4 py-4 shadow-sm ${panelClass}`}
          role="region"
          aria-label="Unread broadcast"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
                  {unreadCount > 1 ? `${unreadCount} unread messages` : "New message"}
                </span>
                {urgent ? (
                  <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-red-500">
                    Urgent
                  </span>
                ) : null}
              </div>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {primaryUnread.title}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-zinc-200">
                {primaryUnread.message}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={actionId === primaryUnread.id}
                onClick={() => void markRead(primaryUnread.id)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 dark:hover:bg-zinc-700"
              >
                {actionId === primaryUnread.id ? "Saving…" : "Mark as read"}
              </button>
              <button
                type="button"
                disabled={actionId === primaryUnread.id}
                onClick={() => void dismiss(primaryUnread.id)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
            <Link
              href="/dashboard/messages"
              className="font-medium text-school-primary underline underline-offset-2 hover:opacity-90 dark:text-school-primary dark:hover:text-school-primary"
            >
              Open Messages
            </Link>{" "}
            for full history.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span>No new broadcast messages.</span>
          <Link
            href="/dashboard/messages"
            className="font-medium text-school-primary hover:opacity-90 dark:text-school-primary dark:hover:opacity-90"
          >
            View Messages
          </Link>
        </div>
      )}
    </div>
  );

  async function markRead(broadcastId: string) {
    setActionId(broadcastId);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast_id: broadcastId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update.");
        return;
      }
      await load();
    } catch {
      setError("Could not update.");
    } finally {
      setActionId(null);
    }
  }

  async function dismiss(broadcastId: string) {
    await markRead(broadcastId);
  }
}
