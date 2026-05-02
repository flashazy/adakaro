"use client";

import { useCallback } from "react";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { HistoricalTermSubjectMetrics, AtRiskStudentRow } from "@/lib/academic-report-types";
import type { SubjectCompareRow } from "@/lib/academic-report-comparison";
import type { SchoolLevel } from "@/lib/school-level";
import { downloadAcademicReportPdf } from "./academic-report-pdf";

export function AcademicReportToolbar({
  reportId: _reportId,
  data,
  schoolName,
  classTitle,
  generatedAtLabel,
  teacherName,
  displaySchoolLevel,
  compareOptions,
  compareTermId,
  onCompareTermIdChange,
  compareTermLabel,
  atRiskStudents,
  subjectCompareRows,
  previousTermMetricsBySubject,
}: {
  reportId: string;
  data: AcademicPerformanceReportData;
  schoolName: string;
  classTitle: string;
  generatedAtLabel: string;
  teacherName: string;
  displaySchoolLevel: SchoolLevel;
  compareOptions: { id: string; label: string }[];
  compareTermId: string;
  onCompareTermIdChange: (id: string) => void;
  compareTermLabel: string;
  atRiskStudents: AtRiskStudentRow[];
  subjectCompareRows: SubjectCompareRow[];
  previousTermMetricsBySubject: HistoricalTermSubjectMetrics | null;
}) {
  const onExport = useCallback(() => {
    downloadAcademicReportPdf({
      data,
      schoolName,
      classTitle,
      generatedAtLabel,
      teacherName,
      displaySchoolLevel,
      compareTermId,
      compareTermLabel,
      atRiskStudents,
      subjectCompareRows,
      previousTermMetricsBySubject,
    });
  }, [
    data,
    schoolName,
    classTitle,
    generatedAtLabel,
    teacherName,
    displaySchoolLevel,
    compareTermId,
    compareTermLabel,
    atRiskStudents,
    subjectCompareRows,
    previousTermMetricsBySubject,
  ]);

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px] sm:items-end">
      <div className="flex w-full flex-col gap-2 sm:items-end">
        <label
          htmlFor="academic-report-compare-term"
          className="text-xs font-medium text-slate-600 dark:text-zinc-400"
        >
          Compare with:
        </label>
        <select
          id="academic-report-compare-term"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white sm:max-w-xs sm:text-right"
          value={compareOptions.length ? compareTermId : ""}
          disabled={compareOptions.length === 0}
          onChange={(e) => onCompareTermIdChange(e.target.value)}
        >
          {compareOptions.length === 0 ? (
            <option value="">No previous reports on file</option>
          ) : (
            compareOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          )}
        </select>
      </div>
      <button
        type="button"
        onClick={onExport}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:w-auto"
      >
        Export to PDF
      </button>
    </div>
  );
}
