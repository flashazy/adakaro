"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Download,
  Printer,
  X,
} from "lucide-react";
import { downloadFullGradeReportPdf } from "./FullGradeReportPDF";
import { passingThresholdPercent } from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";
import {
  DEFAULT_GRADE_DISPLAY_FORMAT,
  type GradeDisplayFormat,
} from "@/lib/grade-display-format";
import {
  type ClassDraft,
  type FullGradeReportMeta,
  type PassRateStats,
  type FailRateStats,
  type RankingRow,
  buildStudentRanking,
  computeReportStatsForAssignment,
  emptyPassFailStats,
  scoreGradeForAssignment,
} from "@/lib/gradebook-full-report-compute";

export type {
  PassRateStats,
  FailRateStats,
  RankingRow,
  FullGradeReportMeta,
} from "@/lib/gradebook-full-report-compute";

function PassRateBlock({
  seg,
  schoolLevel,
}: {
  seg: PassRateStats;
  schoolLevel: SchoolLevel;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Passing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score ≥ {passingThresholdPercent(schoolLevel)}%
      </p>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
        <p>
          <span className="font-medium">Pass rate:</span> {seg.passRateLine}
        </p>
        <p>
          <span className="font-medium">Boys pass rate:</span> {seg.boysLine}
        </p>
        <p>
          <span className="font-medium">Girls pass rate:</span> {seg.girlsLine}
        </p>
      </div>
    </div>
  );
}

function FailRateBlock({
  seg,
  schoolLevel,
}: {
  seg: FailRateStats;
  schoolLevel: SchoolLevel;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Failing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score &lt; {passingThresholdPercent(schoolLevel)}%
      </p>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
        <p>
          <span className="font-medium">Fail rate:</span> {seg.failRateLine}
        </p>
        <p>
          <span className="font-medium">Boys fail rate:</span> {seg.boysLine}
        </p>
        <p>
          <span className="font-medium">Girls fail rate:</span> {seg.girlsLine}
        </p>
      </div>
    </div>
  );
}

export function FullGradeReport({
  open,
  onClose,
  meta,
  metaLoading,
  assignments,
  students,
  classDraft,
  schoolLevel = "secondary",
  displayFormat = DEFAULT_GRADE_DISPLAY_FORMAT,
}: {
  open: boolean;
  onClose: () => void;
  meta: FullGradeReportMeta | null;
  metaLoading: boolean;
  assignments: { id: string; title: string; max_score: number }[];
  students: { id: string; full_name: string; gender: string | null }[];
  classDraft: ClassDraft;
  /**
   * School grading tier used for letter bands and pass/fail thresholds.
   * Defaults to "secondary" so legacy callers keep their behaviour.
   */
  schoolLevel?: SchoolLevel;
  /**
   * Display format for score values (Percentage / Marks / Both). Mirrors the
   * Marks page toggle so the on-screen ranking and scores table match what
   * the teacher sees in the matrix. The PDF export intentionally stays on
   * "percentage" for now.
   */
  displayFormat?: GradeDisplayFormat;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");

  useEffect(() => {
    if (!assignments.length) {
      setSelectedAssignmentId("");
      return;
    }
    setSelectedAssignmentId((prev) => {
      if (prev && assignments.some((a) => a.id === prev)) return prev;
      return assignments[0].id;
    });
  }, [assignments]);

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return assignments.find((a) => a.id === selectedAssignmentId) ?? null;
  }, [assignments, selectedAssignmentId]);

  const stats = useMemo(() => {
    if (!selectedAssignment) {
      return {
        ...emptyPassFailStats(),
        dist: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
      };
    }
    return computeReportStatsForAssignment(
      students,
      selectedAssignment,
      classDraft,
      schoolLevel
    );
  }, [students, selectedAssignment, classDraft, schoolLevel]);

  const ranking = useMemo(() => {
    if (!selectedAssignment) return [] as RankingRow[];
    return buildStudentRanking(
      students,
      selectedAssignment,
      classDraft,
      schoolLevel,
      displayFormat
    );
  }, [students, selectedAssignment, classDraft, schoolLevel, displayFormat]);

  /** Top half (ranks 1 … ceil(N/2)) vs bottom half; e.g. N=7 → 4 + 3. */
  const rankingSplit = useMemo(() => {
    const n = ranking.length;
    if (n === 0) {
      return { left: [] as RankingRow[], right: [] as RankingRow[] };
    }
    const leftCount = Math.ceil(n / 2);
    return {
      left: ranking.slice(0, leftCount),
      right: ranking.slice(leftCount),
    };
  }, [ranking]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
        new Date()
      ),
    []
  );

  const handlePrint = useCallback(() => {
    if (!reportRef.current) return;

    const STYLE_ID = "full-grade-report-print-styles";
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    /**
     * The previous implementation used
     *   body * { visibility: hidden } + #surface * { visibility: visible }
     *   + position: absolute on the surface
     * which is a known-fragile combination — it interacts badly with
     * portaled `position: fixed` modals and forces a heavy reflow that
     * Chromium sometimes resolves AFTER the print dialog is already
     * open, leaving the preview blank or stuck on "Loading…".
     *
     * We now use:
     *  - `display: none` on every direct child of <body> except the
     *    modal portal itself (a single id lookup, no descendant
     *    walking for the hide phase).
     *  - The portal switches from fixed → static and drops its
     *    backdrop styling so its children flow naturally onto the
     *    paper.
     *  - `break-inside: avoid` (and the legacy `page-break-inside`)
     *    on tables, rows, sections, and list items so a card or a
     *    table row never gets split across pages.
     */
    style.textContent = `
      @media print {
        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          height: auto !important;
        }

        /* Hide every top-level page chrome / portal except ours. */
        body > * {
          display: none !important;
        }
        body > #full-grade-report-print-portal {
          display: block !important;
          position: static !important;
          inset: auto !important;
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          z-index: auto !important;
        }
        body > #full-grade-report-print-portal * {
          visibility: visible !important;
          overflow: visible !important;
          max-height: none !important;
          box-shadow: none !important;
        }

        /* Strip the modal chrome so the paper looks like a report,
           not a screenshot of a dialog. */
        #full-grade-report-print-surface {
          border: none !important;
          box-shadow: none !important;
          color: #000 !important;
        }

        /* Keep tables, rows, and ranking entries from splitting. */
        #full-grade-report-print-surface table {
          border-collapse: collapse !important;
          width: 100% !important;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        #full-grade-report-print-surface table thead,
        #full-grade-report-print-surface table tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        #full-grade-report-print-surface table th,
        #full-grade-report-print-surface table td {
          border: 1px solid #cbd5e1 !important;
          padding: 4px 6px !important;
          vertical-align: top !important;
        }
        #full-grade-report-print-surface section,
        #full-grade-report-print-surface ol > li,
        #full-grade-report-print-surface ul > li {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      }
    `;
    document.head.appendChild(style);

    const removeStyle = () => {
      style.remove();
    };

    const onAfterPrint = () => {
      removeStyle();
      window.removeEventListener("afterprint", onAfterPrint);
    };

    window.addEventListener("afterprint", onAfterPrint);

    /**
     * Give the browser two animation frames to actually apply the
     * style we just appended before opening the print dialog.
     * `window.print()` is synchronous and blocks the JS thread, so if
     * we call it in the same task we appended the <style>, Chromium
     * can open the preview against a half-painted document.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } finally {
          /* Safari / older browsers may not fire afterprint; avoid
             leaving styles behind */
          window.setTimeout(() => {
            if (document.getElementById(STYLE_ID)) {
              removeStyle();
              window.removeEventListener("afterprint", onAfterPrint);
            }
          }, 2000);
        }
      });
    });
  }, []);

  const handlePdf = useCallback(() => {
    if (!meta || !selectedAssignment) return;
    setPdfBusy(true);
    try {
      const rows = students.map((s) => {
        const { scoreLabel, grade } = scoreGradeForAssignment(
          classDraft[selectedAssignment.id]?.[s.id]?.score,
          selectedAssignment.max_score,
          schoolLevel
        );
        return {
          name: s.full_name,
          gender:
            s.gender === "male"
              ? "Male"
              : s.gender === "female"
                ? "Female"
                : "—",
          scorePct: scoreLabel,
          grade,
          remarks:
            classDraft[selectedAssignment.id]?.[s.id]?.remarks?.trim() ?? "",
        };
      });
      downloadFullGradeReportPdf({
        schoolName: meta.schoolName,
        className: meta.className,
        subject: meta.subject,
        teacherName: meta.teacherName,
        termLabel: meta.termLabel,
        dateLabel,
        assignmentTitle: selectedAssignment.title,
        assignmentMaxScore: selectedAssignment.max_score,
        passing: stats.passing,
        failing: stats.failing,
        dist: stats.dist,
        ranking,
        rows,
        schoolLevel,
      });
    } finally {
      setPdfBusy(false);
    }
  }, [
    meta,
    selectedAssignment,
    students,
    classDraft,
    stats,
    ranking,
    dateLabel,
    schoolLevel,
  ]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      id="full-grade-report-print-portal"
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-grade-report-title"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 print:hidden">
          <h2
            id="full-grade-report-title"
            className="text-lg font-semibold text-slate-900"
          >
            Full marks report
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 pb-4 pt-2 sm:px-6 print:max-h-none print:overflow-visible">
          {metaLoading && (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading report header…
            </p>
          )}
          {!metaLoading && meta && (
            <>
              <div
                ref={reportRef}
                id="full-grade-report-print-surface"
                className="text-slate-900 print:text-black"
              >
                <header className="border-b border-slate-200 pb-4 text-center">
                  <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                    {meta.schoolName}
                  </h1>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {meta.className} — {meta.subject}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Teacher: {meta.teacherName}
                  </p>
                  <p className="text-sm text-slate-600">
                    Term: {meta.termLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{dateLabel}</p>
                </header>

                {assignments.length > 0 && selectedAssignment && (
                  <>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-b border-slate-100 pb-4 print:hidden">
                      <label
                        htmlFor="full-report-assignment"
                        className="text-sm font-medium text-slate-700"
                      >
                        Assignment
                      </label>
                      <select
                        id="full-report-assignment"
                        value={selectedAssignmentId}
                        onChange={(e) =>
                          setSelectedAssignmentId(e.target.value)
                        }
                        className="max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      >
                        {assignments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title} (max {a.max_score})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-4 hidden text-center text-sm font-semibold text-slate-800 print:block">
                      Assignment: {selectedAssignment.title} (max{" "}
                      {selectedAssignment.max_score})
                    </p>
                  </>
                )}

                {assignments.length === 0 && (
                  <p className="mt-6 text-center text-sm text-slate-500">
                    No assignments to report for this class and subject.
                  </p>
                )}

                {selectedAssignment && (
                  <>
                    <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
                        <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                        Class statistics
                        <span className="font-normal normal-case text-slate-500 dark:text-zinc-500">
                          ({selectedAssignment.title})
                        </span>
                      </h3>
                      <div className="mt-3 space-y-3">
                        <PassRateBlock
                          seg={stats.passing}
                          schoolLevel={schoolLevel}
                        />
                        <FailRateBlock
                          seg={stats.failing}
                          schoolLevel={schoolLevel}
                        />
                        <div className="rounded-md border border-dashed border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950/30">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
                            Grade distribution (all scored)
                          </p>
                          <p className="mt-1 tabular-nums text-sm text-slate-800 dark:text-zinc-200">
                            A: {stats.dist.A} · B: {stats.dist.B} · C:{" "}
                            {stats.dist.C} · D: {stats.dist.D} ·{" "}
                            {schoolLevel === "primary" ? (
                              <>E: {stats.dist.E}</>
                            ) : (
                              <>F: {stats.dist.F}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
                        Student ranking (highest to lowest)
                      </h3>
                      {ranking.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
                          No scores entered for this assignment yet.
                        </p>
                      ) : (
                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-700">
                          {/* Left column: ranks 1 … ceil(N/2); right column: remainder.
                              Same markup for screen + print/PDF-portal surfaces. */}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {(
                              [
                                rankingSplit.left,
                                rankingSplit.right,
                              ] as const
                            ).map((rows, idx) => (
                              <div
                                key={idx === 0 ? "rank-col-left" : "rank-col-right"}
                                className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700"
                              >
                                <table className="w-full min-w-0 border-collapse text-left text-xs sm:text-sm">
                                  <thead>
                                    <tr className="bg-slate-800 text-white dark:bg-slate-800">
                                      <th className="w-14 border border-slate-600 px-2 py-2 font-semibold">
                                        #
                                      </th>
                                      <th className="border border-slate-600 px-2 py-2 font-semibold">
                                        Student
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((r) => (
                                      <tr
                                        key={`${idx}-${r.rank}-${r.name}`}
                                        className="break-inside-avoid odd:bg-white even:bg-slate-50/90 dark:odd:bg-zinc-900/80 dark:even:bg-zinc-900/50"
                                        style={{ pageBreakInside: "avoid" }}
                                      >
                                        <td className="border border-slate-200 px-2 py-1.5 tabular-nums font-medium text-slate-800 dark:border-zinc-600 dark:text-zinc-100">
                                          {r.rank}
                                        </td>
                                        <td className="border border-slate-200 px-2 py-1.5 font-medium text-slate-800 dark:border-zinc-600 dark:text-zinc-100">
                                          {r.name}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="mt-6">
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                        Student scores &amp; remarks
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[480px] border-collapse text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-slate-800 text-white">
                              <th className="border border-slate-600 px-2 py-2 font-semibold">
                                Student
                              </th>
                              <th className="border border-slate-600 px-2 py-2 font-semibold">
                                Gender
                              </th>
                              <th className="border border-slate-600 px-2 py-2 font-semibold">
                                Score
                              </th>
                              <th className="border border-slate-600 px-2 py-2 font-semibold">
                                Grade
                              </th>
                              <th className="min-w-[12rem] border border-slate-600 px-2 py-2 font-semibold">
                                Remarks
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((s) => {
                              const { scoreLabel, grade } =
                                scoreGradeForAssignment(
                                  classDraft[selectedAssignment.id]?.[s.id]
                                    ?.score,
                                  selectedAssignment.max_score,
                                  schoolLevel,
                                  displayFormat
                                );
                              const remarks =
                                classDraft[selectedAssignment.id]?.[s.id]
                                  ?.remarks?.trim() ?? "";
                              return (
                                <tr
                                  key={s.id}
                                  className="odd:bg-white even:bg-slate-50/90"
                                >
                                  <td className="border border-slate-200 px-2 py-1.5 font-medium">
                                    {s.full_name}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                                    {s.gender === "male"
                                      ? "Male"
                                      : s.gender === "female"
                                        ? "Female"
                                        : "—"}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800">
                                    {scoreLabel}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-1.5 font-semibold">
                                    {grade}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                                    {remarks || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4 print:hidden">
                <button
                  type="button"
                  onClick={() => handlePdf()}
                  disabled={pdfBusy || !selectedAssignment}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {pdfBusy ? "Preparing…" : "Export to PDF"}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!selectedAssignment}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </>
          )}
          {!metaLoading && !meta && (
            <p className="py-8 text-center text-sm text-red-600">
              Could not load report details.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
