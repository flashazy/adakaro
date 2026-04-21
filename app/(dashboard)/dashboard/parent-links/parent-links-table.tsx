"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LinkRow, { type ParentLinkData } from "./link-row";
import { deleteParentLink } from "./actions";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  APPROVED_CONNECTIONS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

type SortKey = "parent" | "student";
type SortDir = "asc" | "desc";

export function ParentLinksTable({ links }: { links: ParentLinkData[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("parent");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deleteTarget, setDeleteTarget] = useState<ParentLinkData | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(APPROVED_CONNECTIONS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.parentName.toLowerCase().includes(q) ||
        l.studentName.toLowerCase().includes(q) ||
        (l.parentEmail?.toLowerCase().includes(q) ?? false)
    );
  }, [links, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortKey === "parent" ? a.parentName : a.studentName;
      const bv = sortKey === "parent" ? b.parentName : b.studentName;
      const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageSlice = sorted.slice(start, start + rowsPerPage);

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(start + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(start + rowsPerPage, totalFiltered);

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteParentLink(deleteTarget.id);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  }

  if (links.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <svg
              className="h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            Connections
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
            0
          </span>
        </div>
        <div className="px-6 py-12 text-center">
          <svg
            className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
            No parent-student links found
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            When parents are approved via link requests, their links will
            appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <svg
              className="h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            Connections
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
            {links.length} connection{links.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="border-b border-slate-200 px-6 py-3 dark:border-zinc-800">
          <label htmlFor="parent-links-search" className="sr-only">
            Search by parent or student name
          </label>
          <input
            id="parent-links-search"
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by parent or student name..."
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 dark:border-zinc-800">
          <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
            {totalFiltered === 0 ? (
              "No connections match your search."
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
                connection{totalFiltered !== 1 ? "s" : ""}
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
                  APPROVED_CONNECTIONS_ROWS_STORAGE_KEY,
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

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No links match your search.
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
                      <button
                        type="button"
                        onClick={() => toggleSort("parent")}
                        className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Parent
                        {sortKey === "parent" ? (
                          <span className="text-[10px] opacity-80">
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("student")}
                        className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Student
                        {sortKey === "student" ? (
                          <span className="text-[10px] opacity-80">
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell dark:text-zinc-400">
                      Class
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((link) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      onRemoveRequest={() => {
                        setDeleteError(null);
                        setDeleteTarget(link);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <nav
                className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-6 py-4 dark:border-zinc-800"
                aria-label="Connections pagination"
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
                      key={`pl-ellipsis-${idx}`}
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

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-link-title"
          >
            <h3
              id="remove-link-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Remove link?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              This will remove the connection between{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {deleteTarget.parentName}
              </span>{" "}
              and{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {deleteTarget.studentName}
              </span>
              . The parent will no longer see this student until a new link is
              approved.
            </p>
            {deleteError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Removing…" : "Remove link"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
