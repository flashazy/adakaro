"use client";

import { useState, useMemo } from "react";
import { StudentRow } from "./student-row";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: ClassOption | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

interface StudentListProps {
  students: StudentData[];
  classes: ClassOption[];
}

export function StudentList({ students, classes }: StudentListProps) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return students.filter((s) => {
      if (classFilter && s.class_id !== classFilter) return false;

      if (!q) return true;

      const name = s.full_name?.toLowerCase() ?? "";
      const adm = s.admission_number?.toLowerCase() ?? "";
      const className = (
        s.class?.name ?? classNameMap.get(s.class_id) ?? ""
      ).toLowerCase();

      return name.includes(q) || adm.includes(q) || className.includes(q);
    });
  }, [students, query, classFilter, classNameMap]);

  const isFiltered = query !== "" || classFilter !== "";

  return (
    <div>
      {/* Search & filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, admission # or class…"
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Showing X of Y */}
      <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
        Showing{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {filtered.length}
        </span>{" "}
        of{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {students.length}
        </span>{" "}
        student{students.length !== 1 ? "s" : ""}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setClassFilter("");
            }}
            className="ml-2 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Clear filters
          </button>
        )}
      </p>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Desktop header */}
          <div className="hidden border-b border-slate-200 px-6 py-3 lg:grid lg:grid-cols-[100px_1fr_1fr_1fr_auto] lg:gap-4 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Adm #
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Student
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Class
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Parent
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Actions
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {filtered.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                classes={classes}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {isFiltered
              ? "No students match your search."
              : "No students yet. Add your first student above."}
          </p>
        </div>
      )}
    </div>
  );
}
