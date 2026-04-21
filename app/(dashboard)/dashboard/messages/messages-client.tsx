"use client";

import { useCallback, useEffect, useState } from "react";
import type { BroadcastListItem } from "@/app/api/broadcasts/list/route";

function formatSentAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function MessagesClient() {
  const [items, setItems] = useState<BroadcastListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts/list", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: BroadcastListItem[];
        unreadCount?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load messages.");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setError("Something went wrong.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast_id: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update.");
        return;
      }
      await load();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-500 dark:text-zinc-400">Loading…</p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-slate-600 dark:text-zinc-400">
        {unreadCount > 0
          ? `You have ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}.`
          : "You are up to date."}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No broadcasts yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((b) => {
            const read = Boolean(b.read_at);
            return (
              <li key={b.id} className="px-4 py-4 first:rounded-t-xl last:rounded-b-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900 dark:text-white">
                        {b.title}
                      </h2>
                      {b.is_urgent ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/80 dark:text-red-200">
                          Urgent
                        </span>
                      ) : null}
                      {!read ? (
                        <span className="rounded bg-[rgb(var(--school-primary-rgb)/0.16)] px-2 py-0.5 text-xs font-medium text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.22)] dark:text-school-primary">
                          Unread
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                      Sent {formatSentAt(b.sent_at)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-zinc-200">
                      {b.message}
                    </p>
                  </div>
                  {!read ? (
                    <button
                      type="button"
                      onClick={() => void markRead(b.id)}
                      disabled={busyId === b.id}
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {busyId === b.id ? "Saving…" : "Mark as read"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
