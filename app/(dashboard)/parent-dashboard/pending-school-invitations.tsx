"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  acceptSchoolAdminInvite,
  declineSchoolAdminInvite,
} from "./actions";

export interface PendingAdminInviteItem {
  id: string;
  school_id: string;
  token: string;
  expires_at: string;
  schoolName: string;
  expiresLabel: string;
}

export default function PendingSchoolInvitations({
  invitations,
}: {
  invitations: PendingAdminInviteItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visibleInvites, setVisibleInvites] =
    useState<PendingAdminInviteItem[]>(invitations);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setVisibleInvites(invitations);
  }, [invitations]);

  if (visibleInvites.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50/60 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="border-b border-indigo-200/80 px-6 py-4 dark:border-indigo-900/60">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pending invitations
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
          You were invited to help manage a school as an administrator. Accept
          to open the admin dashboard, or decline if you don&apos;t want this
          role.
        </p>
      </div>

      {message && (
        <div
          className={`mx-6 mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <ul className="divide-y divide-indigo-200/60 dark:divide-indigo-900/50">
        {visibleInvites.map((inv) => (
          <li key={inv.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {inv.schoolName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                School admin invite · Expires {inv.expiresLabel}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const result = await acceptSchoolAdminInvite(inv.token);
                    if (!result.ok) {
                      setMessage({
                        type: "error",
                        text: result.error,
                      });
                      return;
                    }
                    setVisibleInvites((prev) =>
                      prev.filter((row) => row.id !== inv.id)
                    );
                    setMessage({
                      type: "success",
                      text: "You are now a school admin. Opening your admin dashboard…",
                    });
                    try {
                      await createBrowserSupabaseClient().auth.refreshSession();
                    } catch {
                      /* still navigate */
                    }
                    window.location.href = `${window.location.origin}${result.redirectTo}`;
                  });
                }}
              >
                Accept invitation
              </button>
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const result = await declineSchoolAdminInvite(inv.id);
                    if (result.error) {
                      setMessage({ type: "error", text: result.error });
                      return;
                    }
                    setVisibleInvites((prev) =>
                      prev.filter((row) => row.id !== inv.id)
                    );
                    setMessage({
                      type: "success",
                      text: result.success ?? "Invitation declined.",
                    });
                    router.refresh();
                  });
                }}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
