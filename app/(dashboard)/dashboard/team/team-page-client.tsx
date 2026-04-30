"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  createSchoolAdminAccountAction,
  promoteTeacherToAdminAction,
  type TeamAdminActionState,
} from "./actions";
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
  promotedFromTeacher: boolean;
  /** School owner always; others only when they added this admin. */
  canRemove: boolean;
  /** Tooltip when Remove is disabled; null when enabled. */
  removeDisabledTooltip: string | null;
}

function flashTeam(state: TeamAdminActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

/** Title-case each space-delimited segment while preserving spacing. */
function formatFullNameInput(raw: string): string {
  return raw
    .split(/( +)/)
    .map((segment) => {
      if (/^\s+$/.test(segment)) return segment;
      if (segment.length === 0) return segment;
      return (
        segment.charAt(0).toLocaleUpperCase() +
        segment.slice(1).toLocaleLowerCase()
      );
    })
    .join("");
}

interface TeamPageClientProps {
  members: TeamMemberRow[];
  planLabel: string;
  adminCount: number;
  /** null = unlimited (e.g. enterprise). */
  maxAdmins: number | null;
  usedSlots: number;
  canAddAdmin: boolean;
  teachersForPromote: { userId: string; fullName: string }[];
  /** Show pricing link when adding admins is blocked by plan. */
  showUpgradeLink?: boolean;
}

export function TeamPageClient({
  members,
  planLabel,
  adminCount,
  maxAdmins,
  usedSlots,
  canAddAdmin,
  teachersForPromote,
  showUpgradeLink = false,
}: TeamPageClientProps) {
  const router = useRouter();
  const [memberSearch, setMemberSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [promoteDropdownOpen, setPromoteDropdownOpen] = useState(false);
  const [promoteTeacherSearch, setPromoteTeacherSearch] = useState("");
  const [promoteSelectedUserId, setPromoteSelectedUserId] = useState("");
  const promoteComboboxRef = useRef<HTMLDivElement>(null);

  const [createState, createAction, createPending] = useActionState(
    createSchoolAdminAccountAction,
    null as TeamAdminActionState | null
  );
  const [promoteState, promoteAction, promotePending] = useActionState(
    promoteTeacherToAdminAction,
    null as TeamAdminActionState | null
  );

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(TEAM_MEMBERS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  useEffect(() => {
    if (createState?.ok || promoteState?.ok) {
      router.refresh();
    }
  }, [createState?.ok, promoteState?.ok, router]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      if (m.fullName.toLowerCase().includes(q)) return true;
      if (m.email && m.email.toLowerCase().includes(q)) return true;
      if (!m.email && "no email".includes(q)) return true;
      return false;
    });
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

  const atAdminCap = maxAdmins != null && usedSlots >= maxAdmins;

  const seatSummary =
    maxAdmins == null
      ? `${adminCount} admin seat${adminCount === 1 ? "" : "s"} (unlimited)`
      : `${adminCount}/${maxAdmins} admin seat${maxAdmins === 1 ? "" : "s"} filled`;

  const promoteOptions = useMemo(
    () =>
      [...teachersForPromote].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, {
          sensitivity: "base",
        })
      ),
    [teachersForPromote]
  );

  const promoteComboDisabled =
    !canAddAdmin || promotePending || promoteOptions.length === 0;

  const filteredPromoteTeachers = useMemo(() => {
    const q = promoteTeacherSearch.trim().toLowerCase();
    if (!q) return promoteOptions;
    return promoteOptions.filter((t) =>
      t.fullName.toLowerCase().includes(q)
    );
  }, [promoteOptions, promoteTeacherSearch]);

  const promoteSelectedLabel = useMemo(() => {
    if (!promoteSelectedUserId) return "";
    return (
      promoteOptions.find((t) => t.userId === promoteSelectedUserId)?.fullName ??
      ""
    );
  }, [promoteOptions, promoteSelectedUserId]);

  useEffect(() => {
    if (
      promoteSelectedUserId &&
      !promoteOptions.some((t) => t.userId === promoteSelectedUserId)
    ) {
      setPromoteSelectedUserId("");
    }
  }, [promoteOptions, promoteSelectedUserId]);

  useEffect(() => {
    if (!promoteDropdownOpen) return;
    function handlePointerDown(e: MouseEvent | PointerEvent) {
      const el = promoteComboboxRef.current;
      if (!el?.contains(e.target as Node)) {
        setPromoteDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [promoteDropdownOpen]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Create admin account
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Full name and temporary password (at least 8 characters). They must
          change the password on first login, same as teachers.
        </p>
        {flashTeam(createState)}
        <form
          action={createAction}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            const form = e.currentTarget;
            const nameInput = form.elements.namedItem(
              "full_name"
            ) as HTMLInputElement | null;
            if (nameInput) {
              nameInput.value = formatFullNameInput(nameInput.value.trim());
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="team-create-full-name"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Full name <span className="text-red-600">*</span>
              </label>
              <input
                id="team-create-full-name"
                name="full_name"
                required
                minLength={2}
                autoComplete="name"
                disabled={!canAddAdmin || createPending}
                onBlur={(e) => {
                  e.target.value = formatFullNameInput(e.target.value.trim());
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label
                htmlFor="team-create-password"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Temporary password <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="team-create-password"
                  name="password"
                  type={showCreatePassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={!canAddAdmin || createPending}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-11 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  aria-label={
                    showCreatePassword ? "Hide password" : "Show password"
                  }
                >
                  {showCreatePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={!canAddAdmin || createPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Creating…
                </>
              ) : (
                "Create admin account"
              )}
            </button>
            {!canAddAdmin && atAdminCap ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                Upgrade your plan to add more administrators.
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
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Promote existing teacher to admin
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          The teacher keeps their teaching access and can switch between teacher
          and admin views from the header when signed in.
        </p>
        {flashTeam(promoteState)}
        <form action={promoteAction} className="mt-4 flex flex-wrap items-end gap-3">
          <div
            ref={promoteComboboxRef}
            className="relative w-full min-w-[280px] max-w-md flex-1"
          >
            <label
              htmlFor="team-promote-teacher-trigger"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Teacher
            </label>
            <input
              type="hidden"
              name="teacher_user_id"
              value={promoteSelectedUserId}
              required={promoteOptions.length > 0 && canAddAdmin}
              readOnly
              aria-hidden
            />
            <button
              id="team-promote-teacher-trigger"
              type="button"
              disabled={promoteComboDisabled}
              aria-expanded={promoteDropdownOpen}
              aria-haspopup="listbox"
              onClick={() => {
                if (promoteComboDisabled) return;
                setPromoteDropdownOpen((o) => !o);
              }}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <span
                className={
                  promoteSelectedLabel
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-zinc-500"
                }
              >
                {promoteOptions.length === 0
                  ? "No teachers available"
                  : promoteSelectedLabel || "Select a teacher…"}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-zinc-400 ${
                  promoteDropdownOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            {promoteDropdownOpen && !promoteComboDisabled ? (
              <div
                className="absolute left-0 right-0 z-50 mt-1 flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                role="listbox"
              >
                <label htmlFor="team-promote-teacher-search" className="sr-only">
                  Search teachers by name
                </label>
                <input
                  id="team-promote-teacher-search"
                  type="search"
                  value={promoteTeacherSearch}
                  onChange={(e) => setPromoteTeacherSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  autoComplete="off"
                  placeholder="Search by name…"
                  className="w-full border-b border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-inset focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                />
                <ul
                  className="max-h-[200px] overflow-y-auto py-1"
                  aria-label="Teachers"
                >
                  {filteredPromoteTeachers.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500 dark:text-zinc-400">
                      No teachers match your search.
                    </li>
                  ) : (
                    filteredPromoteTeachers.map((t) => (
                      <li key={t.userId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={promoteSelectedUserId === t.userId}
                          onClick={() => {
                            setPromoteSelectedUserId(t.userId);
                            setPromoteDropdownOpen(false);
                          }}
                          className="flex w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {t.fullName}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={
              promoteComboDisabled ||
              (canAddAdmin &&
                promoteOptions.length > 0 &&
                !promoteSelectedUserId)
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {promotePending ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Promoting…
              </>
            ) : (
              "Promote to admin"
            )}
          </button>
        </form>
      </section>

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">
            {planLabel}:
          </span>{" "}
          {seatSummary}.
          {atAdminCap ? (
            <>
              {" "}
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
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Current administrators
          </h3>
          <label htmlFor="team-members-search" className="sr-only">
            Search by name or email
          </label>
          <input
            id="team-members-search"
            type="search"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="mt-2 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
            {totalFiltered === 0 ? (
              members.length === 0 ? (
                "No administrators yet."
              ) : (
                "No administrators match your search."
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
                administrator{totalFiltered !== 1 ? "s" : ""}
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
        {/* Mobile: stacked cards (<768px) */}
        <div className="divide-y divide-slate-100 md:hidden dark:divide-zinc-800">
          {pageSlice.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              {members.length === 0
                ? "No administrators yet."
                : "No members match your search."}
            </p>
          ) : (
            pageSlice.map((m) => (
              <article key={`mobile-${m.membershipId}`} className="px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="min-w-0 flex-1 break-words text-base font-semibold text-slate-900 dark:text-white">
                    {m.fullName}
                  </h4>
                  <span className="shrink-0 rounded-full bg-school-primary/15 px-2.5 py-0.5 text-xs font-medium text-school-primary dark:bg-school-primary/20 dark:text-school-primary">
                    Admin
                  </span>
                </div>

                {m.isCreator || m.promotedFromTeacher ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.isCreator ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                        Creator
                      </span>
                    ) : null}
                    {m.promotedFromTeacher ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Promoted from teacher
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-2 truncate text-sm text-slate-600 dark:text-zinc-400">
                  {m.email ?? "No email"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  Joined {m.joinedAtLabel}
                </p>

                <div className="mt-3 flex justify-end">
                  <RemoveAdminButton
                    userId={m.userId}
                    label={m.fullName}
                    disabled={!m.canRemove}
                    disabledTitle={
                      !m.canRemove
                        ? (m.removeDisabledTooltip ?? undefined)
                        : undefined
                    }
                    promotedFromTeacher={m.promotedFromTeacher}
                  />
                </div>
              </article>
            ))
          )}
        </div>

        {/* Desktop: table (≥768px) */}
        <div className="hidden overflow-x-auto md:block">
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
                    <td className="px-4 py-3 align-top text-slate-800 dark:text-zinc-200">
                      <div className="flex flex-col gap-1.5">
                        <span>{m.fullName}</span>
                        <div className="flex flex-wrap gap-1">
                          {m.isCreator ? (
                            <span className="inline-flex rounded-full bg-school-primary/15 px-2 py-0.5 text-xs font-medium text-school-primary dark:bg-school-primary/20 dark:text-school-primary">
                              Creator
                            </span>
                          ) : null}
                          {m.promotedFromTeacher ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                              Promoted from teacher
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">
                      {m.email ?? "No email"}
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
                        disabled={!m.canRemove}
                        disabledTitle={
                          !m.canRemove
                            ? (m.removeDisabledTooltip ?? undefined)
                            : undefined
                        }
                        promotedFromTeacher={m.promotedFromTeacher}
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
    </div>
  );
}
