"use client";

import type { ReactNode } from "react";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  LARGE_STUDENT_LIST_ROW_OPTIONS,
  type LargeStudentListRowOption,
} from "@/lib/student-list-pagination";

export function StudentListTableToolbar(props: {
  searchId: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  rowsPerPage: LargeStudentListRowOption;
  onRowsPerPage: (value: LargeStudentListRowOption) => void;
  summary: ReactNode;
  rowOptions?: readonly LargeStudentListRowOption[];
}) {
  const {
    searchId,
    searchPlaceholder,
    query,
    onQueryChange,
    rowsPerPage,
    onRowsPerPage,
    summary,
    rowOptions = LARGE_STUDENT_LIST_ROW_OPTIONS,
  } = props;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.38 9.85l3.39 3.39a.75.75 0 1 0 1.06-1.06l-3.39-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) =>
              onRowsPerPage(Number(e.target.value) as LargeStudentListRowOption)
            }
            aria-label="Rows per page"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            {rowOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{summary}</p>
      </div>
    </div>
  );
}

export function StudentListPaginationBar(props: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const { page, totalPages, onPage } = props;
  const items = getCompactPaginationItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Previous
      </button>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {items.map((p, idx) =>
            p === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                className="px-2 text-xs text-slate-400 dark:text-zinc-500"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-school-primary text-white shadow-sm hover:brightness-105"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>
      ) : (
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
      )}
      <button
        type="button"
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Next
      </button>
    </div>
  );
}
