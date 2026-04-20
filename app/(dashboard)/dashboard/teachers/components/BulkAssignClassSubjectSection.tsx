"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  collectParentClassIds,
  sortClassRowsByHierarchy,
} from "@/lib/class-options";
import type { TeacherActionState } from "../types";

export interface BulkAssignableTeacherOption {
  userId: string;
  fullName: string;
}

function academicYearSelectValues(): string[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1, y + 2, y + 3, y + 4].map(String);
}

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

interface ClassOpt {
  id: string;
  name: string;
  parent_class_id: string | null;
}

interface SubjectOpt {
  id: string;
  name: string;
  code: string | null;
}

export function BulkAssignClassSubjectSection({
  expanded,
  onToggle,
  assignableTeachers,
  classOptions,
  allSubjects,
  formAction,
  pending,
  flashState,
}: {
  expanded: boolean;
  onToggle: () => void;
  assignableTeachers: BulkAssignableTeacherOption[];
  classOptions: ClassOpt[];
  allSubjects: SubjectOpt[];
  formAction: (formData: FormData) => void;
  pending: boolean;
  flashState: TeacherActionState | null;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [classIds, setClassIds] = useState<Set<string>>(() => new Set());
  const [subjectIds, setSubjectIds] = useState<Set<string>>(() => new Set());
  const [classQuery, setClassQuery] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");

  const parentIds = useMemo(
    () => collectParentClassIds(classOptions),
    [classOptions]
  );

  const sortedClasses = useMemo(
    () => sortClassRowsByHierarchy(classOptions),
    [classOptions]
  );

  const sortedSubjects = useMemo(() => {
    const copy = [...allSubjects];
    copy.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return copy;
  }, [allSubjects]);

  const filteredClasses = useMemo(() => {
    const q = classQuery.trim().toLowerCase();
    if (!q) return sortedClasses;
    return sortedClasses.filter((c) =>
      c.name.toLowerCase().includes(q)
    );
  }, [sortedClasses, classQuery]);

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return sortedSubjects;
    return sortedSubjects.filter((s) => {
      const hay = [s.name, s.code ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [sortedSubjects, subjectQuery]);

  /** ~3 visible class rows (borders + py-2 + space-y-2). */
  const classListMaxHeight = "max-h-[9rem]";
  /** ~3 visible subject rows (slightly tighter rows). */
  const subjectListMaxHeight = "max-h-[7.5rem]";

  useEffect(() => {
    if (flashState?.ok) {
      setClassIds(new Set());
      setSubjectIds(new Set());
      setClassQuery("");
      setSubjectQuery("");
    }
  }, [flashState]);

  const pairCount = classIds.size * subjectIds.size;

  function toggleClass(id: string) {
    setClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSubject(id: string) {
    setSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        <span>Bulk assign class &amp; subject</span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Select one teacher, then choose any number of classes and subjects.
              We create one assignment per class × subject (only where that
              subject is linked to the class in Manage Subjects). Existing
              assignments for the same year are skipped.
            </p>

            <form action={formAction} className="mt-4 space-y-4">
        {flash(flashState)}

        <label className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">
            Teacher <span className="text-red-600">*</span>
          </span>
          <select
            name="teacher_id"
            required
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={assignableTeachers.length === 0}
            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">Select a teacher…</option>
            {assignableTeachers.map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.fullName}
              </option>
            ))}
          </select>
          {assignableTeachers.length === 0 ? (
            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
              Teachers must activate their account before they can receive
              assignments.
            </span>
          ) : null}
        </label>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Classes <span className="text-red-600">*</span>
            </span>
            {classOptions.length > 0 ? (
              <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                ({classIds.size} of {sortedClasses.length} selected)
              </span>
            ) : null}
          </div>
          {classOptions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              No classes yet. Create classes first.
            </p>
          ) : (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-zinc-700">
              <div className="border-b border-slate-200 p-2 dark:border-zinc-700">
                <label className="relative block">
                  <span className="sr-only">Search classes</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={classQuery}
                    onChange={(e) => setClassQuery(e.target.value)}
                    placeholder="Search classes..."
                    className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </label>
              </div>
              <div
                className={`${classListMaxHeight} space-y-2 overflow-y-auto p-2 pt-2`}
              >
                {filteredClasses.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-500 dark:text-zinc-400">
                    No classes match your search.
                  </p>
                ) : (
                  filteredClasses.map((c) => {
                    const checked = classIds.has(c.id);
                    const isStream = Boolean(c.parent_class_id);
                    const isParentWithStreams = parentIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isStream ? "pl-6" : ""
                        } ${
                          checked
                            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/40"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClass(c.id)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span
                          className={
                            isParentWithStreams
                              ? "font-semibold text-slate-900 dark:text-white"
                              : isStream
                                ? "font-normal text-slate-800 dark:text-zinc-200"
                                : "font-medium text-slate-900 dark:text-white"
                          }
                        >
                          {c.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {filteredClasses.length > 3 ? (
                <p className="border-t border-slate-200 px-3 py-1.5 text-center text-xs text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                  Scroll for more
                </p>
              ) : null}
            </div>
          )}
          {Array.from(classIds).map((id) => (
            <input key={id} type="hidden" name="bulk_class_ids" value={id} />
          ))}
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Subjects <span className="text-red-600">*</span>
            </span>
            {allSubjects.length > 0 ? (
              <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                ({subjectIds.size} of {sortedSubjects.length} selected)
              </span>
            ) : null}
          </div>
          {allSubjects.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              No subjects yet. Add subjects first.
            </p>
          ) : (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-zinc-700">
              <div className="border-b border-slate-200 p-2 dark:border-zinc-700">
                <label className="relative block">
                  <span className="sr-only">Search subjects</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={subjectQuery}
                    onChange={(e) => setSubjectQuery(e.target.value)}
                    placeholder="Search subjects..."
                    className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </label>
              </div>
              <div
                className={`${subjectListMaxHeight} space-y-1 overflow-y-auto p-2 pt-2`}
              >
                {filteredSubjects.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-500 dark:text-zinc-400">
                    No subjects match your search.
                  </p>
                ) : (
                  filteredSubjects.map((s) => {
                    const checked = subjectIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          checked
                            ? "bg-indigo-50/80 dark:bg-indigo-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSubject(s.id)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="text-slate-900 dark:text-white">
                          {s.name}
                          {s.code ? (
                            <span className="text-slate-500 dark:text-zinc-400">
                              {" "}
                              ({s.code})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {filteredSubjects.length > 3 ? (
                <p className="border-t border-slate-200 px-3 py-1.5 text-center text-xs text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                  Scroll for more
                </p>
              ) : null}
            </div>
          )}
          {Array.from(subjectIds).map((id) => (
            <input key={id} type="hidden" name="bulk_subject_ids" value={id} />
          ))}
        </div>

        <label className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">
            Academic year <span className="text-red-600">*</span>
          </span>
          <select
            name="academic_year"
            required
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
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

        <button
          type="submit"
          disabled={
            pending ||
            assignableTeachers.length === 0 ||
            !teacherId ||
            classIds.size === 0 ||
            subjectIds.size === 0 ||
            pairCount === 0
          }
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Assigning…"
            : `Assign ${pairCount} assignment${pairCount === 1 ? "" : "s"}`}
        </button>
      </form>
          </div>
        </div>
      </div>
    </section>
  );
}
