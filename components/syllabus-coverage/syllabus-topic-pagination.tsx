"use client";

interface SyllabusTopicPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  rowsPerPageOptions?: readonly number[];
}

export function SyllabusTopicPagination({
  total,
  page,
  pageSize,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 20],
}: SyllabusTopicPaginationProps) {
  if (total <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const paginationUnnecessary = total <= pageSize;

  if (paginationUnnecessary) {
    return (
      <p className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
        Showing{" "}
        <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
          {total}
        </span>{" "}
        topic{total === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
        Showing{" "}
        <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
          {from}–{to}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
          {total}
        </span>{" "}
        topic{total === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
          <span className="shrink-0">Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {rowsPerPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
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
