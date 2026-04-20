"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatNativeSelectClassOptionLabel } from "@/lib/class-options";
import type { TeacherActionState } from "../types";
import type { BulkAssignableTeacherOption } from "./BulkAssignClassSubjectSection";

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

function academicYearSelectValues(): string[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1, y + 2, y + 3, y + 4].map(String);
}

/** Stable id for combobox/listbox (avoids useId SSR/client mismatch on this page). */
const ASSIGN_SINGLE_TEACHER_LISTBOX_ID =
  "assign-single-class-subject-teacher-listbox";

export function AssignSingleClassSubjectForm({
  expanded,
  onToggle,
  assignableTeachers,
  classOptions,
  subjectOptionsByClassId,
  formAction,
  pending,
  flashState,
}: {
  expanded: boolean;
  onToggle: () => void;
  assignableTeachers: BulkAssignableTeacherOption[];
  classOptions: { id: string; name: string; parent_class_id: string | null }[];
  subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  >;
  formAction: (formData: FormData) => void;
  pending: boolean;
  flashState: TeacherActionState | null;
}) {
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignYear, setAssignYear] = useState(() =>
    String(new Date().getFullYear())
  );
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignTeacherQuery, setAssignTeacherQuery] = useState("");
  const [assignTeacherListOpen, setAssignTeacherListOpen] = useState(false);

  const assignSubjects = useMemo(() => {
    if (!assignClassId) return [];
    return subjectOptionsByClassId[assignClassId] ?? [];
  }, [assignClassId, subjectOptionsByClassId]);

  const filteredAssignTeachers = useMemo(() => {
    const q = assignTeacherQuery.trim().toLowerCase();
    if (!q) return assignableTeachers;
    return assignableTeachers.filter((t) =>
      t.fullName.toLowerCase().includes(q)
    );
  }, [assignableTeachers, assignTeacherQuery]);

  useEffect(() => {
    if (flashState?.ok) {
      setAssignYear(String(new Date().getFullYear()));
    }
  }, [flashState]);

  useEffect(() => {
    if (
      assignTeacherId &&
      !assignableTeachers.some((t) => t.userId === assignTeacherId)
    ) {
      setAssignTeacherId("");
      setAssignTeacherQuery("");
    }
  }, [assignTeacherId, assignableTeachers]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg text-left text-base font-semibold text-slate-900 outline-none ring-offset-2 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-white dark:hover:bg-zinc-800 dark:ring-offset-zinc-900"
      >
        <span className="inline-block w-4 shrink-0 select-none" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
        <span>Add one assignment</span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Pick a teacher who has signed in and changed their password, then
              choose class, subject, and year.
            </p>
            <form action={formAction} className="mt-4 space-y-3">
        {flash(flashState)}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-700">Teacher</span>
            <input type="hidden" name="teacher_id" value={assignTeacherId} />
            <div className="relative mt-1 flex gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  autoComplete="off"
                  value={assignTeacherQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAssignTeacherQuery(v);
                    setAssignTeacherId((id) => {
                      if (!id) return "";
                      const sel = assignableTeachers.find(
                        (t) => t.userId === id
                      );
                      if (!sel || sel.fullName !== v) return "";
                      return id;
                    });
                  }}
                  onFocus={() => setAssignTeacherListOpen(true)}
                  onBlur={() => {
                    window.setTimeout(
                      () => setAssignTeacherListOpen(false),
                      180
                    );
                  }}
                  role="combobox"
                  aria-expanded={assignTeacherListOpen}
                  aria-controls={ASSIGN_SINGLE_TEACHER_LISTBOX_ID}
                  aria-autocomplete="list"
                  placeholder="Search or select a teacher…"
                  disabled={assignableTeachers.length === 0}
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {assignTeacherListOpen ? (
                  <ul
                    id={ASSIGN_SINGLE_TEACHER_LISTBOX_ID}
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    {assignableTeachers.length === 0 ? (
                      <li
                        className="px-3 py-2 text-sm text-slate-500"
                        role="presentation"
                      >
                        No teachers have activated their account yet. They must
                        sign in and change their password before you can assign
                        classes.
                      </li>
                    ) : filteredAssignTeachers.length === 0 ? (
                      <li
                        className="px-3 py-2 text-sm text-slate-500"
                        role="presentation"
                      >
                        No teachers match your search.
                      </li>
                    ) : (
                      filteredAssignTeachers.map((t) => (
                        <li key={t.userId} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={assignTeacherId === t.userId}
                            className={`flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              assignTeacherId === t.userId
                                ? "bg-gray-100 font-medium"
                                : ""
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setAssignTeacherId(t.userId);
                              setAssignTeacherQuery(t.fullName);
                              setAssignTeacherListOpen(false);
                            }}
                          >
                            {t.fullName}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignTeacherId("");
                  setAssignTeacherQuery("");
                  setAssignTeacherListOpen(false);
                }}
                disabled={
                  assignableTeachers.length === 0 ||
                  (assignTeacherId === "" && assignTeacherQuery === "")
                }
                className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-slate-600 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Clear teacher selection"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Class</span>
            <select
              name="class_id"
              required
              value={assignClassId}
              onChange={(e) => {
                setAssignClassId(e.target.value);
                setAssignSubjectId("");
              }}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="">Select…</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatNativeSelectClassOptionLabel(
                    c.name,
                    c.parent_class_id
                  )}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Subject</span>
            <select
              name="subject_id"
              required
              value={assignSubjectId}
              onChange={(e) => setAssignSubjectId(e.target.value)}
              disabled={
                !subjectOptionsByClassId ||
                Object.keys(subjectOptionsByClassId).length === 0
              }
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {!assignClassId
                  ? "Select a class first…"
                  : assignSubjects.length === 0
                    ? "No subjects for this class. Link subjects in Manage Subjects first."
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
            <span className="text-slate-700">
              Academic year <span className="text-red-600">*</span>
            </span>
            <select
              name="academic_year"
              required
              value={assignYear}
              onChange={(e) => setAssignYear(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              {academicYearSelectValues().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Calendar year (January–December), e.g. 2025.
            </span>
          </label>
        </div>
        <button
          type="submit"
          disabled={
            pending ||
            assignableTeachers.length === 0 ||
            !assignTeacherId ||
            !assignClassId ||
            !assignSubjectId ||
            assignSubjects.length === 0
          }
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Saving…" : "Save assignment"}
        </button>
      </form>
          </div>
        </div>
      </div>
    </section>
  );
}
