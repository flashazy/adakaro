"use client";

interface RankingPaginationBarProps {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  showRowsPerPage?: boolean;
  rowsPerPageOptions?: readonly number[];
  rowsPerPage?: number;
  onRowsPerPageChange?: (n: number) => void;
}

export function RankingPaginationBar({
  total,
  page,
  pageCount,
  pageSize,
  onPageChange,
  showRowsPerPage = false,
  rowsPerPageOptions = [20, 30, 50],
  rowsPerPage,
  onRowsPerPageChange,
}: RankingPaginationBarProps) {
  if (total <= 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="print:hidden flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-zinc-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
        Showing{" "}
        <span className="tabular-nums font-medium text-slate-800 dark:text-zinc-200">
          {from}–{to}
        </span>{" "}
        of{" "}
        <span className="tabular-nums font-medium text-slate-800 dark:text-zinc-200">
          {total}
        </span>{" "}
        students
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {showRowsPerPage && rowsPerPage != null && onRowsPerPageChange ? (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
            <span className="shrink-0">Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {rowsPerPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
