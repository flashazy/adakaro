"use client";

import { useBodyScrollLock } from "@/components/super-admin/smart-intelligence/use-body-scroll-lock";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Users, X } from "lucide-react";
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

interface ReadersData {
  audience_scope: string;
  audience_scope_label: string;
  target_school_name: string | null;
  total_school_admins: number;
  read_count: number;
  not_read_count: number;
  read_percent: number;
  read: ReaderRow[];
  not_read: NotReadRow[];
  unread_user_ids: string[];
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

  useBodyScrollLock(open);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReadersData | null>(null);

  const load = useCallback(async () => {
    if (!broadcastId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/broadcasts/${encodeURIComponent(broadcastId)}/readers`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as Partial<ReadersData> & {
        error?: string;
        recipient_count?: number;
      };
      if (!res.ok) {
        setError("Unable to load readers. Please try again.");
        setData(null);
        return;
      }
      setData({
        audience_scope: json.audience_scope ?? "all_schools",
        audience_scope_label: json.audience_scope_label ?? "All schools",
        target_school_name: json.target_school_name ?? null,
        total_school_admins: json.total_school_admins ?? json.recipient_count ?? 0,
        read_count: json.read_count ?? 0,
        not_read_count: json.not_read_count ?? 0,
        read_percent: json.read_percent ?? 0,
        read: json.read ?? [],
        not_read: json.not_read ?? [],
        unread_user_ids: json.unread_user_ids ?? [],
      });
    } catch {
      setError("Unable to load readers. Please try again.");
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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  const notReadPercent =
    data && data.total_school_admins > 0
      ? Math.round((data.not_read_count / data.total_school_admins) * 1000) / 10
      : 0;

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
          <div className="min-w-0">
            <h2
              id="readers-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              View readers
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">
              {broadcastTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">Loading…</p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && data ? (
            <>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                    <Users className="h-3 w-3" aria-hidden />
                    Audience: {data.audience_scope_label}
                  </span>
                  {data.target_school_name ? (
                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      School: {data.target_school_name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
                  Recipients:{" "}
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {data.total_school_admins}
                  </span>{" "}
                  admin{data.total_school_admins === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-center dark:border-zinc-700 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {data.total_school_admins}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-center dark:border-emerald-900/40 dark:bg-emerald-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Read
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {data.read_count}
                  </p>
                  <p className="text-[10px] tabular-nums text-emerald-700/80 dark:text-emerald-400/80">
                    {data.read_percent}%
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-center dark:border-rose-900/40 dark:bg-rose-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                    Not read
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-rose-800 dark:text-rose-200">
                    {data.not_read_count}
                  </p>
                  <p className="text-[10px] tabular-nums text-rose-700/80 dark:text-rose-400/80">
                    {notReadPercent}%
                  </p>
                </div>
              </div>

              <section className="mt-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Read ({data.read.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.read.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-500">
                      No reads yet.
                    </li>
                  ) : (
                    data.read.map((r) => (
                      <li
                        key={r.user_id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50"
                      >
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {r.full_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {r.school_name}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                          Read {formatReadAt(r.read_at)}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="mt-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                  <Circle className="h-3.5 w-3.5" aria-hidden />
                  Not read ({data.not_read.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.not_read.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-500">
                      Everyone in the audience has read this message.
                    </li>
                  ) : (
                    data.not_read.map((r) => (
                      <li
                        key={r.user_id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50"
                      >
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {r.full_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {r.school_name}
                        </p>
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
                    className={cn(
                      "w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100",
                      "dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950/80"
                    )}
                  >
                    Send reminder to unread ({data.not_read_count})
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                    Pre-fills the form above; only unread admins in this
                    broadcast&apos;s audience will receive the reminder.
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
