/**
 * Shared class result sheet (noticeboard / “Print result”) table data — same
 * source as the coordinator PDF, usable for HTML preview on the parent dashboard.
 */

import type { CoordinatorReportCardItem } from "@/app/(dashboard)/teacher-dashboard/coordinator/types";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import { gradingScaleDescription, tanzaniaLetterGrade } from "@/lib/tanzania-grades";
import { normalizeSchoolLevel, type SchoolLevel, SECONDARY_BEST_SUBJECT_COUNT } from "@/lib/school-level";
import { calculateDivision } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import { subjectNameToNectaCode } from "@/lib/necta-subject-code";

export interface ClassResultSheetPdfInput {
  schoolName: string;
  schoolMotto?: string | null;
  className: string;
  schoolLevel: SchoolLevel;
  termDisplayLabel: string;
  term: string;
  academicYear: string;
  coordinatorName?: string | null;
  reportCards: CoordinatorReportCardItem[];
}

const PRIMARY_RESULT_SHEET_SUBJECTS = [
  "Kiswahili",
  "English",
  "Maarifa",
  "Hisabati",
  "Science",
  "Uraia",
] as const;

function nectaMainTableGenderOrder(
  g: CoordinatorReportCardItem["gender"]
): number {
  if (g === "female") return 0;
  if (g === "male") return 1;
  return 2;
}

export function sortForNectaMainTable(
  items: CoordinatorReportCardItem[]
): CoordinatorReportCardItem[] {
  return [...items].sort((a, b) => {
    const bySex = nectaMainTableGenderOrder(a.gender) - nectaMainTableGenderOrder(b.gender);
    if (bySex !== 0) return bySex;
    return a.studentName.localeCompare(b.studentName, undefined, {
      sensitivity: "base",
    });
  });
}

function divisionColumnKey(
  label: string | null | undefined
): "I" | "II" | "III" | "IV" | "0" {
  const l = (label ?? "0").trim();
  if (l === "I") return "I";
  if (l === "II") return "II";
  if (l === "III") return "III";
  if (l === "IV") return "IV";
  return "0";
}

type DivSummaryKey = "I" | "II" | "III" | "IV" | "0" | "INC" | "ABS";

type DivCounts = Record<"I" | "II" | "III" | "IV" | "0" | "INC" | "ABS", number>;

function emptyDivCounts(): DivCounts {
  return { I: 0, II: 0, III: 0, IV: 0, "0": 0, INC: 0, ABS: 0 };
}

function normalizeSecondaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDEF".includes(c)) return c;
  return null;
}

function effectiveSecondaryGradeForNecta(
  s: ReportCardPreviewData["subjects"][number]
): string | null {
  const g = normalizeSecondaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return tanzaniaLetterGrade(s.averagePercentRaw, "secondary");
  }
  return null;
}

function nectaSubjectGradeLetterOrX(
  s: ReportCardPreviewData["subjects"][number]
): string {
  if (s.hasMajorExamScore !== true) return "X";
  return effectiveSecondaryGradeForNecta(s) ?? "X";
}

function subjectHasScoreForNectaPresence(
  s: ReportCardPreviewData["subjects"][number]
): boolean {
  if (s.hasMajorExamScore !== true) return false;
  return effectiveSecondaryGradeForNecta(s) != null;
}

function scoredSubjectsForNecta(
  preview: ReportCardPreviewData
): ReportCardPreviewData["subjects"] {
  return preview.subjects.filter((s) => subjectHasScoreForNectaPresence(s));
}

function nectaAggtAndDiv(preview: ReportCardPreviewData): {
  aggt: string;
  div: string;
} {
  const scored = scoredSubjectsForNecta(preview);
  const n = scored.length;
  if (n === 0) {
    return { aggt: "-", div: "ABS" };
  }
  if (n < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const withGrade = scored
    .map((s) => ({
      avg: s.averagePercentRaw ?? 0,
      grade: effectiveSecondaryGradeForNecta(s),
    }))
    .filter((p): p is { avg: number; grade: string } => p.grade != null);
  if (withGrade.length < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const best7 = [...withGrade]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, SECONDARY_BEST_SUBJECT_COUNT);
  const calc = calculateDivision(best7.map((p) => p.grade));
  if (!calc) {
    return { aggt: "-", div: "INC" };
  }
  return {
    aggt: String(Math.round(calc.totalPoints)),
    div: calc.division,
  };
}

function bucketForDivisionSummary(r: CoordinatorReportCardItem): DivSummaryKey {
  const { div } = nectaAggtAndDiv(r.preview);
  if (div === "ABS" || div === "INC") return div;
  return divisionColumnKey(div);
}

function buildDetailedSubjectsLine(preview: ReportCardPreviewData): string {
  const sorted = [...preview.subjects].sort((a, b) =>
    a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" })
  );
  if (sorted.length === 0) return "—";
  const parts: string[] = [];
  for (const s of sorted) {
    const code = subjectNameToNectaCode(s.subject);
    const g = nectaSubjectGradeLetterOrX(s);
    parts.push(`${code} - '${g}'`);
  }
  return parts.join(" ");
}

function sexLetter(
  gender: CoordinatorReportCardItem["gender"]
): "F" | "M" | "—" {
  if (gender === "female") return "F";
  if (gender === "male") return "M";
  return "—";
}

function normalizePrimaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDE".includes(c)) return c;
  return null;
}

function findPreviewSubjectForPrimary(
  preview: ReportCardPreviewData,
  canonical: string
): ReportCardPreviewData["subjects"][number] | undefined {
  const target = canonical.trim().toLowerCase();
  return preview.subjects.find(
    (s) => s.subject.trim().toLowerCase() === target
  );
}

function primaryGradeLetterMidpointPercent(letter: string): number {
  switch (letter) {
    case "A":
      return 91;
    case "B":
      return 71;
    case "C":
      return 51;
    case "D":
      return 31;
    case "E":
      return 10;
    default:
      return NaN;
  }
}

function percentForPrimaryAveraging(
  s: ReportCardPreviewData["subjects"][number]
): number | null {
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return s.averagePercentRaw;
  }
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) {
    const mid = primaryGradeLetterMidpointPercent(g);
    return Number.isFinite(mid) ? mid : null;
  }
  return null;
}

function effectivePrimarySubjectGradeLetter(
  s: ReportCardPreviewData["subjects"][number] | undefined
): string | null {
  if (!s) return null;
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    const fromPct = tanzaniaLetterGrade(s.averagePercentRaw, "primary");
    return fromPct === "—" ? null : fromPct;
  }
  return null;
}

function primarySheetAverageGradeLetter(
  preview: ReportCardPreviewData
): string {
  const pcts: number[] = [];
  for (const name of PRIMARY_RESULT_SHEET_SUBJECTS) {
    const row = findPreviewSubjectForPrimary(preview, name);
    if (!row) continue;
    const p = percentForPrimaryAveraging(row);
    if (p != null) pcts.push(p);
  }
  if (pcts.length === 0) return "X";
  const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const letter = tanzaniaLetterGrade(mean, "primary");
  return letter === "—" ? "X" : letter;
}

function buildPrimarySubjectsColumn(preview: ReportCardPreviewData): string {
  const parts = PRIMARY_RESULT_SHEET_SUBJECTS.map((name) => {
    const row = findPreviewSubjectForPrimary(preview, name);
    const letter = effectivePrimarySubjectGradeLetter(row);
    return `${name} - ${letter ?? "X"}`;
  });
  const avg = primarySheetAverageGradeLetter(preview);
  parts.push(`Average Grade - ${avg}`);
  return parts.join(", ");
}

type PrimarySheetGradeBucket = "A" | "B" | "C" | "D" | "E";

function emptyPrimaryGradeBuckets(): Record<PrimarySheetGradeBucket, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

function buildPrimaryPassingGradeSummaryRows(
  reportCards: CoordinatorReportCardItem[]
): {
  F: Record<PrimarySheetGradeBucket, number>;
  M: Record<PrimarySheetGradeBucket, number>;
  T: Record<PrimarySheetGradeBucket, number>;
} {
  const F = emptyPrimaryGradeBuckets();
  const M = emptyPrimaryGradeBuckets();
  const T = emptyPrimaryGradeBuckets();

  for (const r of reportCards) {
    for (const subjName of PRIMARY_RESULT_SHEET_SUBJECTS) {
      const row = findPreviewSubjectForPrimary(r.preview, subjName);
      const letter = effectivePrimarySubjectGradeLetter(row);
      if (!letter || !"ABCDE".includes(letter)) continue;
      const k = letter as PrimarySheetGradeBucket;
      T[k] += 1;
      if (r.gender === "female") F[k] += 1;
      else if (r.gender === "male") M[k] += 1;
    }
  }
  return { F, M, T };
}

function buildNectaDivisionPerformanceRows(
  reportCards: CoordinatorReportCardItem[]
): { F: DivCounts; M: DivCounts; T: DivCounts } {
  const F = emptyDivCounts();
  const M = emptyDivCounts();
  const T = emptyDivCounts();
  for (const r of reportCards) {
    const key = bucketForDivisionSummary(r);
    T[key] += 1;
    if (r.gender === "female") F[key] += 1;
    else if (r.gender === "male") M[key] += 1;
  }
  return { F, M, T };
}

function generatedDateLine(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type ClassResultSheetNoticeboardView =
  | {
      level: "secondary";
      schoolName: string;
      schoolMotto: string | null;
      className: string;
      termDisplayLabel: string;
      examTitle: string;
      coordinatorName: string | null;
      division: { head: string[]; body: string[][] };
      main: { head: string[]; body: string[][] };
      footnotes: string[];
    }
  | {
      level: "primary";
      schoolName: string;
      schoolMotto: string | null;
      className: string;
      termDisplayLabel: string;
      examTitle: string;
      coordinatorName: string | null;
      schoolLevel: SchoolLevel;
      overallGrades: { head: string[]; body: string[][] };
      main: { head: string[]; body: string[][] };
      footnotes: string[];
    };

export function classResultSheetToNoticeboardView(
  input: ClassResultSheetPdfInput
): ClassResultSheetNoticeboardView {
  const {
    schoolName,
    schoolMotto,
    className,
    term,
    academicYear,
    coordinatorName,
    reportCards,
  } = input;

  const level = normalizeSchoolLevel(input.schoolLevel);
  const examTitle = `${className.trim().toUpperCase()} TERMINAL RESULTS - ${term.toUpperCase()} ${academicYear}`;

  if (level === "secondary") {
    const { F, M, T } = buildNectaDivisionPerformanceRows(reportCards);
    const divHead = ["SEX", "I", "II", "III", "IV", "0", "INC", "ABS"];
    const divBody: string[][] = [
      [
        "F",
        String(F.I),
        String(F.II),
        String(F.III),
        String(F.IV),
        String(F["0"]),
        String(F.INC),
        String(F.ABS),
      ],
      [
        "M",
        String(M.I),
        String(M.II),
        String(M.III),
        String(M.IV),
        String(M["0"]),
        String(M.INC),
        String(M.ABS),
      ],
      [
        "T",
        String(T.I),
        String(T.II),
        String(T.III),
        String(T.IV),
        String(T["0"]),
        String(T.INC),
        String(T.ABS),
      ],
    ];
    const orderedMain = sortForNectaMainTable(reportCards);
    const mainHead = [
      "S/N",
      "ADN",
      "STUDENT NAME",
      "SEX",
      "AGGT",
      "DIV",
      "DETAILED SUBJECTS",
    ];
    const mainBody = orderedMain.map((r, idx) => {
      const sn = String(idx + 1);
      const adn = (r.admissionNumber ?? "").trim() || "—";
      const name = (r.studentName ?? "").trim() || "—";
      const sex = sexLetter(r.gender);
      const { aggt, div } = nectaAggtAndDiv(r.preview);
      const detail = buildDetailedSubjectsLine(r.preview);
      return [sn, adn, name, sex, aggt, div, detail];
    });
    if (mainBody.length === 0) {
      mainBody.push(["—", "—", "—", "—", "—", "—", "No students"]);
    }
    return {
      level: "secondary",
      schoolName,
      schoolMotto: schoolMotto?.trim() ? schoolMotto : null,
      className: className.trim(),
      termDisplayLabel: input.termDisplayLabel,
      examTitle,
      coordinatorName: (coordinatorName ?? "").trim() || null,
      division: { head: divHead, body: divBody },
      main: { head: mainHead, body: mainBody },
      footnotes: [
        "AGGT = sum of grade points from best 7 scored subjects (A=1 … F=5). DIV = Division from that aggregate. INC = incomplete (<7 scored). ABS = absent (0 scored).",
        `Grading scale: ${gradingScaleDescription("secondary")}.`,
        `Generated: ${generatedDateLine()}`,
      ],
    };
  }

  const { F: pgF, M: pgM, T: pgT } =
    buildPrimaryPassingGradeSummaryRows(reportCards);
  const gradeHead = ["GENDER", "A", "B", "C", "D", "E"];
  const gradeBody: string[][] = [
    [
      "FEMALE",
      String(pgF.A),
      String(pgF.B),
      String(pgF.C),
      String(pgF.D),
      String(pgF.E),
    ],
    [
      "MALE",
      String(pgM.A),
      String(pgM.B),
      String(pgM.C),
      String(pgM.D),
      String(pgM.E),
    ],
    [
      "TOTAL",
      String(pgT.A),
      String(pgT.B),
      String(pgT.C),
      String(pgT.D),
      String(pgT.E),
    ],
  ];
  const ordered = sortForNectaMainTable(reportCards);
  const mainHead = ["S/N", "ADN", "STUDENT NAME", "SEX", "SUBJECTS"];
  const mainBody = ordered.map((r, idx) => {
    const sn = String(idx + 1);
    const adn = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const subjects = buildPrimarySubjectsColumn(r.preview);
    return [sn, adn, name, sex, subjects];
  });
  if (mainBody.length === 0) {
    mainBody.push(["—", "—", "—", "—", "No students"]);
  }
  return {
    level: "primary",
    schoolName,
    schoolMotto: schoolMotto?.trim() ? schoolMotto : null,
    className: className.trim(),
    termDisplayLabel: input.termDisplayLabel,
    examTitle,
    coordinatorName: (coordinatorName ?? "").trim() || null,
    schoolLevel: level,
    overallGrades: { head: gradeHead, body: gradeBody },
    main: { head: mainHead, body: mainBody },
    footnotes: [
      `Grading scale: ${gradingScaleDescription(input.schoolLevel)}.`,
      `Generated: ${generatedDateLine()}`,
    ],
  };
}

export function getNectaSecondaryDivisionAndMain(
  reportCards: CoordinatorReportCardItem[]
) {
  const { F, M, T } = buildNectaDivisionPerformanceRows(reportCards);
  const divHead = [["SEX", "I", "II", "III", "IV", "0", "INC", "ABS"]];
  const divBody = [
    [
      "F",
      String(F.I),
      String(F.II),
      String(F.III),
      String(F.IV),
      String(F["0"]),
      String(F.INC),
      String(F.ABS),
    ],
    [
      "M",
      String(M.I),
      String(M.II),
      String(M.III),
      String(M.IV),
      String(M["0"]),
      String(M.INC),
      String(M.ABS),
    ],
    [
      "T",
      String(T.I),
      String(T.II),
      String(T.III),
      String(T.IV),
      String(T["0"]),
      String(T.INC),
      String(T.ABS),
    ],
  ];
  const orderedMain = sortForNectaMainTable(reportCards);
  const mainHead = [
    [
      "S/N",
      "ADN",
      "STUDENT NAME",
      "SEX",
      "AGGT",
      "DIV",
      "DETAILED SUBJECTS",
    ],
  ];
  const mainBody = orderedMain.map((r, idx) => {
    const sn = String(idx + 1);
    const adn = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const { aggt, div } = nectaAggtAndDiv(r.preview);
    const detail = buildDetailedSubjectsLine(r.preview);
    return [sn, adn, name, sex, aggt, div, detail];
  });
  return { divHead, divBody, mainHead, mainBody };
}

export function getPrimaryGradeSummaryAndMain(
  reportCards: CoordinatorReportCardItem[]
) {
  const { F: pgF, M: pgM, T: pgT } =
    buildPrimaryPassingGradeSummaryRows(reportCards);
  const gradeSummaryHead = [["GENDER", "A", "B", "C", "D", "E"]];
  const gradeSummaryBody = [
    [
      "FEMALE",
      String(pgF.A),
      String(pgF.B),
      String(pgF.C),
      String(pgF.D),
      String(pgF.E),
    ],
    [
      "MALE",
      String(pgM.A),
      String(pgM.B),
      String(pgM.C),
      String(pgM.D),
      String(pgM.E),
    ],
    [
      "TOTAL",
      String(pgT.A),
      String(pgT.B),
      String(pgT.C),
      String(pgT.D),
      String(pgT.E),
    ],
  ];
  const ordered = sortForNectaMainTable(reportCards);
  const head: string[][] = [
    ["S/N", "ADN", "STUDENT NAME", "SEX", "SUBJECTS"],
  ];
  const body = ordered.map((r, idx) => {
    const sn = String(idx + 1);
    const adn = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const subjects = buildPrimarySubjectsColumn(r.preview);
    return [sn, adn, name, sex, subjects];
  });
  return { gradeSummaryHead, gradeSummaryBody, head, body };
}
