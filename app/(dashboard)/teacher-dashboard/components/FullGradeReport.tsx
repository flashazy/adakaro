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
import {
  tanzaniaLetterGrade,
  tanzaniaPercentFromScore,
} from "./GradeReportPDF";
import { downloadFullGradeReportPdf } from "./FullGradeReportPDF";

type ClassDraft = Record<
  string,
  Record<string, { score: string; remarks: string }>
>;

export interface FullGradeReportMeta {
  schoolName: string;
  className: string;
  subject: string;
  teacherName: string;
  /** Academic year / term label from teacher assignment. */
  termLabel: string;
}

function cellPercentFromDraft(
  raw: string | undefined,
  maxScore: number
): number | null {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || maxScore <= 0) return null;
  return tanzaniaPercentFromScore(n, maxScore);
}

/** Score % and letter for one assignment cell. */
function scoreGradeForAssignment(
  raw: string | undefined,
  maxScore: number
): { scoreLabel: string; grade: string; pct: number | null } {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return { scoreLabel: "—", grade: "—", pct: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { scoreLabel: "—", grade: "—", pct: null };
  const pct = tanzaniaPercentFromScore(n, maxScore);
  const letter = tanzaniaLetterGrade(pct);
  if (pct == null) return { scoreLabel: "—", grade: "—", pct: null };
  const scoreLabel = `${Math.round(pct * 10) / 10}%`;
  return { scoreLabel, grade: letter, pct };
}

/** Tanzania: passing at ≥30% (grades D–A); below 30% is F (failing band for this report). */
const PASSING_MIN_PCT = 30;

type Cell = {
  id: string;
  pct: number;
  letter: string;
  gender: string | null;
};

export interface PassRateStats {
  passRateLine: string;
  boysLine: string;
  girlsLine: string;
}

export interface FailRateStats {
  failRateLine: string;
  boysLine: string;
  girlsLine: string;
}

function pctRate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Letter for pass-rate % using Tanzania bands (same as student score %). */
function passRateLineWithGrade(
  part: number,
  whole: number,
  outOfNoun: "students" | "boys" | "girls"
): string {
  const r = pctRate(part, whole);
  return `${r}% (${part} out of ${whole} ${outOfNoun}) (${tanzaniaLetterGrade(r)})`;
}

function emptyPassFailStats(): {
  passing: PassRateStats;
  failing: FailRateStats;
} {
  const empty = "— (0 out of 0 students)";
  const emptyBoys = "— (0 out of 0 boys)";
  const emptyGirls = "— (0 out of 0 girls)";
  return {
    passing: {
      passRateLine: empty,
      boysLine: emptyBoys,
      girlsLine: emptyGirls,
    },
    failing: {
      failRateLine: empty,
      boysLine: emptyBoys,
      girlsLine: emptyGirls,
    },
  };
}

function computePassFailRates(cells: Cell[]): {
  passing: PassRateStats;
  failing: FailRateStats;
} {
  if (cells.length === 0) return emptyPassFailStats();

  const total = cells.length;
  const passingCells = cells.filter((c) => c.pct >= PASSING_MIN_PCT);
  const failingCells = cells.filter((c) => c.pct < PASSING_MIN_PCT);

  const boysAll = cells.filter((c) => c.gender === "male");
  const girlsAll = cells.filter((c) => c.gender === "female");
  const boysPass = passingCells.filter((c) => c.gender === "male");
  const girlsPass = passingCells.filter((c) => c.gender === "female");
  const boysFail = failingCells.filter((c) => c.gender === "male");
  const girlsFail = failingCells.filter((c) => c.gender === "female");

  const passCount = passingCells.length;
  const failCount = failingCells.length;

  const passing: PassRateStats = {
    passRateLine: passRateLineWithGrade(passCount, total, "students"),
    boysLine:
      boysAll.length > 0
        ? passRateLineWithGrade(boysPass.length, boysAll.length, "boys")
        : "— (0 out of 0 boys)",
    girlsLine:
      girlsAll.length > 0
        ? passRateLineWithGrade(girlsPass.length, girlsAll.length, "girls")
        : "— (0 out of 0 girls)",
  };

  const failing: FailRateStats = {
    failRateLine: `${pctRate(failCount, total)}% (${failCount} out of ${total} students)`,
    boysLine:
      boysAll.length > 0
        ? `${pctRate(boysFail.length, boysAll.length)}% (${boysFail.length} out of ${boysAll.length} boys)`
        : "— (0 out of 0 boys)",
    girlsLine:
      girlsAll.length > 0
        ? `${pctRate(girlsFail.length, girlsAll.length)}% (${girlsFail.length} out of ${girlsAll.length} girls)`
        : "— (0 out of 0 girls)",
  };

  return { passing, failing };
}

function computeReportStatsForAssignment(
  students: { id: string; gender: string | null }[],
  assignment: { id: string; max_score: number },
  draft: ClassDraft
) {
  const cells: Cell[] = [];
  for (const s of students) {
    const raw = draft[assignment.id]?.[s.id]?.score ?? "";
    const p = cellPercentFromDraft(raw, assignment.max_score);
    if (p == null) continue;
    const letter = tanzaniaLetterGrade(p);
    cells.push({ id: s.id, pct: p, letter, gender: s.gender });
  }

  const { passing, failing } = computePassFailRates(cells);

  const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const c of cells) {
    const L = c.letter;
    if (L === "A") dist.A += 1;
    else if (L === "B") dist.B += 1;
    else if (L === "C") dist.C += 1;
    else if (L === "D") dist.D += 1;
    else if (L === "F") dist.F += 1;
  }

  return {
    passing,
    failing,
    dist,
  };
}

export interface RankingRow {
  rank: number;
  name: string;
  scorePct: string;
  grade: string;
  /** Medal / warning suffix for display */
  badge: string;
}

function buildStudentRanking(
  students: { id: string; full_name: string }[],
  assignment: { id: string; max_score: number },
  draft: ClassDraft
): RankingRow[] {
  const scored: { id: string; name: string; pct: number; scoreLabel: string; grade: string }[] =
    [];
  for (const s of students) {
    const { scoreLabel, grade, pct } = scoreGradeForAssignment(
      draft[assignment.id]?.[s.id]?.score,
      assignment.max_score
    );
    if (pct == null) continue;
    scored.push({
      id: s.id,
      name: s.full_name,
      pct,
      scoreLabel,
      grade,
    });
  }
  scored.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.name.localeCompare(b.name);
  });

  const n = scored.length;
  return scored.map((row, i) => {
    const rank = i + 1;
    const parts: string[] = [];
    if (rank === 1 && n >= 1) parts.push("🥇 Top Performer");
    else if (rank === 2) parts.push("🥈");
    else if (rank === 3) parts.push("🥉");
    if (n >= 2 && rank === n && n > 3) parts.push("⚠️ Needs Improvement");
    return {
      rank,
      name: row.name,
      scorePct: row.scoreLabel,
      grade: row.grade,
      badge: parts.join("  "),
    };
  });
}

function formatPassingLines(prefix: string, seg: PassRateStats): string[] {
  return [
    prefix,
    `Pass rate: ${seg.passRateLine}`,
    `Boys pass rate: ${seg.boysLine}`,
    `Girls pass rate: ${seg.girlsLine}`,
  ];
}

function formatFailingLines(prefix: string, seg: FailRateStats): string[] {
  return [
    prefix,
    `Fail rate: ${seg.failRateLine}`,
    `Boys fail rate: ${seg.boysLine}`,
    `Girls fail rate: ${seg.girlsLine}`,
  ];
}

function PassRateBlock({ seg }: { seg: PassRateStats }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Passing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score ≥ 30%
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

function FailRateBlock({ seg }: { seg: FailRateStats }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Failing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score &lt; 30%
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

function buildPlainTextReport(
  meta: FullGradeReportMeta,
  assignment: { id: string; title: string; max_score: number },
  students: { id: string; full_name: string; gender: string | null }[],
  draft: ClassDraft,
  stats: ReturnType<typeof computeReportStatsForAssignment>,
  ranking: RankingRow[]
): string {
  const lines: string[] = [
    meta.schoolName.toUpperCase(),
    `${meta.className} — ${meta.subject}`,
    `Teacher: ${meta.teacherName}`,
    `Term: ${meta.termLabel}`,
    `Assignment: ${assignment.title} (max ${assignment.max_score})`,
    "",
    "CLASS STATISTICS (this assignment)",
    ...formatPassingLines(
      "PASSING STUDENTS (score ≥ 30%)",
      stats.passing
    ),
    "",
    ...formatFailingLines(
      "FAILING STUDENTS (score < 30%)",
      stats.failing
    ),
    "",
    `Grade distribution — A: ${stats.dist.A}  B: ${stats.dist.B}  C: ${stats.dist.C}  D: ${stats.dist.D}  F: ${stats.dist.F}`,
    "",
    "STUDENT RANKING (Highest to Lowest)",
    ...ranking.map(
      (r) =>
        `${r.rank}. ${r.name}  ${r.scorePct} (${r.grade})  ${r.badge}`.trim()
    ),
    ...(ranking.length === 0 ? ["(No scores entered for this assignment.)"] : []),
    "",
    "STUDENT SCORES & REMARKS",
  ];
  const headers = ["Student", "Gender", "Score", "Grade", "Remarks"];
  lines.push(headers.join("\t"));
  for (const s of students) {
    const { scoreLabel, grade } = scoreGradeForAssignment(
      draft[assignment.id]?.[s.id]?.score,
      assignment.max_score
    );
    const remarks = draft[assignment.id]?.[s.id]?.remarks?.trim() ?? "";
    const row = [
      s.full_name,
      s.gender === "male" ? "Male" : s.gender === "female" ? "Female" : "—",
      scoreLabel,
      grade,
      remarks,
    ];
    lines.push(row.join("\t"));
  }
  return lines.join("\n");
}

export function FullGradeReport({
  open,
  onClose,
  meta,
  metaLoading,
  assignments,
  students,
  classDraft,
}: {
  open: boolean;
  onClose: () => void;
  meta: FullGradeReportMeta | null;
  metaLoading: boolean;
  assignments: { id: string; title: string; max_score: number }[];
  students: { id: string; full_name: string; gender: string | null }[];
  classDraft: ClassDraft;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copyDone, setCopyDone] = useState(false);
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
        dist: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      };
    }
    return computeReportStatsForAssignment(
      students,
      selectedAssignment,
      classDraft
    );
  }, [students, selectedAssignment, classDraft]);

  const ranking = useMemo(() => {
    if (!selectedAssignment) return [] as RankingRow[];
    return buildStudentRanking(students, selectedAssignment, classDraft);
  }, [students, selectedAssignment, classDraft]);

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
      ranking
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [meta, selectedAssignment, students, classDraft, stats, ranking]);

  const handlePrint = useCallback(() => {
    const el = reportRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Grade report</title>`
    );
    w.document.write(
      `<style>
        body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111;background:#fff;max-width:900px;margin:0 auto;}
        h1{font-size:20px;margin:0 0 4px;font-weight:700;text-align:center;}
        .meta{font-size:13px;margin-bottom:16px;line-height:1.5;text-align:center;}
        .box{border:1px solid #ccc;border-radius:8px;padding:16px;margin-bottom:20px;background:#fafafa;}
        .box h2{font-size:14px;margin:0 0 10px;font-weight:700;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top;}
        th{background:#334155;color:#fff;font-weight:600;}
        tr:nth-child(even){background:#f8fafc;}
        @media print{body{padding:12px;}}
      </style></head><body>`
    );
    w.document.write(el.innerHTML);
    w.document.write(`</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, []);

  const handlePdf = useCallback(() => {
    if (!meta || !selectedAssignment) return;
    setPdfBusy(true);
    try {
      const rows = students.map((s) => {
        const { scoreLabel, grade } = scoreGradeForAssignment(
          classDraft[selectedAssignment.id]?.[s.id]?.score,
          selectedAssignment.max_score
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
      });
    } finally {
      setPdfBusy(false);
    }
  }, [meta, selectedAssignment, students, classDraft, stats, ranking, dateLabel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
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
            Full grade report
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
                        <PassRateBlock seg={stats.passing} />
                        <FailRateBlock seg={stats.failing} />
                        <div className="rounded-md border border-dashed border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950/30">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
                            Grade distribution (all scored)
                          </p>
                          <p className="mt-1 tabular-nums text-sm text-slate-800 dark:text-zinc-200">
                            A: {stats.dist.A} · B: {stats.dist.B} · C:{" "}
                            {stats.dist.C} · D: {stats.dist.D} · F:{" "}
                            {stats.dist.F}
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
                        <ol className="mt-3 list-none space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-700">
                          {ranking.map((r) => (
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
                                <span className="font-semibold">({r.grade})</span>
                              </span>
                              {r.badge ? (
                                <span className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
                                  {r.badge}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
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
                                  selectedAssignment.max_score
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
