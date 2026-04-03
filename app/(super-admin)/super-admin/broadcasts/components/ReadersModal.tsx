"use client";

import { useCallback, useEffect, useState } from "react";

interface ReaderRow {
  user_id: string;
  full_name: string;
  school_name: string;
  read_at: string;
}

interface NotReadRow {
  user_id: string;
  full_name: string;
  school_name: string;
}

interface ReadersPayload {
  targetUserIds: string[];
  title: string;
  message: string;
}

export function ReadersModal(props: {
  open: boolean;
  broadcastId: string | null;
  broadcastTitle: string;
  broadcastMessage: string;
  onClose: () => void;
  onConfigureReminder: (payload: ReadersPayload) => void;
}) {
  const {
    open,
    broadcastId,
    broadcastTitle,
    broadcastMessage,
    onClose,
    onConfigureReminder,
  } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    total_school_admins: number;
    read_count: number;
    not_read_count: number;
    read_percent: number;
    read: ReaderRow[];
    not_read: NotReadRow[];
    unread_user_ids: string[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!broadcastId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/broadcasts/${encodeURIComponent(broadcastId)}/readers`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        total_school_admins?: number;
        read_count?: number;
        not_read_count?: number;
        read_percent?: number;
        read?: ReaderRow[];
        not_read?: NotReadRow[];
        unread_user_ids?: string[];
      };
      if (!res.ok) {
        setError(json.error ?? "Could not load readers.");
        setData(null);
        return;
      }
      setData({
        total_school_admins: json.total_school_admins ?? 0,
        read_count: json.read_count ?? 0,
        not_read_count: json.not_read_count ?? 0,
        read_percent: json.read_percent ?? 0,
        read: json.read ?? [],
        not_read: json.not_read ?? [],
        unread_user_ids: json.unread_user_ids ?? [],
      });
    } catch {
      setError("Something went wrong.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [broadcastId]);

  useEffect(() => {
    if (open && broadcastId) {
      void load();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, broadcastId, load]);

  function formatReadAt(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="readers-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(90vh,900px)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[85vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
          <h2
            id="readers-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            View readers
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
            Broadcast: {broadcastTitle}
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
              Loading…
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && data ? (
            <>
              <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
                Total school admins: {data.total_school_admins}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                ✅ Read: {data.read_count} (
                {data.total_school_admins > 0
                  ? `${data.read_percent}%`
                  : "0%"}
                )
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-400">
                ❌ Not read: {data.not_read_count} (
                {data.total_school_admins > 0
                  ? `${Math.round((data.not_read_count / data.total_school_admins) * 1000) / 10}%`
                  : "0%"}
                )
              </p>

              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                  === READ ({data.read.length}) ===
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                  {data.read.length === 0 ? (
                    <li className="text-slate-500 dark:text-zinc-500">None yet.</li>
                  ) : (
                    data.read.map((r) => (
                      <li key={r.user_id}>
                        - {r.full_name} ({r.school_name}) — read{" "}
                        {formatReadAt(r.read_at)}
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                  === NOT READ ({data.not_read.length}) ===
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                  {data.not_read.length === 0 ? (
                    <li className="text-slate-500 dark:text-zinc-500">Everyone read it.</li>
                  ) : (
                    data.not_read.map((r) => (
                      <li key={r.user_id}>
                        - {r.full_name} ({r.school_name})
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {data.not_read_count > 0 ? (
                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureReminder({
                        targetUserIds: data.unread_user_ids,
                        title: `Reminder: ${broadcastTitle}`,
                        message: `This is a reminder about: ${broadcastMessage}`,
                      });
                      onClose();
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950/80"
                  >
                    Send reminder to unread ({data.not_read_count})
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                    Pre-fills the form above; only unread admins will see this
                    broadcast.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
