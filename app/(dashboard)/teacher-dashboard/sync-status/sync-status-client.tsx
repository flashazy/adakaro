"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Eye,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  acceptServerVersion,
  discardItem,
  drainQueue,
  forceRetry,
  keepLocalOverServer,
} from "@/lib/offline/sync-queue";
import {
  useOnlineStatus,
  usePendingSyncItems,
} from "@/lib/offline/use-sync";
import type { PendingSyncRow, SyncItemKind } from "@/lib/offline/db";

const KIND_LABELS: Record<SyncItemKind, string> = {
  "save-attendance": "Attendance",
  "save-scores": "Marks",
  "create-gradebook-assignment": "New assignment",
  "delete-gradebook-assignment": "Deleted assignment",
};

function formatTimestamp(ms: number): string {
  if (!ms) return "—";
  try {
    const d = new Date(ms);
    return d.toLocaleString();
  } catch {
    return new Date(ms).toISOString();
  }
}

function describeItem(item: PendingSyncRow): string {
  if (item.label) return item.label;
  const p = item.payload as Record<string, unknown> | null;
  if (item.kind === "save-attendance" && p) {
    const cls = (p["classId"] as string | undefined) ?? "";
    const date = (p["date"] as string | undefined) ?? "";
    const records = Array.isArray(p["records"]) ? p["records"].length : 0;
    return `Class ${cls.slice(0, 8) || "?"} · ${date || "?"} · ${records} student${records === 1 ? "" : "s"}`;
  }
  if (item.kind === "save-scores" && p) {
    const aid = (p["assignmentId"] as string | undefined) ?? "";
    const scores = Array.isArray(p["scores"]) ? p["scores"].length : 0;
    return `Assignment ${aid.slice(0, 8) || "?"} · ${scores} mark${scores === 1 ? "" : "s"}`;
  }
  return KIND_LABELS[item.kind];
}

export function SyncStatusClient() {
  const items = usePendingSyncItems();
  const online = useOnlineStatus();
  const [drainPending, startDrain] = useTransition();
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [conflictView, setConflictView] = useState<PendingSyncRow | null>(null);
  const [banner, setBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  if (items === null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Loading queued items…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
          Nothing waiting to sync
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          All your offline changes have been sent to the server.
        </p>
      </div>
    );
  }

  const pending = items.filter(
    (i) => i.status === "pending" || i.status === "running"
  );
  const conflicts = items.filter((i) => i.status === "conflict");
  const failed = items.filter((i) => i.status === "failed");

  async function handleSyncAll() {
    setBanner(null);
    startDrain(() => {
      void (async () => {
        try {
          const res = await drainQueue({ force: true });
          if (res.succeeded > 0) {
            setBanner({
              kind: "ok",
              text: `Synced ${res.succeeded} item${res.succeeded === 1 ? "" : "s"}.`,
            });
          } else if (res.attempted === 0) {
            setBanner({
              kind: "ok",
              text: "Nothing was due to sync.",
            });
          } else {
            setBanner({
              kind: "err",
              text: "Items still pending — check error details below.",
            });
          }
        } catch (e) {
          setBanner({
            kind: "err",
            text: e instanceof Error ? e.message : "Sync failed.",
          });
        }
      })();
    });
  }

  async function handleRetry(uuid: string) {
    setBusyUuid(uuid);
    setBanner(null);
    try {
      await forceRetry(uuid);
      await drainQueue({ force: true });
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleDiscard(uuid: string) {
    if (!window.confirm("Discard this item permanently? This cannot be undone."))
      return;
    setBusyUuid(uuid);
    try {
      await discardItem(uuid);
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleKeepLocal(uuid: string) {
    setBusyUuid(uuid);
    try {
      await keepLocalOverServer(uuid);
      await drainQueue({ force: true });
      setConflictView(null);
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleAcceptServer(uuid: string) {
    setBusyUuid(uuid);
    try {
      await acceptServerVersion(uuid);
      setConflictView(null);
    } finally {
      setBusyUuid(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          {online ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <CloudOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          <span className="text-sm text-slate-600 dark:text-zinc-300">
            {items.length} item{items.length === 1 ? "" : "s"} waiting
          </span>
        </div>
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={!online || drainPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-school-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${drainPending ? "animate-spin" : ""}`}
          />
          {drainPending ? "Syncing…" : "Sync all now"}
        </button>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <SyncSection
        title="Conflicts"
        accent="red"
        rows={conflicts}
        emptyText="No conflicts."
        renderActions={(item) => (
          <>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => setConflictView(item)}
              icon={<Eye className="h-3.5 w-3.5" />}
            >
              View
            </ActionButton>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => handleDiscard(item.uuid)}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              variant="danger"
            >
              Discard
            </ActionButton>
          </>
        )}
        formatTimestamp={formatTimestamp}
        describeItem={describeItem}
      />

      <SyncSection
        title="Pending"
        accent="indigo"
        rows={pending}
        emptyText="Nothing pending right now."
        renderActions={(item) => (
          <>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => handleRetry(item.uuid)}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              disabled={!online}
            >
              Retry
            </ActionButton>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => handleDiscard(item.uuid)}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              variant="danger"
            >
              Discard
            </ActionButton>
          </>
        )}
        formatTimestamp={formatTimestamp}
        describeItem={describeItem}
      />

      <SyncSection
        title="Failed"
        accent="amber"
        rows={failed}
        emptyText="No permanently failed items."
        renderActions={(item) => (
          <>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => handleRetry(item.uuid)}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              disabled={!online}
            >
              Retry
            </ActionButton>
            <ActionButton
              busy={busyUuid === item.uuid}
              onClick={() => handleDiscard(item.uuid)}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              variant="danger"
            >
              Discard
            </ActionButton>
          </>
        )}
        formatTimestamp={formatTimestamp}
        describeItem={describeItem}
      />

      {conflictView ? (
        <ConflictModal
          item={conflictView}
          busy={busyUuid === conflictView.uuid}
          onClose={() => setConflictView(null)}
          onKeepLocal={() => handleKeepLocal(conflictView.uuid)}
          onAcceptServer={() => handleAcceptServer(conflictView.uuid)}
        />
      ) : null}
    </div>
  );
}

interface SyncSectionProps {
  title: string;
  accent: "red" | "indigo" | "amber";
  rows: PendingSyncRow[];
  emptyText: string;
  renderActions: (item: PendingSyncRow) => React.ReactNode;
  formatTimestamp: (ms: number) => string;
  describeItem: (item: PendingSyncRow) => string;
}

const ACCENT_CLASSES: Record<SyncSectionProps["accent"], string> = {
  red: "border-red-200 dark:border-red-900/40",
  indigo: "border-slate-200 dark:border-zinc-800",
  amber: "border-amber-200 dark:border-amber-900/40",
};

function SyncSection({
  title,
  accent,
  rows,
  emptyText,
  renderActions,
  formatTimestamp,
  describeItem,
}: SyncSectionProps) {
  if (rows.length === 0) {
    return (
      <section
        className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900 ${ACCENT_CLASSES[accent]}`}
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {title} (0)
        </h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
          {emptyText}
        </p>
      </section>
    );
  }
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-900 ${ACCENT_CLASSES[accent]}`}
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {title} ({rows.length})
        </h2>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-200 md:hidden dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.uuid} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {KIND_LABELS[row.kind]}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                  {describeItem(row)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                {formatTimestamp(row.createdAt)}
              </span>
            </div>
            {row.lastError ? (
              <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {row.lastError}
                {row.retryCount > 0 ? ` (retry ${row.retryCount})` : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">{renderActions(row)}</div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-zinc-800/50 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Saved</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr key={row.uuid}>
                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                  {KIND_LABELS[row.kind]}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-zinc-300">
                  {describeItem(row)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-zinc-400">
                  {formatTimestamp(row.createdAt)}
                </td>
                <td className="px-4 py-2">
                  {row.lastError ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300"
                      title={row.lastError}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {row.retryCount > 0
                        ? `Retry ${row.retryCount}`
                        : "Error"}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-zinc-500">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    {renderActions(row)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
  disabled,
  icon,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const base =
    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variantClasses =
    variant === "danger"
      ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
      : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`${base} ${variantClasses}`}
    >
      {icon}
      {children}
    </button>
  );
}

function ConflictModal({
  item,
  busy,
  onClose,
  onKeepLocal,
  onAcceptServer,
}: {
  item: PendingSyncRow;
  busy: boolean;
  onClose: () => void;
  onKeepLocal: () => void;
  onAcceptServer: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-zinc-800">
          <h3
            id="conflict-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Resolve conflict
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-slate-600 dark:text-zinc-300">
            The server already has a newer version of this record. Choose
            which version to keep.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-zinc-700">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Your local version
              </h4>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-zinc-200">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-zinc-700">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Server version
              </h4>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-zinc-200">
                {item.serverState
                  ? JSON.stringify(item.serverState, null, 2)
                  : "(server did not return a snapshot)"}
              </pre>
            </div>
          </div>
          {item.lastError ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {item.lastError}
            </p>
          ) : null}
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onAcceptServer}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Keep server version
          </button>
          <button
            type="button"
            onClick={onKeepLocal}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-school-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Push my version anyway
          </button>
        </footer>
      </div>
    </div>
  );
}
