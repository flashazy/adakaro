"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, History, Loader2 } from "lucide-react";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import {
  type StreamingHistoryRow,
  type StreamingParentClassOption,
} from "@/lib/student-streaming/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { cn } from "@/lib/utils";
import { loadStreamingHistoryAction } from "../actions";
import {
  buildBulkRowIds,
  MovementCell,
  PlacementTypeBadge,
  placementTypeRowLeadingClass,
  resolvePlacementType,
  StreamingHistoryRecordCard,
  type PlacementType,
} from "./history-ui";
import { StreamingHistoryDetailPanel } from "./streaming-history-detail-panel";

const TABLE_HEADER_CLASS =
  "px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400";

const PAGINATION_BUTTON_CLASS =
  "inline-flex h-7 min-w-[4.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

const VIEW_DETAILS_BUTTON_CLASS =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/90 dark:hover:shadow-sm";

const TABLE_CELL_CLASS = "px-4 py-3 align-middle";

function academicYearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [""];
  for (let y = current - 2; y <= current + 1; y += 1) {
    years.push(String(y));
  }
  return years;
}

function formatHistoryDateTime(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  const dateLine = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLine = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateLine, timeLine };
}

function formatCoordinatorName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function StreamingHistoryClient({
  initialAcademicYear,
}: {
  initialAcademicYear: string;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StreamingHistoryRow[]>([]);
  const [parentClasses, setParentClasses] = useState<
    StreamingParentClassOption[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [parentClassId, setParentClassId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [coordinatorQuery, setCoordinatorQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailRow, setDetailRow] = useState<StreamingHistoryRow | null>(null);
  const [detailPlacementType, setDetailPlacementType] =
    useState<PlacementType | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadStreamingHistoryAction({
      academicYear: academicYear || undefined,
      parentClassId: parentClassId || undefined,
      studentQuery: studentQuery || undefined,
      coordinatorQuery: coordinatorQuery || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setRows([]);
      return;
    }
    setRows(result.rows);
    setParentClasses(result.parentClasses);
  }, [
    academicYear,
    parentClassId,
    studentQuery,
    coordinatorQuery,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const bulkRowIds = useMemo(() => buildBulkRowIds(rows), [rows]);

  const totalRecords = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize) || 1);
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, effectivePage, pageSize]);

  const paginationRange = useMemo(() => {
    if (totalRecords === 0) {
      return { start: 0, end: 0 };
    }
    const start = (effectivePage - 1) * pageSize + 1;
    const end = Math.min(effectivePage * pageSize, totalRecords);
    return { start, end };
  }, [totalRecords, effectivePage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openDetail = (row: StreamingHistoryRow) => {
    setDetailRow(row);
    setDetailPlacementType(resolvePlacementType(row, bulkRowIds));
  };

  const closeDetail = () => {
    setDetailRow(null);
    setDetailPlacementType(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
          Streaming History
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Audit trail of student stream placements performed by coordinators.
        </p>
        {!loading && (
          <p className="mt-2 text-sm tabular-nums text-slate-500 dark:text-zinc-500">
            {totalRecords.toLocaleString()} placement{" "}
            {totalRecords === 1 ? "record" : "records"}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/30">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Academic Year</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {academicYearOptions().map((y) => (
                <option key={y || "all"} value={y}>
                  {y || "All years"}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Class</span>
            <select
              value={parentClassId}
              onChange={(e) => setParentClassId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All classes</option>
              {parentClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Student</span>
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Name or admission number"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Coordinator</span>
            <input
              value={coordinatorQuery}
              onChange={(e) => setCoordinatorQuery(e.target.value)}
              placeholder="Coordinator name"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-medium text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply filters
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <AsyncLoadingShell
          message="Loading history…"
          slowMessage="Fetching streaming audit records…"
        />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center dark:border-zinc-700/80 dark:bg-zinc-900/80">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
            <History className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
            No streaming records match the selected filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
          <div className="space-y-3 p-3 md:hidden">
            {paginatedRows.map((row) => {
              const { dateLine, timeLine } = formatHistoryDateTime(row.createdAt);
              const coordinator = formatCoordinatorName(row.coordinatorName);
              const placementType = resolvePlacementType(row, bulkRowIds);

              return (
                <StreamingHistoryRecordCard
                  key={row.id}
                  row={row}
                  placementType={placementType}
                  dateLine={dateLine}
                  timeLine={timeLine}
                  coordinatorName={coordinator}
                  onViewDetails={() => openDetail(row)}
                />
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/98 text-left backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/98">
              <tr>
                <th className={TABLE_HEADER_CLASS}>Date &amp; Time</th>
                <th className={TABLE_HEADER_CLASS}>Student</th>
                <th className={TABLE_HEADER_CLASS}>Class</th>
                <th className={TABLE_HEADER_CLASS}>Movement</th>
                <th className={TABLE_HEADER_CLASS}>Score</th>
                <th className={TABLE_HEADER_CLASS}>Assessment</th>
                <th className={TABLE_HEADER_CLASS}>Coordinator</th>
                <th className={TABLE_HEADER_CLASS}>Placement Type</th>
                <th className={TABLE_HEADER_CLASS}>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const { dateLine, timeLine } = formatHistoryDateTime(
                  row.createdAt
                );
                const coordinator = formatCoordinatorName(row.coordinatorName);
                const placementType = resolvePlacementType(row, bulkRowIds);

                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50/90 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={cn(
                        TABLE_CELL_CLASS,
                        "whitespace-nowrap",
                        placementTypeRowLeadingClass(placementType)
                      )}
                    >
                      <p className="font-medium text-slate-900 dark:text-zinc-100">
                        {dateLine}
                      </p>
                      <p className="text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                        {timeLine}
                      </p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="font-medium text-slate-900 dark:text-zinc-50">
                        {row.studentName}
                      </p>
                      {row.admissionNumber ? (
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                          {row.admissionNumber}
                        </p>
                      ) : null}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} text-slate-700 dark:text-zinc-300`}
                    >
                      {row.parentClassName}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>
                      <MovementCell
                        previous={row.previousClassName}
                        next={row.newClassName}
                        spacious
                      />
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} tabular-nums font-medium text-slate-900 dark:text-zinc-100`}
                    >
                      {row.performanceValue}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="text-slate-900 dark:text-zinc-100">
                        {row.examLabel}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                        {row.academicYear}
                      </p>
                    </td>
                    <td className={`max-w-[9rem] ${TABLE_CELL_CLASS}`}>
                      <p
                        className="truncate text-slate-700 dark:text-zinc-300"
                        title={coordinator}
                      >
                        {coordinator}
                      </p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <PlacementTypeBadge type={placementType} />
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className={VIEW_DETAILS_BUTTON_CLASS}
                        aria-label={`View details for ${row.studentName}`}
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-slate-200/70 bg-slate-50/30 px-4 py-2.5 dark:border-zinc-700/60 dark:bg-zinc-900/20">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
              {totalRecords === 0 ? (
                "Showing 0 of 0 records"
              ) : (
                <>
                  Showing{" "}
                  <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                    {paginationRange.start}–{paginationRange.end}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                    {totalRecords}
                  </span>{" "}
                  records
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value) as PageSizeOption);
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                className={PAGINATION_BUTTON_CLASS}
              >
                Previous
              </button>
              <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                Page {effectivePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={effectivePage >= totalPages}
                className={PAGINATION_BUTTON_CLASS}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <StreamingHistoryDetailPanel
        open={detailRow != null}
        row={detailRow}
        placementType={detailPlacementType}
        onClose={closeDetail}
      />

    </div>
  );
}
