"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InviteAdminModal } from "./invite-modal";
import { RemoveAdminButton } from "./remove-admin-button";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  TEAM_MEMBERS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

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
  /** null = unlimited (e.g. enterprise). */
  maxAdmins: number | null;
  pendingInviteCount: number;
  usedSlots: number;
  canInvite: boolean;
  pendingInvites: PendingInviteRow[];
  /** Show pricing link when invite is blocked by plan. */
  showUpgradeLink?: boolean;
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
  showUpgradeLink = false,
}: TeamPageClientProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(TEAM_MEMBERS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.email?.toLowerCase().includes(q) ?? false)
    );
  }, [members, memberSearch]);

  useEffect(() => {
    setPage(1);
  }, [memberSearch]);

  const totalFiltered = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageSlice = filteredMembers.slice(start, start + rowsPerPage);

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(start + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(start + rowsPerPage, totalFiltered);

  const atAdminCap =
    maxAdmins != null && usedSlots >= maxAdmins;

  const seatSummary =
    maxAdmins == null
      ? `${adminCount} admin seat${adminCount === 1 ? "" : "s"} (unlimited)`
      : `${adminCount}/${maxAdmins} admin seat${maxAdmins === 1 ? "" : "s"} filled`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">
            {planLabel}:
          </span>{" "}
          {seatSummary}
          {pendingInviteCount > 0 ? (
            <>
              {" "}
              · {pendingInviteCount} pending invitation
              {pendingInviteCount === 1 ? "" : "s"}
            </>
          ) : null}
          .{" "}
          {atAdminCap ? (
            <>
              Upgrade your plan to add more admins.
              {showUpgradeLink ? (
                <>
                  {" "}
                  <Link
                    href="/pricing"
                    className="font-medium text-school-primary underline-offset-2 hover:underline dark:text-school-primary"
                  >
                    View pricing
                  </Link>
                </>
              ) : null}
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          disabled={!canInvite}
          className="inline-flex items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Invite new admin
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <label htmlFor="team-members-search" className="sr-only">
            Search by name or email
          </label>
          <input
            id="team-members-search"
            type="search"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
            {totalFiltered === 0 ? (
              members.length === 0 ? (
                "No team members yet."
              ) : (
                "No team members match your search."
              )
            ) : (
              <>
                Showing{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {totalFiltered}
                </span>{" "}
                team member{totalFiltered !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-zinc-400">
              Rows per page:
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const n = Number(e.target.value) as StudentListRowOption;
                setRowsPerPage(n);
                setPage(1);
                localStorage.setItem(TEAM_MEMBERS_ROWS_STORAGE_KEY, String(n));
              }}
              aria-label="Rows per page"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
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
              {pageSlice.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500 dark:text-zinc-400"
                  >
                    {members.length === 0
                      ? "No administrators yet."
                      : "No members match your search."}
                  </td>
                </tr>
              ) : (
                pageSlice.map((m) => (
                  <tr key={m.membershipId}>
                    <td className="px-4 py-3 text-slate-800 dark:text-zinc-200">
                      {m.fullName}
                      {m.isCreator ? (
                        <span className="ml-2 text-xs font-medium text-school-primary dark:text-school-primary">
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
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && totalFiltered > 0 ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800"
            aria-label="Team members pagination"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            {paginationItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`tm-ellipsis-${idx}`}
                  className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  aria-current={item === safePage ? "page" : undefined}
                  className={
                    item === safePage
                      ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                      : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </nav>
        ) : null}
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
