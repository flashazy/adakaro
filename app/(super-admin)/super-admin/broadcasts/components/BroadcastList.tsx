"use client";

import { useCallback, useEffect, useState } from "react";
import type { Database } from "@/types/supabase";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { broadcastRecipientLabel } from "@/lib/broadcasts/broadcast-recipient-label";
import { ReadersModal } from "./ReadersModal";
import {
  BroadcastEmptyState,
  BroadcastSectionCard,
  formatBroadcastDate,
  PriorityBadge,
  StatusBadge,
} from "../broadcasts-dashboard-ui";
import { cn } from "@/lib/utils";

type BroadcastRow = Database["public"]["Tables"]["broadcasts"]["Row"];

export function BroadcastList({
  items,
  loading,
  audience,
  refreshKey,
  onDeleted,
  onConfigureReminder,
}: {
  items: BroadcastRow[];
  loading: boolean;
  audience: { schools: number; admins: number };
  refreshKey?: number;
  onDeleted?: (id: string) => void;
  onConfigureReminder?: (payload: {
    targetUserIds: string[];
    title: string;
    message: string;
  }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [readersFor, setReadersFor] = useState<BroadcastRow | null>(null);

  useEffect(() => {
    setError(null);
  }, [refreshKey, items]);

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
      setReadersFor((cur) => (cur?.id === id ? null : cur));
      setPendingDeleteId(null);
      onDeleted?.(id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <BroadcastSectionCard
      title="Sent Broadcasts"
      subtitle="History of messages delivered to school admin dashboards."
      footer="Last updated: Just now"
    >
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

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
          Loading broadcasts…
        </p>
      ) : items.length === 0 ? (
        <div className="mt-2">
          <BroadcastEmptyState />
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {items.map((b) => (
              <article
                key={b.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {b.title}
                  </p>
                  <PriorityBadge urgent={b.is_urgent} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400">Sent</dt>
                    <dd className="font-medium text-slate-800 dark:text-zinc-200">
                      {formatBroadcastDate(b.sent_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Recipients
                    </dt>
                    <dd className="font-medium text-slate-800 dark:text-zinc-200">
                      {broadcastRecipientLabel(b)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Status
                    </dt>
                    <dd className="mt-0.5">
                      <StatusBadge />
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-zinc-300">
                  {b.message}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-zinc-700">
              <thead className="bg-slate-50 dark:bg-zinc-800/40">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Title
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Priority
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Sent Date
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Recipients
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {items.map((b) => (
                  <tr
                    key={b.id}
                    className={cn(
                      "align-middle hover:bg-slate-50 dark:hover:bg-zinc-800/30",
                      deletingId === b.id && "opacity-50"
                    )}
                  >
                    <td className="max-w-[14rem] px-4 py-3">
                      <p className="truncate font-medium text-slate-900 dark:text-white">
                        {b.title}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PriorityBadge urgent={b.is_urgent} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-zinc-300">
                      {formatBroadcastDate(b.sent_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-zinc-300">
                      {broadcastRecipientLabel(b)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReadersFor(b)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          View readers
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(b.id)}
                          disabled={deletingId === b.id}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-zinc-600 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </BroadcastSectionCard>
  );
}
