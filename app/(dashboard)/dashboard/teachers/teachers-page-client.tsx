"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  addTeacherAction,
  assignTeacherToClassAction,
  removeTeacherAssignmentAction,
  removeTeacherFromSchoolAction,
  updateTeacherAssignmentAction,
  type TeacherActionState,
} from "./actions";
import { AssignTeacherModal, type AssignModalState } from "./components/AssignTeacherModal";

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
}

export interface AssignmentRow {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subject: string;
  subjectId: string | null;
  academicYear: string;
}

interface TeachersPageClientProps {
  teachers: TeacherRow[];
  assignments: AssignmentRow[];
  classOptions: { id: string; name: string }[];
  subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  >;
}

const ASSIGNMENTS_PAGE_SIZE = 20;

/** Dropdown: window around current calendar year (default always in list). */
function academicYearSelectValues(): string[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1, y + 2, y + 3, y + 4].map(String);
}

/** Show one year; legacy values like "2025–2026" → "2025". */
function displaySingleCalendarYear(raw: string): string {
  const m = raw.trim().match(/^(\d{4})/);
  return m ? m[1] : raw.trim() || "—";
}

type SortKey = "teacher" | "class" | "subject";

export function TeachersPageClient({
  teachers,
  assignments,
  classOptions,
  subjectOptionsByClassId,
}: TeachersPageClientProps) {
  const [modal, setModal] = useState<AssignModalState | null>(null);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignYear, setAssignYear] = useState(() =>
    String(new Date().getFullYear())
  );
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("teacher");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [teacherListTab, setTeacherListTab] = useState<"all" | "registered">(
    "all"
  );

  const assignSubjects = useMemo(() => {
    if (!assignClassId) return [];
    return subjectOptionsByClassId[assignClassId] ?? [];
  }, [assignClassId, subjectOptionsByClassId]);

  const [addState, addAction, addPending] = useActionState(
    addTeacherAction,
    null as TeacherActionState | null
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignTeacherToClassAction,
    null as TeacherActionState | null
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateTeacherAssignmentAction,
    null as TeacherActionState | null
  );
  const [removeAssignState, removeAssignAction, removeAssignPending] =
    useActionState(removeTeacherAssignmentAction, null as TeacherActionState | null);
  const [removeTeacherState, removeTeacherAction, removeTeacherPending] =
    useActionState(removeTeacherFromSchoolAction, null as TeacherActionState | null);

  const filteredSortedAssignments = useMemo(() => {
    let rows = [...assignments];
    const q = assignmentSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((a) => {
        const subj = (a.subject || "").toLowerCase();
        return (
          a.teacherName.toLowerCase().includes(q) ||
          a.className.toLowerCase().includes(q) ||
          subj.includes(q)
        );
      });
    }
    const mult = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const va =
        sortKey === "teacher"
          ? a.teacherName
          : sortKey === "class"
            ? a.className
            : a.subject || "";
      const vb =
        sortKey === "teacher"
          ? b.teacherName
          : sortKey === "class"
            ? b.className
            : b.subject || "";
      return (
        va.localeCompare(vb, undefined, { sensitivity: "base" }) * mult
      );
    });
    return rows;
  }, [assignments, assignmentSearch, sortKey, sortDir]);

  const assignmentTotalPages = Math.max(
    1,
    Math.ceil(filteredSortedAssignments.length / ASSIGNMENTS_PAGE_SIZE)
  );
  const assignmentSafePage = Math.min(assignmentPage, assignmentTotalPages);
  const assignmentStart =
    (assignmentSafePage - 1) * ASSIGNMENTS_PAGE_SIZE;
  const assignmentPageRows = filteredSortedAssignments.slice(
    assignmentStart,
    assignmentStart + ASSIGNMENTS_PAGE_SIZE
  );

  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentSearch]);

  useEffect(() => {
    setAssignmentPage((p) => Math.min(p, assignmentTotalPages));
  }, [assignmentTotalPages]);

  useEffect(() => {
    if (assignState?.ok) {
      setAssignYear(String(new Date().getFullYear()));
    }
  }, [assignState]);

  function handleSortHeader(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const modalFormAction =
    modal?.mode === "edit" ? updateAction : assignAction;
  const modalPending =
    modal?.mode === "edit" ? updatePending : assignPending;
  const modalFlash = modal?.mode === "edit" ? updateState : assignState;

  const teachersForList =
    teacherListTab === "registered"
      ? teachers.filter((t) => t.passwordChanged)
      : teachers;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to dashboard
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Add teachers
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Create an account with the teacher&apos;s full name and a temporary
          password. They sign in with that name and password, then choose a new
          password. No email is sent.
        </p>
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
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="e.g. Jane Okello (used to sign in)"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">
                Temporary password <span className="text-red-600">*</span>
              </span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="At least 8 characters"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={addPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {addPending ? "Saving…" : "Create teacher account"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Assign class &amp; subject
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Teachers only see classes you assign here.
        </p>
        <form action={assignAction} className="mt-4 space-y-3">
          {flash(assignState)}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">Teacher</span>
              <select
                name="teacher_id"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              >
                <option value="">Select…</option>
                {teachers.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.fullName}
                    {t.email ? ` (${t.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-zinc-300">Class</span>
              <select
                name="class_id"
                required
                value={assignClassId}
                onChange={(e) => {
                  setAssignClassId(e.target.value);
                  setAssignSubjectId("");
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              >
                <option value="">Select…</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-zinc-300">Subject</span>
              <select
                name="subject_id"
                required
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(e.target.value)}
                disabled={
                  !subjectOptionsByClassId ||
                  Object.keys(subjectOptionsByClassId).length === 0
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              >
                <option value="">
                  {!assignClassId
                    ? "Select a class first…"
                    : assignSubjects.length === 0
                      ? "No subjects assigned to this class. Go to Manage Subjects first."
                      : "Select…"}
                </option>
                {assignSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">
                Academic year{" "}
                <span className="text-red-600" title="Required">
                  *
                </span>
              </span>
              <select
                name="academic_year"
                required
                value={assignYear}
                onChange={(e) => setAssignYear(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              >
                {academicYearSelectValues().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
                Calendar year (January–December), e.g. 2025.
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={
              assignPending ||
              teachers.length === 0 ||
              !assignClassId ||
              !assignSubjectId ||
              assignSubjects.length === 0
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {assignPending ? "Saving…" : "Save assignment"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Teacher assignments
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          All class and subject assignments. Teachers without a row here have no
          class access until you add one using the form above.
        </p>

        <div className="relative mt-4 max-w-md">
          <label htmlFor="teacher-assignments-search" className="sr-only">
            Search by teacher, class, or subject
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="teacher-assignments-search"
            type="search"
            value={assignmentSearch}
            onChange={(e) => setAssignmentSearch(e.target.value)}
            placeholder="Search teacher, class, or subject…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>

        <div className="mt-4">
          {flash(removeAssignState)}
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              No assignments yet. Use the form above to add one.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        <button
                          type="button"
                          onClick={() => handleSortHeader("teacher")}
                          className="inline-flex items-center gap-1 rounded hover:text-slate-900 dark:hover:text-white"
                        >
                          Teacher
                          {sortKey === "teacher" ? (
                            <span className="text-xs text-slate-500" aria-hidden>
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        <button
                          type="button"
                          onClick={() => handleSortHeader("class")}
                          className="inline-flex items-center gap-1 rounded hover:text-slate-900 dark:hover:text-white"
                        >
                          Class
                          {sortKey === "class" ? (
                            <span className="text-xs text-slate-500" aria-hidden>
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        <button
                          type="button"
                          onClick={() => handleSortHeader("subject")}
                          className="inline-flex items-center gap-1 rounded hover:text-slate-900 dark:hover:text-white"
                        >
                          Subject
                          {sortKey === "subject" ? (
                            <span className="text-xs text-slate-500" aria-hidden>
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Year
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-zinc-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                    {filteredSortedAssignments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-slate-500 dark:text-zinc-400"
                        >
                          No assignments match your search.
                        </td>
                      </tr>
                    ) : (
                      assignmentPageRows.map((a) => (
                        <tr
                          key={a.id}
                          className="bg-white hover:bg-slate-50/90 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-slate-900 dark:text-white">
                            {a.teacherName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-zinc-200">
                            {a.className}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-zinc-200">
                            {a.subject || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {displaySingleCalendarYear(a.academicYear)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="Edit"
                                onClick={() =>
                                  setModal({
                                    mode: "edit",
                                    row: {
                                      id: a.id,
                                      classId: a.classId,
                                      subjectId: a.subjectId,
                                      subjectName: a.subject,
                                      academicYear: a.academicYear,
                                    },
                                  })
                                }
                                className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                ✏️
                              </button>
                              <form
                                action={removeAssignAction}
                                className="inline"
                                onSubmit={(e) => {
                                  if (!confirm("Are you sure?")) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="assignment_id"
                                  value={a.id}
                                />
                                <button
                                  type="submit"
                                  title="Delete"
                                  disabled={removeAssignPending}
                                  className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  {removeAssignPending ? "…" : "🗑️"}
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredSortedAssignments.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-zinc-400">
                  <span>
                    {`${assignmentStart + 1}–${Math.min(
                      assignmentStart + ASSIGNMENTS_PAGE_SIZE,
                      filteredSortedAssignments.length
                    )} of ${filteredSortedAssignments.length}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={assignmentSafePage <= 1}
                      onClick={() =>
                        setAssignmentPage((p) => Math.max(1, p - 1))
                      }
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        assignmentSafePage >= assignmentTotalPages
                      }
                      onClick={() =>
                        setAssignmentPage((p) =>
                          Math.min(assignmentTotalPages, p + 1)
                        )
                      }
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
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
        ) : teachersForList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            No teachers in this view yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-zinc-800">
            {teachersForList.map((t) => (
              <li
                key={t.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {t.fullName}
                    {!t.passwordChanged ? (
                      <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                        Pending first login
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.email ?? "No email"}
                    {t.joinedAtLabel ? ` · joined ${t.joinedAtLabel}` : ""}
                  </p>
                </div>
                <form action={removeTeacherAction}>
                  <input type="hidden" name="membership_id" value={t.membershipId} />
                  <input type="hidden" name="teacher_user_id" value={t.userId} />
                  <button
                    type="submit"
                    disabled={removeTeacherPending}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {removeTeacherPending ? "Removing…" : "Remove from school"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal ? (
        <AssignTeacherModal
          modal={modal}
          onClose={() => setModal(null)}
          classOptions={classOptions}
          subjectOptionsByClassId={subjectOptionsByClassId}
          modalFormAction={modalFormAction}
          modalPending={modalPending}
          modalFlash={modalFlash}
        />
      ) : null}
    </div>
  );
}
