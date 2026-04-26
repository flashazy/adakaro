"use client";

import { useEffect, useMemo, useState } from "react";
import { ClassRow } from "./class-row";
import { EditClassModal } from "./edit-class-modal";
import type { Class } from "@/types/supabase";
import type { SchoolTeacherOption } from "@/lib/class-teacher";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  DASHBOARD_CLASSES_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

export interface ClassListItem {
  cls: Class;
  isStream: boolean;
  streamCount: number;
}

interface ClassesListProps {
  items: ClassListItem[];
  parentOptions: { id: string; name: string }[];
  teacherOptions: SchoolTeacherOption[];
  classTeacherNameById: Map<string, string>;
}

export function ClassesList({
  items,
  parentOptions,
  teacherOptions,
  classTeacherNameById,
}: ClassesListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(DASHBOARD_CLASSES_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  // Filter rows whose name or description contain the query. Hierarchy props
  // (isStream / streamCount) carry through untouched so child streams still
  // render with their "↳" indicator even when a match surfaces them on a
  // different page from their parent.
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter(({ cls }) => {
      const name = cls.name?.toLowerCase() ?? "";
      const desc = cls.description?.toLowerCase() ?? "";
      return name.includes(normalizedQuery) || desc.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const pageEnd = Math.min(pageStart + rowsPerPage, total);
  const visibleItems = filteredItems.slice(pageStart, pageEnd);
  const pageNumbers = getCompactPaginationItems(safePage, totalPages);

  function handleSearchChange(value: string) {
    setQuery(value);
    // Reset to page 1 whenever the filter changes so we don't leave the admin
    // stranded on a now-empty page after typing in the search box.
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <EditClassModal
        cls={editingClass}
        parentOptions={
          editingClass
            ? parentOptions.filter((p) => p.id !== editingClass.id)
            : []
        }
        teacherOptions={teacherOptions}
        onClose={() => setEditingClass(null)}
      />
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.38 9.85l3.39 3.39a.75.75 0 1 0 1.06-1.06l-3.39-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search classes by name..."
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {total === 0
              ? normalizedQuery
                ? "No matching classes"
                : "No classes yet"
              : `Showing ${pageStart + 1}–${pageEnd} of ${total} ${
                  total === 1 ? "class" : "classes"
                }`}
          </p>
          {total > 0 ? (
            <label className="flex items-center gap-2 sm:shrink-0">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Rows
              </span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  const n = Number(e.target.value) as StudentListRowOption;
                  setRowsPerPage(n);
                  setPage(1);
                  localStorage.setItem(
                    DASHBOARD_CLASSES_ROWS_STORAGE_KEY,
                    String(n)
                  );
                }}
                aria-label="Rows per page"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              >
                {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="hidden border-b border-slate-200 px-6 py-3 sm:grid sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-4 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Name
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Description
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Class teacher
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Actions
          </p>
        </div>

        {visibleItems.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {visibleItems.map(({ cls, isStream, streamCount }) => (
              <ClassRow
                key={cls.id}
                cls={cls}
                isStream={isStream}
                streamCount={streamCount}
                classTeacherLabel={
                  cls.class_teacher_id
                    ? classTeacherNameById.get(cls.class_teacher_id) ?? "—"
                    : null
                }
                onEdit={setEditingClass}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {normalizedQuery
                ? `No classes match "${query.trim()}".`
                : "No classes on this page."}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    aria-hidden
                    className="px-2 text-xs text-slate-400 dark:text-zinc-500"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                    className={`min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      p === safePage
                        ? "bg-school-primary text-white shadow-sm hover:brightness-105"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
