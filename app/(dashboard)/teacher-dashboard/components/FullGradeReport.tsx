"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Copy,
  Download,
  Printer,
  X,
} from "lucide-react";
import { downloadFullGradeReportPdf } from "./FullGradeReportPDF";
import { cn } from "@/lib/utils";
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
  buildPlainTextReport,
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
   * Marks page toggle so the on-screen ranking, scores table, and copied
   * plain-text export match what the teacher sees in the matrix. The PDF
   * export intentionally stays on "percentage" for now.
   */
  displayFormat?: GradeDisplayFormat;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  // Ranking pagination — screen only. The print stylesheet swaps in
  // the full ranking list, so these only affect what the teacher sees
  // on screen, not what comes out of the printer / saved PDF.
  const [rankingPageSize, setRankingPageSize] = useState(20);
  const [rankingPageIndex, setRankingPageIndex] = useState(0);

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

  // Derived ranking-pagination values. We keep them as plain
  // `useMemo`s so the page slice and total page count stay in lockstep
  // with the underlying `ranking` array.
  const rankingTotalPages = Math.max(
    1,
    Math.ceil(ranking.length / rankingPageSize)
  );
  // Clamp the active page when the ranking shrinks (e.g. teacher
  // switches assignments and the new one has fewer students with
  // scores). Always silently fall back to page 0 in that case.
  useEffect(() => {
    if (rankingPageIndex >= rankingTotalPages) {
      setRankingPageIndex(0);
    }
  }, [rankingPageIndex, rankingTotalPages]);
  // Switching assignments resets the ranking entirely, so always send
  // the teacher back to page 1.
  useEffect(() => {
    setRankingPageIndex(0);
  }, [selectedAssignmentId]);

  const rankingPageSafe = Math.min(rankingPageIndex, rankingTotalPages - 1);
  const rankingPageStart = rankingPageSafe * rankingPageSize;
  const rankingPageSlice = useMemo(
    () =>
      ranking.slice(rankingPageStart, rankingPageStart + rankingPageSize),
    [ranking, rankingPageStart, rankingPageSize]
  );
  const rankingRangeStart =
    ranking.length === 0 ? 0 : rankingPageStart + 1;
  const rankingRangeEnd =
    ranking.length === 0
      ? 0
      : Math.min(rankingPageStart + rankingPageSize, ranking.length);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
        new Date()
      ),
    []
  );

  const handleCopy = useCallback(async () => {
    if (!meta || !selectedAssignment) return;
    const text = buildPlainTextReport(
      meta,
      selectedAssignment,
      students,
      classDraft,
      stats,
      ranking,
      schoolLevel,
      displayFormat
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [
    meta,
    selectedAssignment,
    students,
    classDraft,
    stats,
    ranking,
    schoolLevel,
    displayFormat,
  ]);

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
                        🏆 Student ranking (highest to lowest)
                      </h3>
                      {ranking.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
                          No scores entered for this assignment yet.
                        </p>
                      ) : (
                        <>
                          {/* SCREEN-ONLY paginated lists.
                            * Wrapped in `print:hidden` so the printed
                            * version uses the full list further below.
                            * Both the desktop single-line list and the
                            * mobile card list iterate the SAME
                            * `rankingPageSlice` — pagination is shared. */}
                          <div className="print:hidden">
                            {/* Desktop (≥768px): keep the existing
                              * single-line layout. */}
                            <ol className="mt-3 hidden list-none space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-700 md:block">
                              {rankingPageSlice.map((r) => (
                                <li
                                  key={`${r.rank}-${r.name}`}
                                  className="flex flex-nowrap items-baseline gap-x-2 overflow-x-auto text-sm text-slate-800 dark:text-zinc-200"
                                >
                                  <span className="w-7 shrink-0 tabular-nums font-semibold text-slate-600 dark:text-zinc-400">
                                    {r.rank}.
                                  </span>
                                  <span className="min-w-[8rem] flex-1 font-medium">
                                    {r.name}
                                  </span>
                                  <span className="tabular-nums text-slate-700 dark:text-zinc-300">
                                    {r.scorePct}{" "}
                                    <span className="font-semibold">
                                      ({r.grade})
                                    </span>
                                  </span>
                                  {r.badge ? (
                                    <span className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
                                      {r.badge}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ol>

                            {/* Mobile (<768px): card-based list. */}
                            <ol className="mt-3 list-none space-y-2 md:hidden">
                              {rankingPageSlice.map((r) => {
                                // Pick a tint based on the existing
                                // badge text so the highlight line
                                // still reads distinctly:
                                //   medal/top  → emerald
                                //   needs-improvement → amber
                                //   anything else → neutral slate
                                const isTop = /Top Performer/i.test(r.badge);
                                const isNeedsWork = /Needs Improvement/i.test(
                                  r.badge
                                );
                                const badgeTone = isTop
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : isNeedsWork
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300";
                                return (
                                  <li
                                    key={`${r.rank}-${r.name}`}
                                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold tabular-nums text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                                          #{r.rank}
                                        </span>
                                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                          {r.name}
                                        </span>
                                      </div>
                                      <span className="inline-flex shrink-0 items-center rounded-full bg-slate-900/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white dark:bg-white dark:text-slate-900">
                                        {r.grade}
                                      </span>
                                    </div>
                                    <div className="mt-2 text-base font-semibold tabular-nums text-slate-800 dark:text-zinc-200">
                                      {r.scorePct}
                                    </div>
                                    {r.badge ? (
                                      <div className="mt-2">
                                        <span
                                          className={cn(
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                            badgeTone
                                          )}
                                        >
                                          {r.badge}
                                        </span>
                                      </div>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ol>

                            {/* Pagination footer.
                              * Always shows the "Showing X–Y of Z"
                              * range and the rows-per-page selector.
                              * The Previous/Next buttons only render
                              * when there's more than one page. The
                              * whole footer is `print:hidden` thanks to
                              * the wrapper above. */}
                            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                                <span>
                                  Showing{" "}
                                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                                    {rankingRangeStart}–{rankingRangeEnd}
                                  </span>{" "}
                                  of{" "}
                                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                                    {ranking.length}
                                  </span>
                                </span>
                                <label className="flex items-center gap-2">
                                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                                    Rows
                                  </span>
                                  <select
                                    value={rankingPageSize}
                                    onChange={(e) => {
                                      setRankingPageSize(
                                        Number(e.target.value)
                                      );
                                      setRankingPageIndex(0);
                                    }}
                                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                                    aria-label="Ranking rows per page"
                                  >
                                    {[10, 20, 50, 100].map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              {rankingTotalPages > 1 ? (
                                <div className="flex items-center justify-between gap-2 sm:justify-end">
                                  <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                                    Page {rankingPageSafe + 1} of{" "}
                                    {rankingTotalPages}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRankingPageIndex((i) =>
                                          Math.max(0, i - 1)
                                        )
                                      }
                                      disabled={rankingPageSafe <= 0}
                                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Previous
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRankingPageIndex((i) =>
                                          Math.min(
                                            rankingTotalPages - 1,
                                            i + 1
                                          )
                                        )
                                      }
                                      disabled={
                                        rankingPageSafe >=
                                        rankingTotalPages - 1
                                      }
                                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* PRINT-ONLY full list.
                            * Hidden on screen (`hidden`), visible only
                            * when printing (`print:block`). Renders the
                            * complete `ranking` array — pagination is
                            * irrelevant here. We use the compact
                            * single-line layout because it prints more
                            * predictably across pages, and tag each
                            * <li> with `break-inside-avoid` so a card
                            * never gets split between two physical
                            * pages. */}
                          <ol className="mt-3 hidden list-none space-y-1 border-t border-slate-100 pt-3 print:block">
                            {ranking.map((r) => (
                              <li
                                key={`print-${r.rank}-${r.name}`}
                                className="flex items-baseline gap-x-2 break-inside-avoid text-sm text-slate-800"
                                style={{ pageBreakInside: "avoid" }}
                              >
                                <span className="w-7 shrink-0 tabular-nums font-semibold">
                                  {r.rank}.
                                </span>
                                <span className="flex-1 font-medium">
                                  {r.name}
                                </span>
                                <span className="tabular-nums">
                                  {r.scorePct}{" "}
                                  <span className="font-semibold">
                                    ({r.grade})
                                  </span>
                                </span>
                                {r.badge ? (
                                  <span className="text-xs">{r.badge}</span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </>
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
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  disabled={!selectedAssignment}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  {copyDone ? "Copied!" : "Copy to clipboard"}
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
