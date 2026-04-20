"use client";

import { useMemo, useState } from "react";
import { ClassRow } from "./class-row";
import type { Class } from "@/types/supabase";

export interface ClassListItem {
  cls: Class;
  isStream: boolean;
  streamCount: number;
}

interface ClassesListProps {
  items: ClassListItem[];
  parentOptions: { id: string; name: string }[];
}

const PAGE_SIZE = 5;

/**
 * Build a compact page-number sequence with ellipses. The pattern always
 * includes the first and last page, the current page, and its direct
 * neighbours. Everything else collapses into a `"…"` token so very long
 * lists don't overflow the paginator.
 */
function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    out.push(sorted[i]);
    const next = sorted[i + 1];
    if (next != null && next - sorted[i] > 1) {
      out.push("ellipsis");
    }
  }
  return out;
}

export function ClassesList({ items, parentOptions }: ClassesListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total);
  const visibleItems = filteredItems.slice(pageStart, pageEnd);
  const pageNumbers = buildPageNumbers(safePage, totalPages);

  function handleSearchChange(value: string) {
    setQuery(value);
    // Reset to page 1 whenever the filter changes so we don't leave the admin
    // stranded on a now-empty page after typing in the search box.
    setPage(1);
  }

  return (
    <div className="space-y-4">
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
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-zinc-800">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {total === 0
              ? normalizedQuery
                ? "No matching classes"
                : "No classes yet"
              : `Showing ${pageStart + 1}–${pageEnd} of ${total} ${
                  total === 1 ? "class" : "classes"
                }`}
          </p>
        </div>

        <div className="hidden border-b border-slate-200 px-6 py-3 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-4 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Name
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Description
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
                parentOptions={parentOptions.filter((p) => p.id !== cls.id)}
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
                        ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"
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
