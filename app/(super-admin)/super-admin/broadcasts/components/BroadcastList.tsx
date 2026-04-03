"use client";

import { useCallback, useEffect, useState } from "react";
import type { Database } from "@/types/supabase";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { ReadersModal } from "./ReadersModal";

type BroadcastRow = Database["public"]["Tables"]["broadcasts"]["Row"];

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

export function BroadcastList({
  refreshKey,
  onConfigureReminder,
}: {
  refreshKey?: number;
  onConfigureReminder?: (payload: {
    targetUserIds: string[];
    title: string;
    message: string;
  }) => void;
}) {
  const [items, setItems] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [readersFor, setReadersFor] = useState<BroadcastRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts/list", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: BroadcastRow[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load broadcasts.");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Something went wrong.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const closeDeleteModal = useCallback(() => {
    if (deletingId !== null) return;
    setPendingDeleteId(null);
  }, [deletingId]);

  async function executeDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/broadcasts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete.");
        return;
      }
      setItems((prev) => prev.filter((b) => b.id !== id));
      setReadersFor((cur) => (cur?.id === id ? null : cur));
      setPendingDeleteId(null);
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Loading broadcasts…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <ConfirmDeleteModal
        open={pendingDeleteId !== null}
        onClose={closeDeleteModal}
        onConfirm={() => {
          const id = pendingDeleteId;
          if (!id) return;
          void executeDelete(id);
        }}
        isDeleting={pendingDeleteId !== null && deletingId === pendingDeleteId}
      />
      <ReadersModal
        open={readersFor !== null}
        broadcastId={readersFor?.id ?? null}
        broadcastTitle={readersFor?.title ?? ""}
        broadcastMessage={readersFor?.message ?? ""}
        onClose={() => setReadersFor(null)}
        onConfigureReminder={(payload) => {
          onConfigureReminder?.(payload);
        }}
      />
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Sent broadcasts
      </h2>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
          No broadcasts yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-zinc-700">
          {items.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {b.title}
                  </p>
                  {b.is_urgent ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/80 dark:text-red-200">
                      Urgent
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  Sent {formatSentAt(b.sent_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-zinc-300">
                  {b.message}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReadersFor(b)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  View readers
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(b.id)}
                  disabled={deletingId === b.id}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-zinc-600 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  {deletingId === b.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
