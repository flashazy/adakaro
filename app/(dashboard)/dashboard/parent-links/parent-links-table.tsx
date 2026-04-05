"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LinkRow, { type ParentLinkData } from "./link-row";
import { deleteParentLink } from "./actions";

type SortKey = "parent" | "student";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [10, 25, 50] as const;

export function ParentLinksTable({ links }: { links: ParentLinkData[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("parent");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deleteTarget, setDeleteTarget] = useState<ParentLinkData | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.parentName.toLowerCase().includes(q) ||
        l.studentName.toLowerCase().includes(q)
    );
  }, [links, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av =
        sortKey === "parent" ? a.parentName : a.studentName;
      const bv =
        sortKey === "parent" ? b.parentName : b.studentName;
      const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = sorted.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  useEffect(() => {
    if (page > 0 && page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  function toggleSort(key: SortKey) {
    setPage(0);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(0);
  }

  function handlePageSizeChange(n: (typeof PAGE_SIZES)[number]) {
    setPageSize(n);
    setPage(0);
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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <span className="whitespace-nowrap">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) =>
                  handlePageSizeChange(
                    Number(e.target.value) as (typeof PAGE_SIZES)[number]
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
              {filtered.length} of {links.length}
            </span>
          </div>
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
            placeholder="Search by parent or student name…"
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
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

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row dark:border-zinc-800">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Showing{" "}
                {sorted.length === 0
                  ? 0
                  : safePage * pageSize + 1}
                –
                {Math.min((safePage + 1) * pageSize, sorted.length)} of{" "}
                {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Page {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </div>
            </div>
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
