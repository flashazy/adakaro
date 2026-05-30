"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import {
  STREAMING_PERFORMANCE_MEASURE_LABELS,
  type StreamingHistoryRow,
  type StreamingParentClassOption,
} from "@/lib/student-streaming/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { loadStreamingHistoryAction } from "../actions";

function academicYearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [""];
  for (let y = current - 2; y <= current + 1; y += 1) {
    years.push(String(y));
  }
  return years;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
          Streaming History
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Audit trail of student stream placements performed by coordinators.
        </p>
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-400">
          No streaming history found for the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-zinc-900/60 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Admission No.</th>
                <th className="px-4 py-3">Class Group</th>
                <th className="px-4 py-3">Previous</th>
                <th className="px-4 py-3">New Stream</th>
                <th className="px-4 py-3">Measure</th>
                <th className="px-4 py-3">Performance</th>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Coordinator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.studentName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.admissionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{r.parentClassName}</td>
                  <td className="px-4 py-3">{r.previousClassName}</td>
                  <td className="px-4 py-3">{r.newClassName}</td>
                  <td className="px-4 py-3">
                    {STREAMING_PERFORMANCE_MEASURE_LABELS[r.performanceMeasure]}
                  </td>
                  <td className="px-4 py-3">{r.performanceValue}</td>
                  <td className="px-4 py-3">{r.examLabel}</td>
                  <td className="px-4 py-3">{r.academicYear}</td>
                  <td className="px-4 py-3">{r.coordinatorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
