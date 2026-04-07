"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
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

type TabKey = "assigned" | "unassigned";

export function TeachersPageClient({
  teachers,
  assignments,
  classOptions,
  subjectOptionsByClassId,
}: TeachersPageClientProps) {
  const [tab, setTab] = useState<TabKey>("assigned");
  const [modal, setModal] = useState<AssignModalState | null>(null);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");

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

  const assignedTeacherIds = useMemo(
    () => new Set(assignments.map((a) => a.teacherId)),
    [assignments]
  );

  const unassignedTeachers = useMemo(
    () => teachers.filter((t) => !assignedTeacherIds.has(t.userId)),
    [teachers, assignedTeacherIds]
  );

  const modalFormAction =
    modal?.mode === "edit" ? updateAction : assignAction;
  const modalPending =
    modal?.mode === "edit" ? updatePending : assignPending;
  const modalFlash = modal?.mode === "edit" ? updateState : assignState;

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
          Invite or add teacher
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          If they already have an Adakaro account, they are linked immediately.
          Otherwise we email them a secure link to create a password and join as a
          teacher.
        </p>
        <form action={addAction} className="mt-4 space-y-3">
          {flash(addState)}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-zinc-300">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="teacher@school.edu"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-zinc-300">
                Display name (optional)
              </span>
              <input
                name="full_name"
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="Jane Okello"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={addPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {addPending ? "Saving…" : "Add / invite teacher"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Assign class &amp; subject
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Teachers only see classes you assign here. You can also assign from the
          Unassigned tab.
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
                Academic year (optional)
              </span>
              <input
                name="academic_year"
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="2025–2026"
              />
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
          Assigned teachers have class access. Unassigned teachers see a locked
          dashboard until you assign them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setTab("assigned")}
            className={
              tab === "assigned"
                ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
          >
            Assigned teachers
          </button>
          <button
            type="button"
            onClick={() => setTab("unassigned")}
            className={
              tab === "unassigned"
                ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
          >
            Unassigned teachers
            {unassignedTeachers.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
                {unassignedTeachers.length}
              </span>
            ) : null}
          </button>
        </div>

        {tab === "assigned" ? (
          <div className="mt-4">
            {flash(removeAssignState)}
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                No assignments yet. Use the form above or assign from the
                Unassigned tab.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <div className="text-sm">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {a.teacherName} · {a.className} — {a.subject || "General"}
                      </p>
                      <p className="text-slate-500 dark:text-zinc-400">
                        {a.academicYear ? a.academicYear : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
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
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Edit assignment
                      </button>
                      <form action={removeAssignAction}>
                        <input type="hidden" name="assignment_id" value={a.id} />
                        <button
                          type="submit"
                          disabled={removeAssignPending}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {removeAssignPending ? "Removing…" : "Remove assignment"}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-4">
            {unassignedTeachers.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Every teacher has at least one class assignment.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                {unassignedTeachers.map((t) => (
                  <li
                    key={t.userId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {t.fullName}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {t.email ?? "No email"} ·{" "}
                        <span className="text-amber-700 dark:text-amber-300">
                          Not assigned
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setModal({
                          mode: "assign",
                          teacherId: t.userId,
                          teacherName: t.fullName,
                        })
                      }
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Assign
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          All school teachers
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Remove someone from the school entirely (also removes their class
          assignments).
        </p>
        {flash(removeTeacherState)}
        {teachers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            No teachers yet. Invite someone above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-zinc-800">
            {teachers.map((t) => (
              <li
                key={t.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {t.fullName}
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
