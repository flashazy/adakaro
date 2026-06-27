"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  saBtnSecondarySm,
  saInput,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export const KNOWLEDGE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const KNOWLEDGE_DEFAULT_PAGE_SIZE = 25;

export function buildPageNumbers(
  current: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, current]);
  if (current > 1) pages.add(current - 1);
  if (current < totalPages) pages.add(current + 1);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && page - prev > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }

  return result;
}

interface KnowledgePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}

export function KnowledgePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = KNOWLEDGE_PAGE_SIZE_OPTIONS,
  className,
}: KnowledgePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(safePage * pageSize, total);
  const pageNumbers = buildPageNumbers(safePage, totalPages);

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-4">
        <span className="tabular-nums">
          Showing {rangeStart}–{rangeEnd} of {total} entries
        </span>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(saInput, "h-9 min-w-[4.5rem] py-1 text-sm")}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={saBtnSecondarySm}
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="mr-0.5 h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1.5 text-sm text-slate-400"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === safePage ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition",
                    item === safePage
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <span className="px-2 text-sm tabular-nums text-slate-500 sm:hidden">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            className={saBtnSecondarySm}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
