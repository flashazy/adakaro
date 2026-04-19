import { REPORT_CARD_EXAM_LABELS, type ReportTermValue } from "./constants";
import { letterGradeFromPercent, computeReportCardTermAverage } from "./report-card-grades";
import type {
  ReportCardCommentRow,
  StudentReportRow,
} from "./report-card-types";
import type {
  ReportCardDivision,
  ReportCardPreviewData,
  ReportCardSummary,
} from "./report-card-preview-types";
import {
  SECONDARY_BEST_SUBJECT_COUNT,
  type SchoolLevel,
} from "@/lib/school-level";

/** Draft fields needed to align report card preview with the editor. */
export interface ReportCardExamDraftOverlay {
  comment: string;
  exam1: string;
  exam2: string;
  exam1Overridden: boolean;
  exam2Overridden: boolean;
  exam1GbOriginal: string | null;
  exam2GbOriginal: string | null;
}

function parseDraftPercentString(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merges in-memory draft exam scores and comments over server `student.comments`
 * so preview/PDF match the teacher matrix (including unsaved edits).
 */
export function mergeStudentCommentsWithDraftsForPreview(
  student: StudentReportRow,
  subjects: string[],
  draftBySubject: Record<string, ReportCardExamDraftOverlay> | undefined,
  options?: {
    restrictOutputToSubjects?: boolean;
    /** School tier for letter-grade lookup; defaults to secondary. */
    schoolLevel?: SchoolLevel;
  }
): StudentReportRow {
  if (!draftBySubject) return student;

  const bySub = new Map<string, ReportCardCommentRow>(
    student.comments.map((c) => [c.subject, { ...c }])
  );
  const subjList = subjects.length > 0 ? subjects : ["General"];
  const schoolLevel: SchoolLevel = options?.schoolLevel ?? "secondary";

  for (const subject of subjList) {
    const d = draftBySubject[subject];
    if (!d) continue;
    const prev = bySub.get(subject);
    const e1 = parseDraftPercentString(d.exam1);
    const e2 = parseDraftPercentString(d.exam2);
    const avg = computeReportCardTermAverage(e1, e2);
    const grade = avg != null ? letterGradeFromPercent(avg, schoolLevel) : null;

    const merged: ReportCardCommentRow = {
      id: prev?.id ?? "",
      subject,
      comment:
        d.comment.trim() !== "" ? d.comment : prev?.comment ?? null,
      scorePercent: avg ?? prev?.scorePercent ?? null,
      letterGrade: grade ?? prev?.letterGrade ?? null,
      exam1Score: e1,
      exam2Score: e2,
      calculatedScore: avg,
      calculatedGrade: grade,
      exam1GradebookOriginal: d.exam1Overridden
        ? parseDraftPercentString(d.exam1GbOriginal ?? "") ??
          prev?.exam1GradebookOriginal ??
          null
        : (prev?.exam1GradebookOriginal ?? null),
      exam2GradebookOriginal: d.exam2Overridden
        ? parseDraftPercentString(d.exam2GbOriginal ?? "") ??
          prev?.exam2GradebookOriginal ??
          null
        : (prev?.exam2GradebookOriginal ?? null),
      exam1ScoreOverridden: d.exam1Overridden,
      exam2ScoreOverridden: d.exam2Overridden,
      position: prev?.position ?? null,
    };
    bySub.set(subject, merged);
  }

  const allComments = Array.from(bySub.values());
  const comments =
    options?.restrictOutputToSubjects === true
      ? allComments.filter((c) =>
          subjList.some(
            (s) => s.trim().toLowerCase() === c.subject.trim().toLowerCase()
          )
        )
      : allComments;

  return { ...student, comments };
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return `${Math.round(v * 10) / 10}%`;
}

function parseNum(
  v: number | string | null | undefined
): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isReportTerm(t: string): t is ReportTermValue {
  return t === "Term 1" || t === "Term 2";
}

/** Term average (Exam1+Exam2)/2 when both present; matches preview row logic. */
export function termAverageFromComment(
  c: ReportCardCommentRow | null | undefined
): number | null {
  if (!c) return null;
  let e1 = parseNum(c.exam1Score ?? null);
  let e2 = parseNum(c.exam2Score ?? null);
  if (e1 == null && e2 == null && c.scorePercent != null) {
    e1 = parseNum(c.scorePercent);
  }
  const storedCalc = parseNum(c.calculatedScore ?? null);
  const computed = computeReportCardTermAverage(e1, e2);
  const avgRaw = storedCalc ?? computed;
  return avgRaw != null && Number.isFinite(avgRaw) ? avgRaw : null;
}

/**
 * Competition-style class rank per subject: 1 + count of classmates with a strictly higher term average.
 * Only students with a computable term average participate; others get "—".
 */
export function computeClassSubjectPositions(
  allStudents: StudentReportRow[],
  subjects: string[],
  focusStudentId: string
): Record<string, string> {
  const out: Record<string, string> = {};
  const subjList = subjects.length > 0 ? subjects : ["General"];

  for (const subject of subjList) {
    const rows: { studentId: string; avg: number }[] = [];
    for (const s of allStudents) {
      const c = s.comments.find((x) => x.subject === subject);
      const avg = termAverageFromComment(c);
      if (avg != null) rows.push({ studentId: s.studentId, avg });
    }
    const focus = allStudents.find((x) => x.studentId === focusStudentId);
    const fc = focus?.comments.find((x) => x.subject === subject);
    const fAvg = termAverageFromComment(fc);
    if (fAvg == null) {
      out[subject] = "—";
      continue;
    }
    const strictlyHigher = rows.filter((r) => r.avg > fAvg).length;
    out[subject] = String(strictlyHigher + 1);
  }
  return out;
}

export function buildSubjectPreviewRows(
  term: string,
  subjects: string[],
  student: StudentReportRow,
  positionsBySubject?: Record<string, string>,
  /**
   * Names of subjects that contribute to the student's total score for the
   * report-card footer. Pass `null`/`undefined` when no indicator should be
   * rendered (primary schools, or secondary students with ≤7 subjects).
   * When provided, every row gets `selected: true | false`; otherwise rows
   * get `selected: null` so the table can hide the column entirely.
   */
  selectedSubjects?: string[] | null,
  /** School tier for letter-grade lookup; defaults to secondary. */
  schoolLevel: SchoolLevel = "secondary"
): ReportCardPreviewData["subjects"] {
  const bySub = new Map(student.comments.map((c) => [c.subject, c]));
  const list = subjects.length
    ? subjects
    : [...new Set(student.comments.map((c) => c.subject))];
  // Compare names case-insensitively so a "Civics" cohort label still matches
  // a "civics" comment row when deciding which subjects were counted.
  const selectedKeySet =
    Array.isArray(selectedSubjects) && selectedSubjects.length > 0
      ? new Set(selectedSubjects.map((s) => s.trim().toLowerCase()))
      : null;
  const showSelectedFlag = Array.isArray(selectedSubjects);

  return list.map((subject) => {
    const c = bySub.get(subject);
    let e1 = parseNum(c?.exam1Score ?? null);
    let e2 = parseNum(c?.exam2Score ?? null);
    if (e1 == null && e2 == null && c?.scorePercent != null) {
      e1 = parseNum(c.scorePercent);
    }
    const storedCalc = parseNum(c?.calculatedScore ?? null);
    const computed = computeReportCardTermAverage(e1, e2);
    const avgRaw = storedCalc ?? computed;
    let grade =
      c?.calculatedGrade?.trim() ||
      c?.letterGrade?.trim() ||
      "";
    if (!grade && avgRaw != null && Number.isFinite(avgRaw)) {
      grade = letterGradeFromPercent(avgRaw, schoolLevel);
    }
    if (!grade) grade = "—";

    // Prefer the live class-wide rank when it produced a real value; fall back
    // to the position snapshotted onto the comment row at generation time so
    // coordinator-generated cards still show a number even when the live rank
    // has nothing to compare against.
    const livePosition = positionsBySubject?.[subject];
    const storedPosition =
      c?.position != null && Number.isFinite(c.position)
        ? String(c.position)
        : null;
    const hasLivePosition =
      typeof livePosition === "string" && livePosition !== "" && livePosition !== "—";
    const position = hasLivePosition
      ? livePosition
      : storedPosition ?? livePosition ?? "—";

    const selected = showSelectedFlag
      ? selectedKeySet?.has(subject.trim().toLowerCase()) === true
      : null;

    return {
      subject,
      exam1Pct: fmtPct(e1),
      exam2Pct: fmtPct(e2),
      exam1Overridden: c?.exam1ScoreOverridden === true,
      exam2Overridden: c?.exam2ScoreOverridden === true,
      averagePct: avgRaw != null && Number.isFinite(avgRaw) ? `${avgRaw}%` : "—",
      grade,
      position,
      comment: c?.comment?.trim() ?? "",
      selected,
    };
  });
}

export function reportCardExamColumnTitles(term: string): {
  exam1: string;
  exam2: string;
} {
  const labels = isReportTerm(term)
    ? REPORT_CARD_EXAM_LABELS[term]
    : REPORT_CARD_EXAM_LABELS["Term 1"];
  return {
    exam1: `${labels.exam1} (%)`,
    exam2: `${labels.exam2} (%)`,
  };
}

/**
 * Collect this student's per-subject term averages keyed by subject so we can
 * later report *which* subjects contributed (not just the numbers). We re-use
 * the same average logic the table rows use so the summary always agrees with
 * what the report card displays. Subjects without a computable average are
 * skipped entirely.
 */
function collectSubjectAveragePairs(
  student: StudentReportRow,
  subjects: string[]
): { subject: string; avg: number }[] {
  const list =
    subjects.length > 0
      ? subjects
      : [...new Set(student.comments.map((c) => c.subject))];
  const out: { subject: string; avg: number }[] = [];
  for (const subject of list) {
    const c = student.comments.find((x) => x.subject === subject);
    const avg = termAverageFromComment(c);
    if (avg != null && Number.isFinite(avg)) out.push({ subject, avg });
  }
  return out;
}

/**
 * Pick the (subject, avg) pairs that contribute to the student's ranking
 * score for the given school level:
 *  - secondary: top N (default 7) sorted by descending average
 *  - primary:   every pair (all subjects count equally)
 * Ties at the cutoff are broken by stable sort so output is deterministic.
 */
function pickContributingPairs(
  pairs: { subject: string; avg: number }[],
  level: SchoolLevel
): { subject: string; avg: number }[] {
  if (pairs.length === 0) return [];
  if (level === "secondary") {
    return [...pairs]
      .sort((a, b) => b.avg - a.avg)
      .slice(0, SECONDARY_BEST_SUBJECT_COUNT);
  }
  return [...pairs];
}

/**
 * Roll-up score that decides ranking and footer figures for a given level.
 * Both levels report a TOTAL marks figure — primary schools count every
 * subject so the total is the sum of all subject averages; secondary schools
 * cap at the best N (default 7). Ranking is by total marks for both levels;
 * because primary classes share the same subject roster the by-total ranking
 * is identical to a by-average ranking, so behaviour matches expectations.
 * Returns null when the student has no usable subject scores.
 */
function aggregateRankingScore(
  pairs: { subject: string; avg: number }[],
  level: SchoolLevel
): number | null {
  const picked = pickContributingPairs(pairs, level);
  if (picked.length === 0) return null;
  return picked.reduce((acc, p) => acc + p.avg, 0);
}

/**
 * Tanzanian secondary-school grade points per letter grade. Lower is better,
 * so the best 7 subjects (highest %) translate to the lowest point total.
 */
const DIVISION_POINTS_BY_GRADE: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  F: 5,
};

/**
 * Convert a list of letter grades to total Division points and the matching
 * Tanzanian secondary-school Division band. Caller is responsible for passing
 * the right slice of grades — typically the best 7 subject grades.
 *
 * Bands (NECTA):
 *   Division I   — 7–17 points
 *   Division II  — 18–21 points
 *   Division III — 22–25 points
 *   Division IV  — 26–33 points
 *   Division 0   — 34+ points
 *
 * Returns `null` when no grades were supplied (e.g. a student with no scored
 * subjects yet); callers should hide the Division line in that case.
 */
export function calculateDivision(
  grades: (string | null | undefined)[]
): { totalPoints: number; division: string } | null {
  const points: number[] = [];
  for (const g of grades) {
    const key = (g ?? "").trim().toUpperCase();
    const pts = DIVISION_POINTS_BY_GRADE[key];
    if (pts != null) points.push(pts);
  }
  if (points.length === 0) return null;
  const totalPoints = points.reduce((acc, p) => acc + p, 0);
  return { totalPoints, division: divisionLabelForPoints(totalPoints) };
}

function divisionLabelForPoints(totalPoints: number): string {
  if (totalPoints <= 17) return "I";
  if (totalPoints <= 21) return "II";
  if (totalPoints <= 25) return "III";
  if (totalPoints <= 33) return "IV";
  return "0";
}

/** "1st", "2nd", "3rd", "4th", … — handles 11/12/13 correctly. */
export function ordinalSuffix(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Build the rank + total/average summary for the focus student, plus the
 * ready-to-render footer sentence. The cohort is whatever students you pass
 * in `allStudents`; rank is competition-style (1 + count of strictly higher
 * scores), and ties share a rank.
 */
export function computeReportCardStudentSummary(args: {
  allStudents: StudentReportRow[];
  subjects: string[];
  focusStudentId: string;
  schoolLevel: SchoolLevel;
  studentName: string;
  term: string;
  academicYear: string;
}): ReportCardSummary {
  const { allStudents, subjects, focusStudentId, schoolLevel } = args;
  // Robustness: every cohort student gets a numeric score, even when no
  // subjects are scored yet. Missing data is treated as 0 (never as "absent
  // from the ranking") so:
  //   - the cohort size on the footer reflects the full class roster
  //   - a student with no scores ends up at last position, not unranked
  //   - a teacher forgetting to enter scores doesn't drop a student from the
  //     class league entirely.
  const scored: { studentId: string; score: number }[] = [];
  let focusPairs: { subject: string; avg: number }[] = [];
  for (const s of allStudents) {
    const pairs = collectSubjectAveragePairs(s, subjects);
    const rawScore = aggregateRankingScore(pairs, schoolLevel);
    const score = rawScore != null && Number.isFinite(rawScore) ? rawScore : 0;
    if (s.studentId === focusStudentId) focusPairs = pairs;
    scored.push({ studentId: s.studentId, score });
  }
  const focus = scored.find((x) => x.studentId === focusStudentId);
  const focusScore = focus?.score ?? 0;
  const focusPicked = pickContributingPairs(focusPairs, schoolLevel);

  // Only surface the per-subject indicator when something was actually dropped
  // — i.e. secondary student with more subjects than the best-N cap. Primary
  // schools and secondary students at-or-below the cap always count every
  // subject, so the indicator would just be visual noise.
  const droppedSomething =
    schoolLevel === "secondary" &&
    focusPairs.length > SECONDARY_BEST_SUBJECT_COUNT;
  const selectedSubjects: string[] | null = droppedSomething
    ? focusPicked.map((p) => p.subject)
    : null;

  // Competition-style 1-based rank against the full cohort. Ties share a rank.
  // Even with focusScore = 0 the student is placed correctly: they end up at
  // (1 + number of strictly higher scores), which is the last position when
  // every classmate has at least one scored subject.
  const rank: number | null =
    scored.length > 0
      ? scored.filter((x) => x.score > focusScore).length + 1
      : null;

  // Both levels report a TOTAL (rounded to whole marks) so the footer wording
  // is consistent across the school. A no-score student now reads as "0 marks"
  // instead of being silently omitted from the footer. `averagePercent` is
  // kept on the summary shape for backward-compat callers but is no longer
  // populated.
  const totalScore = Math.round(focusScore);
  const averagePercent: number | null = null;

  // Tanzanian Secondary School Division — only computed for secondary schools,
  // and only from the *contributing* (best-7) subjects so it stays in sync with
  // the total marks figure right beside it on the footer.
  let division: ReportCardDivision | null = null;
  if (schoolLevel === "secondary") {
    const bestGrades = focusPicked.map((p) =>
      letterGradeFromPercent(p.avg, schoolLevel)
    );
    const calc = calculateDivision(bestGrades);
    if (calc) {
      division = { totalPoints: calc.totalPoints, label: calc.division };
    }
  }

  const sentence = buildReportCardFooterSentence({
    studentName: args.studentName,
    term: args.term,
    academicYear: args.academicYear,
    schoolLevel,
    rank,
    totalStudents: scored.length,
    totalScore,
    averagePercent,
    division,
  });

  return {
    schoolLevel,
    rank,
    totalStudents: scored.length,
    totalScore,
    averagePercent,
    sentence,
    selectedSubjects,
    division,
  };
}

/**
 * Builds the footer line shown on every report card. A student with no exam
 * scores still gets a sentence (rank = last, total = 0 marks); the function
 * only returns null when the cohort itself is degenerate (no rank, no peers,
 * or no total to print).
 */
export function buildReportCardFooterSentence(args: {
  studentName: string;
  term: string;
  academicYear: string;
  schoolLevel: SchoolLevel;
  rank: number | null;
  totalStudents: number;
  totalScore: number | null;
  /** Legacy field — no longer rendered, kept so older call sites still type-check. */
  averagePercent: number | null;
  /**
   * Tanzanian Secondary School Division for this student. Only appended to the
   * sentence when present; primary schools should pass `null`/omit it.
   */
  division?: ReportCardDivision | null;
}): string | null {
  const {
    studentName,
    term,
    academicYear,
    schoolLevel,
    rank,
    totalStudents,
    totalScore,
    division,
  } = args;
  if (rank == null || totalStudents <= 0) return null;
  if (totalScore == null) return null;
  const name = (studentName ?? "").trim() || "This student";
  const rankText = ordinalSuffix(rank);
  const yr = (academicYear ?? "").trim();
  const termText = (term ?? "").trim();
  // Both primary and secondary now read out a total marks figure for
  // consistency. The level note below the sentence (rendered separately by
  // the preview/PDF) explains what was summed.
  let sentence = `${name} achieved position ${rankText} out of ${totalStudents} students, attaining a total score of ${totalScore} marks in the ${termText} ${yr} examinations.`;
  if (schoolLevel === "secondary" && division) {
    // Show both the Division label and the underlying points so parents and
    // students can see exactly how close they are to the next Division band.
    const pointsText = division.totalPoints === 1 ? "1 point" : `${division.totalPoints} points`;
    sentence += ` Division: ${division.label} (${pointsText})`;
  }
  return sentence;
}
