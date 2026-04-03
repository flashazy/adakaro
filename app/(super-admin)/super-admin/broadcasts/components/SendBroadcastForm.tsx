"use client";

import { useEffect, useState } from "react";

function normalizeTargetIds(
  ids: string[] | null | undefined
): string[] | null {
  if (!ids || ids.length === 0) return null;
  return [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
}

export function SendBroadcastForm({
  onSent,
  defaultTitle = "",
  defaultMessage = "",
  defaultUrgent = false,
  targetUserIds = null,
}: {
  onSent?: () => void;
  defaultTitle?: string;
  defaultMessage?: string;
  defaultUrgent?: boolean;
  /** When set, only these school admins receive the broadcast (e.g. reminders). */
  targetUserIds?: string[] | null;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(defaultMessage);
  const [isUrgent, setIsUrgent] = useState(defaultUrgent);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Synced from props so reminder targeting survives re-renders and is always sent in POST. */
  const [targetsForSend, setTargetsForSend] = useState<string[] | null>(() =>
    normalizeTargetIds(targetUserIds ?? undefined)
  );

  useEffect(() => {
    setTargetsForSend(normalizeTargetIds(targetUserIds ?? undefined));
  }, [targetUserIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const payload: {
        title: string;
        message: string;
        is_urgent: boolean;
        target_user_ids?: string[];
      } = {
        title: title.trim(),
        message: message.trim(),
        is_urgent: isUrgent,
      };
      const t = normalizeTargetIds(targetsForSend ?? undefined);
      if (t && t.length > 0) {
        payload.target_user_ids = t;
      }

      const res = await fetch("/api/broadcasts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send broadcast.");
        return;
      }
      setTitle("");
      setMessage("");
      setIsUrgent(false);
      setTargetsForSend(null);
      onSent?.();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        New broadcast
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        {targetsForSend && targetsForSend.length > 0
          ? `Only ${targetsForSend.length} selected school admin${targetsForSend.length === 1 ? "" : "s"} will see this.`
          : "School admins will see this on their dashboard. Urgent messages use a red highlight."}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="broadcast-title"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Message title
          </label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            placeholder="e.g. Scheduled maintenance tonight"
            required
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="broadcast-body"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Message body
          </label>
          <textarea
            id="broadcast-body"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            placeholder="Your message to all school admins…"
            required
            maxLength={8000}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
          />
          <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
            Urgent (red background for recipients)
          </span>
        </label>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {sending ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </form>
  );
}
