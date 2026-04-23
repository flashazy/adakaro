"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/dashboard/back-button";
import { Eye, EyeOff, Search } from "lucide-react";
import {
  addTeacherAction,
  removeTeacherFromSchoolAction,
  setTeacherCoordinatorClassesAction,
  setTeacherDepartmentRolesAction,
} from "./actions";
import type { TeacherActionState, TeacherDepartment } from "./types";
import { ManageDepartmentRolesModal } from "./components/ManageDepartmentRolesModal";
import { AssignCoordinatorModal } from "./components/AssignCoordinatorModal";
import { BulkAddTeachersModal } from "./components/BulkAddTeachersModal";
import { ResetTeacherPasswordModal } from "./components/ResetTeacherPasswordModal";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  DASHBOARD_TEACHERS_ACCOUNTS_ROWS_STORAGE_KEY,
  parseTeacherAccountsRowsPerPage,
  TEACHER_ACCOUNTS_ROW_OPTIONS,
  TEACHER_ACCOUNTS_ROWS_STORAGE_KEY,
  type TeacherAccountsRowOption,
} from "@/lib/student-list-pagination";

function flash(state: TeacherActionState | null) {
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

export interface TeacherRow {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  joinedAtLabel: string;
  /** True after the teacher has completed the first-time password change. */
  passwordChanged: boolean;
  /** Department roles assigned to this teacher for the active school. */
  departmentRoles: TeacherDepartment[];
  /**
   * Class ids this teacher coordinates. Populated only for teachers holding the
   * Academic department role — Coordinator is a promotion of Academic.
   */
  coordinatorClassIds: string[];
}

const DEPARTMENT_LABELS: Record<TeacherDepartment, string> = {
  academic: "Academic",
  discipline: "Discipline",
  health: "Health",
  finance: "Finance",
};

interface TeachersPageClientProps {
  teachers: TeacherRow[];
  /**
   * Full class list including parent classes. Coordinators (form masters)
   * may be assigned to a parent class.
   */
  coordinatorClassOptions: {
    id: string;
    name: string;
    parent_class_id: string | null;
  }[];
}

function isSyntheticTeacherListEmail(email: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().includes("@teachers.adakaro.app");
}

/** Title-case each space-delimited segment while preserving spacing. */
function formatTeacherFullNameInput(raw: string): string {
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

export function TeachersPageClient({
  teachers,
  coordinatorClassOptions,
}: TeachersPageClientProps) {
  const [teacherListTab, setTeacherListTab] = useState<"all" | "registered">(
    "all"
  );
  const [teacherAccountsSearch, setTeacherAccountsSearch] = useState("");
  const [teacherAccountsPage, setTeacherAccountsPage] = useState(1);
  const [teacherAccountsRowsPerPage, setTeacherAccountsRowsPerPage] =
    useState<TeacherAccountsRowOption>(3);
  const [addTeacherFullName, setAddTeacherFullName] = useState("");
  const [showAddTeacherPassword, setShowAddTeacherPassword] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [rolesModal, setRolesModal] = useState<{
    userId: string;
    name: string;
    initial: TeacherDepartment[];
  } | null>(null);
  const [coordinatorModal, setCoordinatorModal] = useState<{
    userId: string;
    name: string;
    initial: string[];
  } | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [resetPasswordModalKey, setResetPasswordModalKey] = useState(0);

  const [addState, addAction, addPending] = useActionState(
    addTeacherAction,
    null as TeacherActionState | null
  );
  const [removeTeacherState, removeTeacherAction, removeTeacherPending] =
    useActionState(removeTeacherFromSchoolAction, null as TeacherActionState | null);
  const [rolesState, rolesAction, rolesPending] = useActionState(
    setTeacherDepartmentRolesAction,
    null as TeacherActionState | null
  );
  const [coordinatorState, coordinatorAction, coordinatorPending] =
    useActionState(
      setTeacherCoordinatorClassesAction,
      null as TeacherActionState | null
    );

  useEffect(() => {
    try {
      let raw = localStorage.getItem(TEACHER_ACCOUNTS_ROWS_STORAGE_KEY);
      if (raw == null) {
        raw = localStorage.getItem(DASHBOARD_TEACHERS_ACCOUNTS_ROWS_STORAGE_KEY);
      }
      const t = parseTeacherAccountsRowsPerPage(raw);
      if (t != null) {
        setTeacherAccountsRowsPerPage(t);
        localStorage.setItem(TEACHER_ACCOUNTS_ROWS_STORAGE_KEY, String(t));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (rolesState?.ok) {
      setRolesModal(null);
    }
  }, [rolesState]);

  useEffect(() => {
    if (coordinatorState?.ok) {
      // Mirrors the pattern used for `rolesState` below — close the modal
      // once the server action reports success. The alternative (watching
      // from a render path) would re-fire unnecessarily.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoordinatorModal(null);
    }
  }, [coordinatorState]);

  const teachersTabList = useMemo(
    () =>
      teacherListTab === "registered"
        ? teachers.filter((t) => t.passwordChanged)
        : teachers,
    [teachers, teacherListTab]
  );

  const teacherAccountsFiltered = useMemo(() => {
    const q = teacherAccountsSearch.trim().toLowerCase();
    if (!q) return teachersTabList;
    return teachersTabList.filter((t) =>
      t.fullName.toLowerCase().includes(q)
    );
  }, [teachersTabList, teacherAccountsSearch]);

  const teacherAccountsTotalPages = Math.max(
    1,
    Math.ceil(teacherAccountsFiltered.length / teacherAccountsRowsPerPage)
  );
  const teacherAccountsSafePage = Math.min(
    teacherAccountsPage,
    teacherAccountsTotalPages
  );
  const teacherAccountsStart =
    (teacherAccountsSafePage - 1) * teacherAccountsRowsPerPage;
  const teacherAccountsPageRows = teacherAccountsFiltered.slice(
    teacherAccountsStart,
    teacherAccountsStart + teacherAccountsRowsPerPage
  );

  const teacherAccountsPaginationItems = useMemo(
    () =>
      getCompactPaginationItems(
        teacherAccountsSafePage,
        teacherAccountsTotalPages
      ),
    [teacherAccountsSafePage, teacherAccountsTotalPages]
  );

  useEffect(() => {
    setTeacherAccountsPage(1);
  }, [teacherAccountsSearch, teacherListTab]);

  useEffect(() => {
    setTeacherAccountsPage((p) => Math.min(p, teacherAccountsTotalPages));
  }, [teacherAccountsTotalPages]);

  return (
    <div className="space-y-10">
      <div>
        <BackButton
          href="/dashboard"
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          ← Back to dashboard
        </BackButton>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Add teachers
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Full name and temporary password. Teacher must change password on
              first login.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBulkAddOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.10)] px-3 py-1.5 text-xs font-semibold text-school-primary transition-colors hover:bg-[rgb(var(--school-primary-rgb)/0.16)] dark:border-[rgb(var(--school-primary-rgb)/0.35)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)] dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.20)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
            Bulk Add Teachers
          </button>
        </div>
        <form action={addAction} className="mt-4 space-y-3">
          {flash(addState)}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">
                Full name <span className="text-red-600">*</span>
              </span>
              <input
                name="full_name"
                type="text"
                required
                autoComplete="name"
                value={addTeacherFullName}
                onChange={(e) =>
                  setAddTeacherFullName(formatTeacherFullNameInput(e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="e.g. Jane Okello (used to sign in)"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">
                Temporary password <span className="text-red-600">*</span>
              </span>
              <div className="relative mt-1">
                <input
                  name="password"
                  type={showAddTeacherPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-11 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAddTeacherPassword((prev) => !prev)
                  }
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label={
                    showAddTeacherPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showAddTeacherPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </label>
          </div>
          <button
            type="submit"
            disabled={addPending}
            className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
          >
            {addPending ? "Saving…" : "Create teacher account"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Teacher accounts
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Remove someone from the school entirely (also removes their class
              assignments).
            </p>
          </div>
          <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5 dark:border-zinc-600">
            <button
              type="button"
              onClick={() => setTeacherListTab("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                teacherListTab === "all"
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              All teachers
              <span className="ml-1 font-normal text-slate-500 dark:text-zinc-500">
                ({teachers.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTeacherListTab("registered")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                teacherListTab === "registered"
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Registered teachers
              <span className="ml-1 font-normal text-slate-500 dark:text-zinc-500">
                ({teachers.filter((x) => x.passwordChanged).length})
              </span>
            </button>
          </div>
        </div>
        {flash(removeTeacherState)}
        {teachers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            No teachers yet. Add someone above.
          </p>
        ) : teachersTabList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            No teachers in this view yet.
          </p>
        ) : (
          <>
            <div className="relative mt-4 max-w-md">
              <label htmlFor="teacher-accounts-search" className="sr-only">
                Search by teacher name
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="teacher-accounts-search"
                type="search"
                value={teacherAccountsSearch}
                onChange={(e) => setTeacherAccountsSearch(e.target.value)}
                placeholder="Search teacher by name…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
            {teacherAccountsFiltered.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
                No teachers match your search.
              </p>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-slate-200 dark:divide-zinc-800">
                  {teacherAccountsPageRows.map((t) => (
                    <li
                      key={t.userId}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {t.fullName}
                          {!t.passwordChanged ? (
                            <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                              Pending first login
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                          {isSyntheticTeacherListEmail(t.email) ? (
                            t.joinedAtLabel ? `joined ${t.joinedAtLabel}` : null
                          ) : (
                            <>
                              {t.email ?? "No email"}
                              {t.joinedAtLabel
                                ? ` · joined ${t.joinedAtLabel}`
                                : ""}
                            </>
                          )}
                        </p>
                        <div className="mt-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                            Department roles:
                          </span>{" "}
                          {t.departmentRoles.length === 0 ? (
                            <span className="text-xs text-slate-400 dark:text-zinc-500">
                              None
                            </span>
                          ) : (
                            <span className="inline-flex flex-wrap gap-1 align-middle">
                              {t.departmentRoles.map((d) => (
                                <span
                                  key={d}
                                  className="rounded-md bg-[rgb(var(--school-primary-rgb)/0.10)] px-2 py-0.5 text-xs font-medium text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.20)] dark:text-school-primary"
                                >
                                  {DEPARTMENT_LABELS[d]}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        {t.departmentRoles.includes("academic") ? (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                              Coordinator for:
                            </span>{" "}
                            {t.coordinatorClassIds.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-zinc-500">
                                None
                              </span>
                            ) : (
                              <span className="inline-flex flex-wrap gap-1 align-middle">
                                {t.coordinatorClassIds.map((cid) => {
                                  const name =
                                    coordinatorClassOptions.find(
                                      (c) => c.id === cid
                                    )?.name ?? "Class";
                                  return (
                                    <span
                                      key={cid}
                                      className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                    >
                                      {name}
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRolesModal({
                                userId: t.userId,
                                name: t.fullName,
                                initial: t.departmentRoles,
                              })
                            }
                            className="rounded-lg border border-[rgb(var(--school-primary-rgb)/0.25)] px-3 py-1.5 text-xs font-medium text-school-primary hover:bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-[rgb(var(--school-primary-rgb)/0.32)] dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"
                          >
                            Manage Roles
                          </button>
                          {t.departmentRoles.includes("academic") ? (
                            <button
                              type="button"
                              onClick={() =>
                                setCoordinatorModal({
                                  userId: t.userId,
                                  name: t.fullName,
                                  initial: t.coordinatorClassIds,
                                })
                              }
                              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            >
                              {t.coordinatorClassIds.length > 0
                                ? "Manage coordinator classes"
                                : "Assign as Coordinator"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordModal({
                              userId: t.userId,
                              name: t.fullName,
                            });
                            setResetPasswordModalKey((k) => k + 1);
                          }}
                          className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
                        >
                          Reset password
                        </button>
                        <form action={removeTeacherAction}>
                          <input
                            type="hidden"
                            name="membership_id"
                            value={t.membershipId}
                          />
                          <input
                            type="hidden"
                            name="teacher_user_id"
                            value={t.userId}
                          />
                          <button
                            type="submit"
                            disabled={removeTeacherPending}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            {removeTeacherPending
                              ? "Removing…"
                              : "Remove from school"}
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600 dark:text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      {`Showing ${teacherAccountsStart + 1}–${Math.min(
                        teacherAccountsStart + teacherAccountsRowsPerPage,
                        teacherAccountsFiltered.length
                      )} of ${teacherAccountsFiltered.length}`}
                    </span>
                    <label className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-zinc-400">
                        Rows
                      </span>
                      <select
                        value={teacherAccountsRowsPerPage}
                        onChange={(e) => {
                          const n = Number(
                            e.target.value
                          ) as TeacherAccountsRowOption;
                          setTeacherAccountsRowsPerPage(n);
                          setTeacherAccountsPage(1);
                          localStorage.setItem(
                            TEACHER_ACCOUNTS_ROWS_STORAGE_KEY,
                            String(n)
                          );
                        }}
                        aria-label="Rows per page for teacher accounts"
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        {TEACHER_ACCOUNTS_ROW_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={teacherAccountsSafePage <= 1}
                      onClick={() =>
                        setTeacherAccountsPage((p) => Math.max(1, p - 1))
                      }
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      Previous
                    </button>
                    {teacherAccountsTotalPages > 1 ? (
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {teacherAccountsPaginationItems.map((item, idx) =>
                          item === "ellipsis" ? (
                            <span
                              key={`teachers-ellipsis-${idx}`}
                              className="px-1 text-sm text-slate-400 dark:text-zinc-500"
                              aria-hidden
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setTeacherAccountsPage(item)}
                              aria-current={
                                item === teacherAccountsSafePage
                                  ? "page"
                                  : undefined
                              }
                              className={`min-w-[2rem] rounded border px-2.5 py-1 text-sm font-medium dark:border-zinc-600 ${
                                item === teacherAccountsSafePage
                                  ? "border-school-primary bg-school-primary text-white dark:border-school-primary dark:bg-school-primary"
                                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={
                        teacherAccountsSafePage >= teacherAccountsTotalPages
                      }
                      onClick={() =>
                        setTeacherAccountsPage((p) =>
                          Math.min(teacherAccountsTotalPages, p + 1)
                        )
                      }
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>


      {rolesModal ? (
        <ManageDepartmentRolesModal
          teacherUserId={rolesModal.userId}
          teacherName={rolesModal.name}
          initialDepartments={rolesModal.initial}
          onClose={() => setRolesModal(null)}
          formAction={rolesAction}
          pending={rolesPending}
          flash={rolesState}
        />
      ) : null}

      {coordinatorModal ? (
        <AssignCoordinatorModal
          teacherUserId={coordinatorModal.userId}
          teacherName={coordinatorModal.name}
          classOptions={coordinatorClassOptions}
          initialClassIds={coordinatorModal.initial}
          onClose={() => setCoordinatorModal(null)}
          formAction={coordinatorAction}
          pending={coordinatorPending}
          flash={coordinatorState}
        />
      ) : null}

      <BulkAddTeachersModal
        open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
      />

      {resetPasswordModal ? (
        <ResetTeacherPasswordModal
          key={`${resetPasswordModal.userId}-${resetPasswordModalKey}`}
          open
          onClose={() => setResetPasswordModal(null)}
          teacherUserId={resetPasswordModal.userId}
          teacherName={resetPasswordModal.name}
        />
      ) : null}
    </div>
  );
}
