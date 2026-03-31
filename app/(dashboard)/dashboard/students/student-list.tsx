"use client";

import { useState, useMemo, useEffect } from "react";
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

const ROW_OPTIONS = [10, 25, 50, 100] as const;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 0) return [];
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  pages.push(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push("ellipsis");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < total - 1) {
    pages.push("ellipsis");
  }

  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

export function StudentList({ students, classes }: StudentListProps) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, classFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageSlice = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filtered.slice(startIndex, startIndex + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const isFiltered = query !== "" || classFilter !== "";

  const rangeStart = totalFiltered === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const rangeEnd =
    totalFiltered === 0 ? 0 : Math.min(currentPage * rowsPerPage, totalFiltered);

  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return (
    <div>
      {/* Search, filter & row limit */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-sm text-slate-500 dark:text-zinc-400">
            Rows
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
          >
            {ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Showing range */}
      <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
        Showing{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {totalFiltered}
        </span>{" "}
        student{totalFiltered !== 1 ? "s" : ""}
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
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-auto">
              {/* Desktop header — sticky */}
              <div className="sticky top-0 z-10 hidden border-b border-slate-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900 lg:grid lg:grid-cols-[100px_1fr_1fr_1fr_auto] lg:gap-4">
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
                {pageSlice.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    classes={classes}
                  />
                ))}
              </div>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>

              <div className="flex flex-wrap items-center justify-center gap-1">
                {pageNumbers.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-[2.25rem] rounded-md border px-3 py-1 text-sm dark:border-zinc-600 ${
                        currentPage === item
                          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
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
