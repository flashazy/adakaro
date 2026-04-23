"use client";

import { useEffect, useMemo, useState } from "react";
import RequestRow, { type RequestData } from "./request-row";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  PENDING_APPROVALS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
  className: string;
}

function norm(v: string | null) {
  return (v ?? "").trim().toLowerCase();
}

function resolveStudentDisplay(
  request: RequestData,
  students: StudentOption[]
) {
  const reqAdm = norm(request.admissionNumber);
  if (request.matchedStudentId) {
    const s = students.find((x) => x.id === request.matchedStudentId);
    if (s) return { name: s.full_name, className: s.className };
  }
  const byAdm = students.find((s) => norm(s.admission_number) === reqAdm);
  if (byAdm) return { name: byAdm.full_name, className: byAdm.className };
  return { name: "", className: "" };
}

function requestMatchesSearch(
  request: RequestData,
  students: StudentOption[],
  q: string
) {
  if (!q) return true;
  const { name: sn, className: cn } = resolveStudentDisplay(
    request,
    students
  );
  const hay = [
    request.parentName,
    request.parentEmail ?? "",
    request.parentPhone ?? "",
    sn,
    cn,
    request.admissionNumber,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function PendingApprovalsTable({
  requests,
  students,
}: {
  requests: RequestData[];
  students: StudentOption[];
}) {
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(PENDING_APPROVALS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => requestMatchesSearch(r, students, q));
  }, [requests, students, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageSlice = filtered.slice(start, start + rowsPerPage);

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(start + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(start + rowsPerPage, totalFiltered);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <svg
            className="h-4 w-4 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          Pending Approvals
        </h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          {requests.length}
        </span>
      </div>

      <div className="border-b border-slate-200 px-6 py-3 dark:border-zinc-800">
        <label htmlFor="pending-approvals-search" className="sr-only">
          Search by parent or student name
        </label>
        <input
          id="pending-approvals-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by parent or student name..."
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 dark:border-zinc-800">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No pending requests match your search."
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
              pending request{totalFiltered !== 1 ? "s" : ""}
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
                PENDING_APPROVALS_ROWS_STORAGE_KEY,
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

      {totalFiltered === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            No requests match your search.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Try a different name or clear the search box.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Student
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell dark:text-zinc-400">
                    Class
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Request date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              {pageSlice.map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  students={students}
                />
              ))}
            </table>
          </div>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-6 py-4 dark:border-zinc-800"
              aria-label="Pending requests pagination"
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
                    key={`pa-ellipsis-${idx}`}
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
                        ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
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
