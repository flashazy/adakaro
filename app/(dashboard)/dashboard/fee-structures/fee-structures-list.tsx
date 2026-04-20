"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FeeStructureRow } from "./fee-structure-row";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  DASHBOARD_FEE_STRUCTURES_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

type FeeTypeOption = { id: string; name: string };
type ClassOption = { id: string; name: string };
type StudentOption = {
  id: string;
  full_name: string;
  admission_number: string | null;
};

export type FeeStructureListItem = {
  id: string;
  fee_type_id: string | null;
  class_id: string | null;
  student_id: string | null;
  amount: number;
  due_date: string | null;
  fee_type: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  student: { id: string; full_name: string } | null;
};

function structureSearchHaystack(s: FeeStructureListItem): string {
  const parts = [
    s.fee_type?.name ?? "",
    s.class?.name ?? "",
    s.student?.full_name ?? "",
  ];
  return parts.join(" ").toLowerCase();
}

export function FeeStructuresList({
  structures,
  feeTypes,
  classes,
  students,
  currencyCode,
}: {
  structures: FeeStructureListItem[];
  feeTypes: FeeTypeOption[];
  classes: ClassOption[];
  students: StudentOption[];
  currencyCode: string;
}) {
  const [query, setQuery] = useState("");
  const [feeTypeFilterId, setFeeTypeFilterId] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(DASHBOARD_FEE_STRUCTURES_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return structures.filter((s) => {
      if (feeTypeFilterId && s.fee_type_id !== feeTypeFilterId) return false;
      if (!q) return true;
      return structureSearchHaystack(s).includes(q);
    });
  }, [structures, query, feeTypeFilterId]);

  useEffect(() => {
    setPage(1);
  }, [query, feeTypeFilterId]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const paged = filtered.slice(start, start + rowsPerPage);

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(start + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(start + rowsPerPage, totalFiltered);

  const sortedFeeTypes = useMemo(
    () => [...feeTypes].sort((a, b) => a.name.localeCompare(b.name)),
    [feeTypes]
  );

  return (
    <div className="mt-8 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by fee type, class, or student..."
              aria-label="Search fee structures"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <label className="flex min-w-[12rem] flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Filter by fee type
            </span>
            <select
              value={feeTypeFilterId}
              onChange={(e) => setFeeTypeFilterId(e.target.value)}
              aria-label="Filter by fee type"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">All fee types</option>
              {sortedFeeTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-zinc-700">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No fee structures match your filters."
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {totalFiltered}
              </span>{" "}
              fee structure{totalFiltered !== 1 ? "s" : ""}
            </>
          )}
        </p>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            Rows per page:
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as StudentListRowOption;
              setRowsPerPage(n);
              setPage(1);
              localStorage.setItem(
                DASHBOARD_FEE_STRUCTURES_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {STUDENT_LIST_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalFiltered === 0 ? null : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="hidden border-b border-slate-200 px-6 py-3 sm:grid sm:grid-cols-[1fr_1fr_100px_100px_auto] sm:gap-4 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Fee Type
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Target
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Amount
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Due Date
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Actions
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {paged.map((s) => (
                <FeeStructureRow
                  key={s.id}
                  structure={s}
                  feeTypes={feeTypes}
                  classes={classes}
                  students={students}
                  currencyCode={currencyCode}
                />
              ))}
            </div>
          </div>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2"
              aria-label="Fee structures pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              {paginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`fs-ellipsis-${idx}`}
                    className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={
                      item === safePage
                        ? "rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
