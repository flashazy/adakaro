"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SyllabusProgressBar } from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { coverageTextClass } from "@/lib/syllabus-coverage/coverage-stats";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import type { SyllabusCoverageOverviewRow } from "@/lib/syllabus-coverage/types";
import { loadAdminSyllabusOverviewAction } from "./actions";

function yearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [];
  for (let y = current - 2; y <= current + 1; y += 1) years.push(String(y));
  return years;
}

export function AdminSyllabusCoverageClient() {
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear()));
  const [rows, setRows] = useState<SyllabusCoverageOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadAdminSyllabusOverviewAction(academicYear);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      setRows([]);
      return;
    }
    setRows(res.rows);
  }, [academicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Syllabus Coverage
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          School-wide view of subject teaching progress by class and teacher.
        </p>
      </header>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">
          Academic year
        </span>
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
        >
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading overview…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No syllabus coverage data for this year yet. Coordinators create
          topics; teachers update progress.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50">
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3 min-w-[8rem]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.classId}-${row.subjectId}-${row.teacherId}`}
                  className="border-b border-slate-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">{row.className}</td>
                  <td className="px-4 py-3">{row.subjectName}</td>
                  <td className="px-4 py-3">{row.teacherName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.completedSubtopics}/{row.totalSubtopics}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold tabular-nums ${coverageTextClass(row.coveragePercent)}`}
                  >
                    {row.coveragePercent}%
                  </td>
                  <td className="px-4 py-3">
                    <SyllabusProgressBar percent={row.coveragePercent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
