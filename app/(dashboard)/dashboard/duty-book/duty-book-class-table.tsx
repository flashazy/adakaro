"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DUTY_BOOK_PAGE_SIZE_OPTIONS,
  filterDutyBookClasses,
  hasActiveDutyBookClassFilters,
  sortDutyBookClasses,
  type DutyBookAttendanceFilter,
  type DutyBookPageSize,
  type DutyBookSortDir,
  type DutyBookSortKey,
} from "@/lib/duty-book/duty-book-class-filters";
import type { DutyBookClassRow, DutyBookGenderFilter } from "@/lib/duty-book/types";
import {
  ILL_STATUS_DISPLAY,
  ILL_STATUS_DISPLAY_LOWER,
} from "@/lib/student-attendance-status";

function renderClassCell(row: DutyBookClassRow, key: DutyBookSortKey) {
  switch (key) {
    case "className":
      return (
        <span className="font-medium text-slate-900 dark:text-white">
          {row.className}
        </span>
      );
    case "boys":
    case "girls":
    case "total":
      return (
        <span className="tabular-nums text-slate-700 dark:text-zinc-300">
          {row[key]}
        </span>
      );
    case "present":
      return attendanceCell(row.present);
    case "absent":
      return attendanceCell(row.absent);
    case "ill":
      return attendanceCell(row.ill);
    case "permitted":
      return attendanceCell(row.permitted);
    default:
      return null;
  }
}

function attendanceCell(value: number | null) {
  if (value === null) {
    return (
      <span className="text-slate-400 dark:text-zinc-500" title="No attendance recorded">
        —
      </span>
    );
  }
  return <span className="tabular-nums">{value}</span>;
}

const ATTENDANCE_FILTER_OPTIONS: {
  value: DutyBookAttendanceFilter;
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "has-present", label: "Has present" },
  { value: "has-absent", label: "Has absent" },
  { value: "has-ill", label: `Has ${ILL_STATUS_DISPLAY_LOWER}` },
  { value: "has-permitted", label: "Has permitted" },
];

const SORT_COLUMNS: {
  key: DutyBookSortKey;
  label: string;
  align: "left" | "right";
}[] = [
  { key: "className", label: "Class", align: "left" },
  { key: "boys", label: "Boys", align: "right" },
  { key: "girls", label: "Girls", align: "right" },
  { key: "total", label: "Total", align: "right" },
  { key: "present", label: "Present", align: "right" },
  { key: "absent", label: "Absent", align: "right" },
  { key: "ill", label: ILL_STATUS_DISPLAY, align: "right" },
  { key: "permitted", label: "Permitted", align: "right" },
];

export function DutyBookClassTable(props: {
  classes: DutyBookClassRow[];
  genderFilter: DutyBookGenderFilter;
  date: string;
  disabled?: boolean;
  canExport?: boolean;
  onExportError?: (message: string) => void;
}) {
  const { classes, genderFilter, date, disabled, canExport = false, onExportError } =
    props;
  const totalClasses = classes.length;

  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] =
    useState<DutyBookAttendanceFilter>("all");
  const [sortKey, setSortKey] = useState<DutyBookSortKey>("className");
  const [sortDir, setSortDir] = useState<DutyBookSortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DutyBookPageSize>(10);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const visibleColumns = useMemo(
    () =>
      SORT_COLUMNS.filter((col) => {
        if (genderFilter === "boys" && col.key === "girls") return false;
        if (genderFilter === "girls" && col.key === "boys") return false;
        return true;
      }),
    [genderFilter]
  );

  const filters = useMemo(
    () => ({
      search,
      attendance: attendanceFilter,
    }),
    [search, attendanceFilter]
  );

  const filtersActive = hasActiveDutyBookClassFilters(filters);

  const filtered = useMemo(
    () => filterDutyBookClasses(classes, filters),
    [classes, filters]
  );

  const sorted = useMemo(
    () => sortDutyBookClasses(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  useEffect(() => {
    setPage(1);
  }, [search, attendanceFilter, pageSize, genderFilter]);

  const filteredCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredCount);
  const pageRows = sorted.slice(pageStart, pageEnd);

  const showingFrom = filteredCount === 0 ? 0 : pageStart + 1;
  const showingTo = filteredCount === 0 ? 0 : pageEnd;

  function toggleSort(key: DutyBookSortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setAttendanceFilter("all");
    setPage(1);
  }

  const downloadFilteredExport = async (format: "csv" | "pdf") => {
    if (filteredCount === 0) {
      onExportError?.("No classes match the current filters.");
      return;
    }
    setExporting(format);
    try {
      const classIds = sorted.map((r) => r.classId).join(",");
      const params = new URLSearchParams({
        date,
        format,
        classIds,
        filtered: "1",
        gender: genderFilter,
      });
      const res = await fetch(`/api/duty-book/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        onExportError?.(body?.error ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `duty-book-filtered-${date}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onExportError?.("Export failed. Check your connection and try again.");
    } finally {
      setExporting(null);
    }
  };

  function SortIcon({ column }: { column: DutyBookSortKey }) {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
    );
  }

  const inputClass =
    "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Breakdown by class
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Attendance columns reflect class attendance saved for this date only.
          Classes with no recorded attendance show —.
        </p>
      </div>

      <div className="border-b border-slate-200 px-4 py-4 dark:border-zinc-700">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Search class
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class name…"
              disabled={disabled}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Attendance status
            </span>
            <select
              value={attendanceFilter}
              onChange={(e) =>
                setAttendanceFilter(e.target.value as DutyBookAttendanceFilter)
              }
              disabled={disabled}
              className={inputClass}
            >
              {ATTENDANCE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtersActive ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                {filteredCount}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                {totalClasses}
              </span>{" "}
              classes match filters
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-school-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-zinc-700">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {filteredCount === 0 ? (
            totalClasses === 0 ? (
              "No classes"
            ) : filtersActive ? (
              "No classes match the current filters"
            ) : (
              "No classes to show"
            )
          ) : (
            <>
              Showing{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-zinc-300">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-zinc-300">
                {filteredCount}
              </span>{" "}
              {filteredCount === 1 ? "class" : "classes"}
              {filtersActive && filteredCount !== totalClasses ? (
                <span className="text-slate-400 dark:text-zinc-500">
                  {" "}
                  ({totalClasses} total)
                </span>
              ) : null}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <span className="shrink-0">Rows</span>
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value) as DutyBookPageSize)
              }
              disabled={disabled}
              aria-label="Rows per page"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {DUTY_BOOK_PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {canExport ? (
            <>
              <button
                type="button"
                disabled={!!exporting || disabled || filteredCount === 0}
                onClick={() => void downloadFilteredExport("csv")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {exporting === "csv" ? "Exporting…" : "Export filtered CSV"}
              </button>
              <button
                type="button"
                disabled={!!exporting || disabled || filteredCount === 0}
                onClick={() => void downloadFilteredExport("pdf")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {exporting === "pdf" ? "Exporting…" : "Export filtered PDF"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={safePage <= 1 || disabled}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages || disabled}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-zinc-800/80 dark:text-zinc-400">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-medium",
                    col.align === "right" && "text-right"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 transition-colors hover:text-slate-800 dark:hover:text-zinc-200",
                      col.align === "right" && "ml-auto"
                    )}
                  >
                    {col.label}
                    <SortIcon column={col.key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-4 py-8 text-center text-slate-500 dark:text-zinc-400"
                >
                  {totalClasses === 0
                    ? "No active students in any class."
                    : filtersActive
                      ? "No classes match the current filters."
                      : "No classes to display."}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.classId}
                  className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {renderClassCell(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
