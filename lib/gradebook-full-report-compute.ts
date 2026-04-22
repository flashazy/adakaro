/**
 * Shared gradebook “full marks report” math — same formulas as the teacher
 * {@link FullGradeReport} modal (pass/fail rates, distribution, ranking).
 */

import {
  passingThresholdPercent,
  tanzaniaLetterGrade,
  tanzaniaPercentFromScore,
} from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";
import {
  DEFAULT_GRADE_DISPLAY_FORMAT,
  formatMarksCellLabel,
  type GradeDisplayFormat,
} from "@/lib/grade-marks-label-format";

export type ClassDraft = Record<
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

export function cellPercentFromDraft(
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
export function scoreGradeForAssignment(
  raw: string | undefined,
  maxScore: number,
  schoolLevel: SchoolLevel,
  displayFormat: GradeDisplayFormat = DEFAULT_GRADE_DISPLAY_FORMAT
): { scoreLabel: string; grade: string; pct: number | null } {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return { scoreLabel: "—", grade: "—", pct: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { scoreLabel: "—", grade: "—", pct: null };
  const pct = tanzaniaPercentFromScore(n, maxScore);
  const letter = tanzaniaLetterGrade(pct, schoolLevel);
  if (pct == null) return { scoreLabel: "—", grade: "—", pct: null };
  const scoreLabel = formatMarksCellLabel({
    score: n,
    maxScore,
    percent: pct,
    letter: null,
    format: displayFormat,
  });
  return { scoreLabel, grade: letter, pct };
}

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

function passRateLineWithGrade(
  part: number,
  whole: number,
  outOfNoun: "students" | "boys" | "girls",
  schoolLevel: SchoolLevel
): string {
  const r = pctRate(part, whole);
  return `${r}% (${part} out of ${whole} ${outOfNoun}) (${tanzaniaLetterGrade(r, schoolLevel)})`;
}

export function emptyPassFailStats(): {
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

function computePassFailRates(
  cells: Cell[],
  schoolLevel: SchoolLevel
): {
  passing: PassRateStats;
  failing: FailRateStats;
} {
  if (cells.length === 0) return emptyPassFailStats();

  const passingMinPct = passingThresholdPercent(schoolLevel);
  const total = cells.length;
  const passingCells = cells.filter((c) => c.pct >= passingMinPct);
  const failingCells = cells.filter((c) => c.pct < passingMinPct);

  const boysAll = cells.filter((c) => c.gender === "male");
  const girlsAll = cells.filter((c) => c.gender === "female");
  const boysPass = passingCells.filter((c) => c.gender === "male");
  const girlsPass = passingCells.filter((c) => c.gender === "female");
  const boysFail = failingCells.filter((c) => c.gender === "male");
  const girlsFail = failingCells.filter((c) => c.gender === "female");

  const passCount = passingCells.length;
  const failCount = failingCells.length;

  const passing: PassRateStats = {
    passRateLine: passRateLineWithGrade(passCount, total, "students", schoolLevel),
    boysLine:
      boysAll.length > 0
        ? passRateLineWithGrade(boysPass.length, boysAll.length, "boys", schoolLevel)
        : "— (0 out of 0 boys)",
    girlsLine:
      girlsAll.length > 0
        ? passRateLineWithGrade(girlsPass.length, girlsAll.length, "girls", schoolLevel)
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

export function computeReportStatsForAssignment(
  students: { id: string; gender: string | null }[],
  assignment: { id: string; max_score: number },
  draft: ClassDraft,
  schoolLevel: SchoolLevel
) {
  const cells: Cell[] = [];
  for (const s of students) {
    const raw = draft[assignment.id]?.[s.id]?.score ?? "";
    const p = cellPercentFromDraft(raw, assignment.max_score);
    if (p == null) continue;
    const letter = tanzaniaLetterGrade(p, schoolLevel);
    cells.push({ id: s.id, pct: p, letter, gender: s.gender });
  }

  const { passing, failing } = computePassFailRates(cells, schoolLevel);

  const dist = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  for (const c of cells) {
    const L = c.letter;
    if (L === "A") dist.A += 1;
    else if (L === "B") dist.B += 1;
    else if (L === "C") dist.C += 1;
    else if (L === "D") dist.D += 1;
    else if (L === "E") dist.E += 1;
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
  badge: string;
}

export function buildStudentRanking(
  students: { id: string; full_name: string }[],
  assignment: { id: string; max_score: number },
  draft: ClassDraft,
  schoolLevel: SchoolLevel,
  displayFormat: GradeDisplayFormat = DEFAULT_GRADE_DISPLAY_FORMAT
): RankingRow[] {
  const scored: {
    id: string;
    name: string;
    pct: number;
    scoreLabel: string;
    grade: string;
  }[] = [];
  for (const s of students) {
    const { scoreLabel, grade, pct } = scoreGradeForAssignment(
      draft[assignment.id]?.[s.id]?.score,
      assignment.max_score,
      schoolLevel,
      displayFormat
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

export function buildPlainTextReport(
  meta: FullGradeReportMeta,
  assignment: { id: string; title: string; max_score: number },
  students: { id: string; full_name: string; gender: string | null }[],
  draft: ClassDraft,
  stats: ReturnType<typeof computeReportStatsForAssignment>,
  ranking: RankingRow[],
  schoolLevel: SchoolLevel,
  displayFormat: GradeDisplayFormat = DEFAULT_GRADE_DISPLAY_FORMAT
): string {
  const passingPct = passingThresholdPercent(schoolLevel);
  const failingLetter = schoolLevel === "primary" ? "E" : "F";
  const failingCount =
    schoolLevel === "primary" ? stats.dist.E : stats.dist.F;
  const lines: string[] = [
    meta.schoolName.toUpperCase(),
    `${meta.className} — ${meta.subject}`,
    `Teacher: ${meta.teacherName}`,
    `Term: ${meta.termLabel}`,
    `Assignment: ${assignment.title} (max ${assignment.max_score})`,
    "",
    "CLASS STATISTICS (this assignment)",
    ...formatPassingLines(
      `PASSING STUDENTS (score ≥ ${passingPct}%)`,
      stats.passing
    ),
    "",
    ...formatFailingLines(
      `FAILING STUDENTS (score < ${passingPct}%)`,
      stats.failing
    ),
    "",
    `Grade distribution — A: ${stats.dist.A}  B: ${stats.dist.B}  C: ${stats.dist.C}  D: ${stats.dist.D}  ${failingLetter}: ${failingCount}`,
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
      assignment.max_score,
      schoolLevel,
      displayFormat
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
