"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  TEACHER_STUDENTS_ROWS_STORAGE_KEY,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";

export interface TeacherProfileStudentRow {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_name: string;
  gender: string | null;
}

function genderAbbrev(g: string | null | undefined): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return "—";
}

export function TeacherStudentProfilesClient({
  students,
}: {
  students: TeacherProfileStudentRow[];
}) {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(TEACHER_STUDENTS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return students;

    return students.filter((s) => {
      const name = s.full_name?.toLowerCase() ?? "";
      const adm = (s.admission_number ?? "").toLowerCase();
      const className = (s.class_name ?? "").toLowerCase();
      return (
        name.includes(q) || adm.includes(q) || className.includes(q)
      );
    });
  }, [students, query]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageSlice = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filtered.slice(startIndex, startIndex + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const isFiltered = query !== "";

  const rangeStart =
    totalFiltered === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const rangeEnd =
    totalFiltered === 0
      ? 0
      : Math.min(currentPage * rowsPerPage, totalFiltered);

  const pageNumbers = useMemo(
    () => getCompactPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name, admission #, or class..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-3 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary sm:w-full dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            aria-label="Search students"
          />
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>

        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-sm text-gray-500 dark:text-zinc-400">
            Rows
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as StudentListRowOption;
              setRowsPerPage(n);
              setCurrentPage(1);
              localStorage.setItem(
                TEACHER_STUDENTS_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
          >
            {STUDENT_LIST_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            onClick={() => setQuery("")}
            className="ml-2 text-school-primary hover:opacity-90 dark:text-school-primary dark:hover:opacity-90"
          >
            Clear search
          </button>
        )}
      </p>

      {filtered.length > 0 ? (
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 [&_th]:bg-white dark:[&_th]:bg-zinc-900">
                  <tr>
                    <th className="w-[120px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      ADM #
                    </th>
                    <th className="min-w-[200px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Student Name
                    </th>
                    <th className="w-[140px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Class
                    </th>
                    <th className="w-[80px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Gender
                    </th>
                    <th className="sticky right-0 z-30 w-[140px] min-w-[140px] border-l border-slate-200 bg-white px-2 py-3 text-left text-sm font-medium text-gray-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.35)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {pageSlice.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                        {s.admission_number?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {s.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-zinc-300">
                        {s.class_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-zinc-300">
                        {genderAbbrev(s.gender)}
                      </td>
                      <td className="sticky right-0 z-20 border-l border-slate-200 bg-white px-2 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.35)]">
                        <Link
                          href={`/dashboard/students/${s.id}/profile`}
                          className="inline-flex rounded-md border border-[rgb(var(--school-primary-rgb)/0.25)] px-3 py-1.5 text-xs font-medium text-school-primary hover:bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-[rgb(var(--school-primary-rgb)/0.32)] dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              : "No students to show."}
          </p>
        </div>
      )}
    </div>
  );
}
