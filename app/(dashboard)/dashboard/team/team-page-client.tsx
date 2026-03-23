"use client";

import { useState } from "react";
import { InviteAdminModal } from "./invite-modal";
import { RemoveAdminButton } from "./remove-admin-button";

export interface TeamMemberRow {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  joinedAt: string;
  /** Pre-formatted on the server so SSR and client markup match (hydration-safe). */
  joinedAtLabel: string;
  isCreator: boolean;
}

export interface PendingInviteRow {
  id: string;
  invited_email: string;
  expires_at: string;
  /** Pre-formatted on the server (hydration-safe). */
  expiresAtLabel: string;
}

interface TeamPageClientProps {
  members: TeamMemberRow[];
  planLabel: string;
  adminCount: number;
  maxAdmins: number;
  pendingInviteCount: number;
  usedSlots: number;
  canInvite: boolean;
  pendingInvites: PendingInviteRow[];
}

export function TeamPageClient({
  members,
  planLabel,
  adminCount,
  maxAdmins,
  pendingInviteCount,
  usedSlots,
  canInvite,
  pendingInvites,
}: TeamPageClientProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">
            {planLabel}:
          </span>{" "}
          {adminCount}/{maxAdmins} admin seat{maxAdmins === 1 ? "" : "s"} filled
          {pendingInviteCount > 0 ? (
            <>
              {" "}
              · {pendingInviteCount} pending invitation
              {pendingInviteCount === 1 ? "" : "s"}
            </>
          ) : null}
          . {usedSlots >= maxAdmins ? " Upgrade your plan to add more." : null}
        </p>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          disabled={!canInvite}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Invite new admin
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Name
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Email
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Role
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Joined
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td className="px-4 py-3 text-slate-800 dark:text-zinc-200">
                    {m.fullName}
                    {m.isCreator ? (
                      <span className="ml-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        (creator)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">
                    {m.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">
                    Admin
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">
                    {m.joinedAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <RemoveAdminButton
                      userId={m.userId}
                      label={m.fullName}
                      disabled={m.isCreator}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingInvites.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pending invitations
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Invitees are notified when they sign in to Adakaro; we do not send
            emails for invitations yet.
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-zinc-800">
            {pendingInvites.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="font-medium text-slate-800 dark:text-zinc-200">
                  {r.invited_email}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Expires {r.expiresAtLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => window.location.reload()}
      />
    </>
  );
}
